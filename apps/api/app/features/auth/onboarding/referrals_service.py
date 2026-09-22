"""
Programa de invitación: código propio por usuario, código de quien lo invitó,
y el cálculo del bono/descuento decreciente para ambos lados.

Mecánica (confirmada con el negocio, no re-litigar acá):
- El invitado recibe un bono/descuento que decae según el tiempo transcurrido
  desde SU PROPIO registro (`Usuario.fecha_registro`) — el incentivo de
  haberse sumado por la invitación.
- Quien invita recibe un bono más chico y más corto, que decae según el
  tiempo transcurrido desde `Usuario.bono_referido_activado_en` — un
  timestamp que se refresca cada vez que UN invitado suyo completa su
  primera actividad real (no es continuo ni se acumula por invitado).
- Ambos se aplican según el rol de la transacción: dueño → % extra en su
  liquidación; arrendatario → % de descuento en lo que paga.
"""
import logging
import secrets
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from app.core.config import settings

logger = logging.getLogger(__name__)

# Sin caracteres ambiguos (0/O, 1/I/L) — se lee y se tipea a mano al
# compartir el código. 6 caracteres de este set son ~10^9 combinaciones:
# la colisión es rarísima, pero igual se reintenta si pasara.
_ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_LARGO_CODIGO = 6
_INTENTOS_MAXIMOS = 8


def _generar_codigo() -> str:
    return "".join(secrets.choice(_ALFABETO_CODIGO) for _ in range(_LARGO_CODIGO))


def obtener_o_generar_codigo(usuario, db: Session) -> str:
    """
    Devuelve el código propio del usuario, generándolo si todavía no tiene
    uno. No depende de una constraint UNIQUE de base de datos (schema_sync
    solo hace ADD COLUMN) — la unicidad se garantiza acá, reintentando en
    caso de choque.
    """
    if usuario.codigo_referido:
        return usuario.codigo_referido

    from app.models.entities import Usuario, InvitacionCodigo

    for _ in range(_INTENTOS_MAXIMOS):
        candidato = _generar_codigo()
        choque = db.query(Usuario).filter(Usuario.codigo_referido == candidato).first()
        choque_inv = db.query(InvitacionCodigo).filter(InvitacionCodigo.codigo == candidato).first()
        if not choque and not choque_inv:
            usuario.codigo_referido = candidato
            db.commit()
            db.refresh(usuario)
            return candidato

    # Extremadamente improbable con ~10^9 combinaciones — pero si pasa, no
    # se cae: se agrega un sufijo con parte del id propio para no chocar.
    logger.error("[REFERIDOS] No se pudo generar código único tras %d intentos para %s", _INTENTOS_MAXIMOS, usuario.id)
    candidato = f"{_generar_codigo()}{usuario.id[:4].upper()}"
    usuario.codigo_referido = candidato
    db.commit()
    db.refresh(usuario)
    return candidato


def crear_invitacion_promotor(admin_user, db: Session, nota: Optional[str] = None):
    """
    Crea un código de un solo uso de tipo 'promotor' creado por el admin.
    Al ser registrado por un usuario, le otorgará automáticamente el rol de promotor.
    """
    from app.models.entities import InvitacionCodigo, Usuario

    for _ in range(_INTENTOS_MAXIMOS):
        candidato = _generar_codigo()
        choque_inv = db.query(InvitacionCodigo).filter(InvitacionCodigo.codigo == candidato).first()
        choque_user = db.query(Usuario).filter(Usuario.codigo_referido == candidato).first()
        if not choque_inv and not choque_user:
            inv = InvitacionCodigo(
                codigo=candidato,
                tipo="promotor",
                creado_por_id=admin_user.id,
                usado=False,
                nota=nota,
            )
            db.add(inv)
            db.commit()
            db.refresh(inv)
            return inv

    candidato = f"{_generar_codigo()}{admin_user.id[:4].upper()}"
    inv = InvitacionCodigo(
        codigo=candidato,
        tipo="promotor",
        creado_por_id=admin_user.id,
        usado=False,
        nota=nota,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


def listar_invitaciones_promotores(admin_user, db: Session) -> List[dict]:
    """Lista las invitaciones a promotores creadas por el admin."""
    from app.models.entities import InvitacionCodigo, Usuario

    invitaciones = (
        db.query(InvitacionCodigo)
        .filter(InvitacionCodigo.tipo == "promotor")
        .order_by(InvitacionCodigo.fecha_creacion.desc())
        .all()
    )
    resultado = []
    for inv in invitaciones:
        nombre_usado = None
        if inv.usado_por_id:
            u = db.query(Usuario).filter(Usuario.id == inv.usado_por_id).first()
            if u:
                nombre_usado = u.nombre
        resultado.append({
            "id": inv.id,
            "codigo": inv.codigo,
            "tipo": inv.tipo,
            "usado": inv.usado,
            "usado_en": inv.usado_en,
            "usado_por_nombre": nombre_usado,
            "link": f"{settings.FRONTEND_URL.rstrip('/')}/invitacion/{inv.codigo}",
            "fecha_creacion": inv.fecha_creacion,
        })
    return resultado


def obtener_o_generar_codigo_activo_promotor(promotor_user, db: Session):
    """
    Busca el código activo (no usado) de un solo uso para invitar referidos.
    Si ya fue usado o no existe, genera uno nuevo para el promotor.
    """
    from app.models.entities import InvitacionCodigo, Usuario

    activa = (
        db.query(InvitacionCodigo)
        .filter(
            InvitacionCodigo.creado_por_id == promotor_user.id,
            InvitacionCodigo.tipo == "referido",
            InvitacionCodigo.usado.is_(False),
        )
        .order_by(InvitacionCodigo.fecha_creacion.desc())
        .first()
    )
    if activa:
        return activa

    for _ in range(_INTENTOS_MAXIMOS):
        candidato = _generar_codigo()
        choque_inv = db.query(InvitacionCodigo).filter(InvitacionCodigo.codigo == candidato).first()
        choque_user = db.query(Usuario).filter(Usuario.codigo_referido == candidato).first()
        if not choque_inv and not choque_user:
            nueva = InvitacionCodigo(
                codigo=candidato,
                tipo="referido",
                creado_por_id=promotor_user.id,
                usado=False,
            )
            promotor_user.codigo_referido = candidato
            db.add(nueva)
            db.commit()
            db.refresh(nueva)
            return nueva

    candidato = f"{_generar_codigo()}{promotor_user.id[:4].upper()}"
    nueva = InvitacionCodigo(
        codigo=candidato,
        tipo="referido",
        creado_por_id=promotor_user.id,
        usado=False,
    )
    promotor_user.codigo_referido = candidato
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


def aplicar_codigo_referido(usuario, codigo: str, db: Session) -> None:
    """
    Registra que `usuario` fue invitado o activado por `codigo`.
    - Si el código es de un solo uso (InvitacionCodigo):
      - Si ya fue usado -> lanza ValueError("Este código de un solo uso ya fue utilizado.")
      - Si tipo == "promotor": otorga es_promotor=True y rol "promotor" en roles_activos.
      - Si tipo == "referido": asigna usuario.referido_por_id = inv.creado_por_id.
      - Marca inv.usado = True, inv.usado_por_id = usuario.id, inv.usado_en = utc_now()
    - Si es código legacy de Usuario: comportamiento anterior.
    """
    from app.models.entities import Usuario, InvitacionCodigo
    from app.core.validators import normalizar_rut

    codigo_limpio = (codigo or "").strip().upper()
    if not codigo_limpio:
        raise ValueError("Ingresa un código de invitación.")

    if usuario.codigo_referido and codigo_limpio == usuario.codigo_referido:
        raise ValueError("No puedes usar tu propio código.")

    # 1. Revisar si pertenece a una invitación de un solo uso
    inv = db.query(InvitacionCodigo).filter(InvitacionCodigo.codigo == codigo_limpio).first()
    if inv:
        if inv.usado:
            raise ValueError("Este código de un solo uso ya fue utilizado.")
        if inv.creado_por_id == usuario.id:
            raise ValueError("No puedes usar un código creado por ti mismo.")

        creador = db.query(Usuario).filter(Usuario.id == inv.creado_por_id).first()
        rut_usuario = normalizar_rut(getattr(usuario, "rut", None))
        rut_creador = normalizar_rut(getattr(creador, "rut", None)) if creador else None
        if rut_usuario and rut_creador and rut_usuario == rut_creador:
            raise ValueError("No puedes usar un código asociado a tu mismo RUT.")

        if inv.tipo == "promotor":
            # Otorga rol de promotor al usuario
            usuario.es_promotor = True
            roles = list(usuario.roles_activos or [])
            if "promotor" not in roles:
                roles.append("promotor")
                usuario.roles_activos = roles
            if not usuario.referido_por_id and creador and creador.id != usuario.id:
                usuario.referido_por_id = creador.id
        else:
            # tipo == "referido"
            if usuario.referido_por_id:
                raise ValueError("Ya registraste un código de invitación antes; no se puede cambiar.")
            if creador and creador.referido_por_id == usuario.id:
                raise ValueError("No se permiten invitaciones circulares o recíprocas.")
            usuario.referido_por_id = inv.creado_por_id

        # Consumir el código de un solo uso
        inv.usado = True
        inv.usado_por_id = usuario.id
        inv.usado_en = datetime.now(timezone.utc)
        db.commit()
        return

    # 2. Fallback legacy con Usuario.codigo_referido
    if usuario.referido_por_id:
        raise ValueError("Ya registraste un código de invitación antes; no se puede cambiar.")

    referente = db.query(Usuario).filter(Usuario.codigo_referido == codigo_limpio).first()
    if not referente:
        raise ValueError("Ese código de invitación no existe.")
    if referente.id == usuario.id:
        raise ValueError("No puedes usar tu propio código.")

    rut_usuario = normalizar_rut(getattr(usuario, "rut", None))
    rut_referente = normalizar_rut(getattr(referente, "rut", None))
    if rut_usuario and rut_referente and rut_usuario == rut_referente:
        raise ValueError("No puedes usar un código asociado a tu mismo RUT.")

    if referente.referido_por_id == usuario.id:
        raise ValueError("No se permiten invitaciones circulares o recíprocas.")

    usuario.referido_por_id = referente.id
    db.commit()


def _pct_por_tramos(dias: float, tramos: list) -> float:
    """`tramos`: lista de (dias_limite, pct) ordenada ascendente. Devuelve el
    pct del primer tramo cuyo límite todavía no se cumplió, o 0.0 si ya
    pasaron todos."""
    if dias < 0:
        return 0.0
    for dias_limite, pct in tramos:
        if dias <= dias_limite:
            return pct
    return 0.0


def calcular_bono_invitado_pct(usuario, config) -> float:
    """% vigente para el INVITADO, según días desde su propio fecha_registro."""
    if not usuario or not usuario.fecha_registro:
        return 0.0
    ahora = datetime.now(timezone.utc)
    registro = usuario.fecha_registro
    if registro.tzinfo is None:
        registro = registro.replace(tzinfo=timezone.utc)
    dias = (ahora - registro).total_seconds() / 86400

    tramos = [
        (getattr(config, "bono_invitado_dias_t1", 30), getattr(config, "bono_invitado_pct_t1", 15.0)),
        (getattr(config, "bono_invitado_dias_t2", 60), getattr(config, "bono_invitado_pct_t2", 8.0)),
        (getattr(config, "bono_invitado_dias_t3", 90), getattr(config, "bono_invitado_pct_t3", 3.0)),
    ]
    return _pct_por_tramos(dias, tramos)


def calcular_bono_referente_pct(usuario, config) -> float:
    """% vigente para QUIEN INVITÓ, según días desde bono_referido_activado_en.
    0 si nunca se activó (nadie a quien invitó convirtió todavía)."""
    if not usuario or not usuario.bono_referido_activado_en:
        return 0.0
    ahora = datetime.now(timezone.utc)
    activado = usuario.bono_referido_activado_en
    if activado.tzinfo is None:
        activado = activado.replace(tzinfo=timezone.utc)
    dias = (ahora - activado).total_seconds() / 86400

    tramos = [
        (getattr(config, "bono_referente_dias_t1", 30), getattr(config, "bono_referente_pct_t1", 8.0)),
        (getattr(config, "bono_referente_dias_t2", 60), getattr(config, "bono_referente_pct_t2", 4.0)),
    ]
    return _pct_por_tramos(dias, tramos)


def calcular_bono_referido_pct(usuario, config) -> float:
    """
    % de bono/descuento vigente para `usuario` en ESTE momento, sea porque
    él mismo fue invitado (más grande, decae desde que se registró) o
    porque él invitó a alguien que ya convirtió (más chico, decae desde esa
    activación). Si ambos aplicaran a la vez (poco común), se usa el mayor.
    """
    return max(
        calcular_bono_invitado_pct(usuario, config),
        calcular_bono_referente_pct(usuario, config),
    )


def calcular_nivel_colaborador(usuario, db: Session) -> dict:
    """
    Calcula el estatus y beneficios exclusivos de Colaborador según sus referidos activos:
    - Bronce (1-4 referidos activos): Nivel inicial. Comisión 15%, bono base.
    - Plata (5-14 referidos activos): Promotor. Comisión reducida a 12% (-3%), bono 10%.
    - Oro (15+ referidos activos): Embajador Pro. Comisión reducida a 10% (-5%), bono 15%, VIP.
    """
    from app.models.entities import Usuario, Reserva

    referidos = db.query(Usuario).filter(Usuario.referido_por_id == usuario.id).all()
    referidos_ids = [r.id for r in referidos]

    activos_count = 0
    if referidos_ids:
        activos_count = (
            db.query(Reserva.cliente_id)
            .filter(
                Reserva.cliente_id.in_(referidos_ids),
                Reserva.estado.in_(["confirmada", "en_curso", "finalizada"]),
            )
            .distinct()
            .count()
        )

    score = activos_count if activos_count > 0 else (len(referidos) // 2)

    if score >= 15:
        nivel = "oro"
        titulo = "Embajador Oro"
        comision_pct = 10.0
        bono_extra_pct = 15.0
        proximo = None
        faltantes = 0
        beneficios = [
            "Comisión de plataforma reducida al 10% en tus vehículos",
            "15% de beneficio y ganancias extra garantizadas",
            "Insignia oficial de Colaborador Verificado",
            "Atención y soporte prioritario VIP",
        ]
    elif score >= 5:
        nivel = "plata"
        titulo = "Promotor Plata"
        comision_pct = 12.0
        bono_extra_pct = 10.0
        proximo = "oro"
        faltantes = 15 - score
        beneficios = [
            "Comisión de plataforma reducida al 12% en tus vehículos",
            "10% de beneficio y ganancias extra en liquidaciones",
            "Insignia de Promotor Activo en tu perfil",
        ]
    else:
        nivel = "bronce"
        titulo = "Colaborador Bronce"
        comision_pct = 15.0
        bono_extra_pct = 8.0
        proximo = "plata"
        faltantes = max(1, 5 - score)
        beneficios = [
            "15% de descuento para tus invitados en su primer arriendo",
            "Bono extra de ganancias por cada referido que active su cuenta",
            "Enlace y código único para invitar ilimitadamente",
        ]

    return {
        "nivel": nivel,
        "titulo": titulo,
        "comision_plataforma_pct": comision_pct,
        "bono_extra_pct": bono_extra_pct,
        "referidos_activos": score,
        "proximo_nivel": proximo,
        "faltantes_proximo_nivel": faltantes,
        "beneficios": beneficios,
    }


def validar_codigo_referido(codigo: str, db: Session) -> dict:
    """Valida si un código de referido/promotor/colaborador existe y está disponible para usar."""
    from app.models.entities import Usuario, InvitacionCodigo
    codigo_limpio = (codigo or "").strip().upper()
    if not codigo_limpio:
        return {
            "valido": False,
            "codigo": "",
            "tipo": "referido",
            "usado": False,
            "nombre_referente": None,
            "mensaje": "Debes ingresar un código de invitación.",
            "beneficio_invitado": "15% de descuento en tu primer arriendo",
        }

    # 1. Buscar en invitaciones de un solo uso
    inv = db.query(InvitacionCodigo).filter(InvitacionCodigo.codigo == codigo_limpio).first()
    if inv:
        if inv.usado:
            return {
                "valido": False,
                "codigo": codigo_limpio,
                "tipo": inv.tipo,
                "usado": True,
                "nombre_referente": None,
                "mensaje": "Este código de un solo uso ya fue utilizado.",
                "beneficio_invitado": "",
            }
        creador = db.query(Usuario).filter(Usuario.id == inv.creado_por_id).first()
        nombre = (creador.nombre or "").split()[0] if creador and creador.nombre else ("Administración" if inv.tipo == "promotor" else "Un promotor")
        if inv.tipo == "promotor":
            beneficio = "Rol oficial de Promotor con acceso a invitar y beneficios exclusivos"
            mensaje = f"¡Invitación oficial de {nombre}! Te registrarás como Promotor de la plataforma."
        else:
            beneficio = "15% de descuento en tu primer arriendo"
            mensaje = f"¡Código válido de {nombre}! Tienes un 15% de descuento en tu primer arriendo."
        return {
            "valido": True,
            "codigo": codigo_limpio,
            "tipo": inv.tipo,
            "usado": False,
            "nombre_referente": nombre,
            "mensaje": mensaje,
            "beneficio_invitado": beneficio,
        }

    # 2. Fallback legacy
    referente = db.query(Usuario).filter(Usuario.codigo_referido == codigo_limpio).first()
    if not referente:
        return {
            "valido": False,
            "codigo": codigo_limpio,
            "tipo": "referido",
            "usado": False,
            "nombre_referente": None,
            "mensaje": "El código de invitación no existe o ha expirado.",
            "beneficio_invitado": "15% de descuento en tu primer arriendo",
        }
    nombre = (referente.nombre or "").split()[0] if referente.nombre else "Un colaborador"
    return {
        "valido": True,
        "codigo": codigo_limpio,
        "tipo": "referido",
        "usado": False,
        "nombre_referente": nombre,
        "mensaje": f"¡Código válido de {nombre}! Tienes un 15% de descuento en tu primer arriendo.",
        "beneficio_invitado": "15% de descuento en tu primer arriendo",
    }


def obtener_estadisticas(usuario, db: Session, config) -> dict:
    """
    Resumen para el panel de "invita y gana" y colaboradores: cuántas personas registró con
    su código, nivel alcanzado, beneficios y bono/descuento vigente en este momento.
    """
    from app.models.entities import Usuario, InvitacionCodigo

    es_prom = bool(usuario.es_promotor or "promotor" in (usuario.roles_activos or []) or "admin" in (usuario.roles_activos or []))

    # Obtener o generar código activo de un solo uso para promotores
    if es_prom:
        inv_activa = obtener_o_generar_codigo_activo_promotor(usuario, db)
        codigo_actual = inv_activa.codigo
    else:
        codigo_actual = usuario.codigo_referido

    invitaciones_usadas = (
        db.query(InvitacionCodigo)
        .filter(InvitacionCodigo.creado_por_id == usuario.id, InvitacionCodigo.usado.is_(True))
        .count()
    )
    referidos_usuarios = (
        db.query(Usuario).filter(Usuario.referido_por_id == usuario.id).count()
    )
    referidos_totales = max(referidos_usuarios, invitaciones_usadas)

    pct_invitado = calcular_bono_invitado_pct(usuario, config)
    pct_referente = calcular_bono_referente_pct(usuario, config)
    if pct_invitado >= pct_referente:
        bono_pct, bono_origen = pct_invitado, ("invitado" if pct_invitado > 0 else None)
    else:
        bono_pct, bono_origen = pct_referente, "referente"

    nivel_info = calcular_nivel_colaborador(usuario, db)

    ultimos_query = (
        db.query(Usuario)
        .filter(Usuario.referido_por_id == usuario.id)
        .order_by(Usuario.fecha_registro.desc())
        .limit(5)
        .all()
    )
    ultimos = []
    for r in ultimos_query:
        nom = (r.nombre or "Usuario").strip()
        partes = nom.split()
        ini = f"{partes[0][0]}{(partes[1][0] if len(partes) > 1 else '')}".upper()
        ultimos.append({
            "iniciales": ini or "US",
            "fecha_registro": r.fecha_registro.strftime("%Y-%m-%d") if r.fecha_registro else "",
            "estado": "activo" if r.bono_referido_activado_en else "registrado",
        })

    return {
        "codigo": codigo_actual,
        "es_un_solo_uso": True,
        "es_promotor": es_prom,
        "referidos_totales": referidos_totales,
        "bono_activado_alguna_vez": bool(usuario.bono_referido_activado_en),
        "bono_pct_vigente": round(bono_pct, 1),
        "bono_origen": bono_origen,
        "nivel_colaborador": nivel_info,
        "ultimos_referidos": ultimos,
    }


def notificar_primera_actividad(usuario, db: Session) -> None:
    """
    Se llama cuando `usuario` completa su primera actividad real en la
    plataforma (primera Reserva en estado "finalizada", como cliente o como
    dueño del auto). Si fue invitado por alguien, refresca el reloj de
    decaimiento de quien lo invitó. Idempotente en la práctica: el llamador
    solo debe invocar esto la primera vez (ver puntos de aplicación).
    """
    if not usuario or not usuario.referido_por_id:
        return

    from app.models.entities import Usuario

    referente = db.query(Usuario).filter(Usuario.id == usuario.referido_por_id).first()
    if not referente:
        return

    referente.bono_referido_activado_en = datetime.now(timezone.utc)
    db.commit()
