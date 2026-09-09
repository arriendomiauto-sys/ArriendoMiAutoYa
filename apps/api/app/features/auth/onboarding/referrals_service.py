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
from typing import Optional
from sqlalchemy.orm import Session

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

    from app.models.entities import Usuario

    for _ in range(_INTENTOS_MAXIMOS):
        candidato = _generar_codigo()
        choque = db.query(Usuario).filter(Usuario.codigo_referido == candidato).first()
        if not choque:
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


def aplicar_codigo_referido(usuario, codigo: str, db: Session) -> None:
    """
    Registra que `usuario` fue invitado por quien tiene `codigo`. Lanza
    ValueError con un mensaje legible si el código no existe, es el propio
    del usuario, o si ya se había aplicado uno antes (no se puede reasignar).
    """
    from app.models.entities import Usuario

    if usuario.referido_por_id:
        raise ValueError("Ya registraste un código de invitación antes; no se puede cambiar.")

    codigo_limpio = (codigo or "").strip().upper()
    if not codigo_limpio:
        raise ValueError("Ingresa un código de invitación.")

    if usuario.codigo_referido and codigo_limpio == usuario.codigo_referido:
        raise ValueError("No puedes usar tu propio código.")

    referente = db.query(Usuario).filter(Usuario.codigo_referido == codigo_limpio).first()
    if not referente:
        raise ValueError("Ese código de invitación no existe.")
    if referente.id == usuario.id:
        raise ValueError("No puedes usar tu propio código.")

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
