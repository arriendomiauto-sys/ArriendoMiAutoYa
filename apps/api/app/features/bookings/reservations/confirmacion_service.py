"""
Confirmación del dueño y no presentación de cualquiera de las dos partes.

Política pedida por el cliente (2026-09-20):

  · Pagada la reserva, el dueño tiene HORAS_CONFIRMACION_DUENO para confirmarla. Si no lo hace se
    avisa al conductor y la reserva se cancela con TODO devuelto (garantía y arriendo): la falla
    no es del arrendatario.
  · Confirmada la reserva, quien no se presente a la entrega paga una multa: si falta el arrendatario
    la multa va para el dueño; si falta el dueño, se le cobra a él.
  · Y sin depender de la voluntad de las personas: la presencia se comprueba por ubicación, no por lo que
    cada uno diga.

Cómo se sabe quién se presentó: cada parte confirma su llegada (`registrar_llegada`) con su ubicación y el
servidor comprueba que esté a menos de RADIO_LLEGADA_M metros del punto de encuentro (las coordenadas del
auto). Las coordenadas de la persona NO se guardan: solo la hora en que quedó comprobada la llegada. Solo se
pide entre HORAS_ANTICIPACION_LLEGADA horas antes de la entrega y el fin de la gracia, y la app la manda solo
con la aplicación abierta. Quien no comparte su ubicación no es sancionado por eso: simplemente no puede
demostrar que llegó, y solo se le multa si la otra parte SÍ lo demostró y la entrega no empezó.

Pasada la gracia desde la hora de inicio, el barrido (`resolver_no_presentaciones`) decide solo:

  · llegó solo el dueño        -> falta el arrendatario: multa al arrendatario, a favor del dueño;
  · llegó solo el arrendatario -> falta el dueño: se devuelve TODO al arrendatario y la multa queda
                                  como deuda del dueño;
  · no llegó ninguno           -> se cancela devolviendo todo, sin multas (no hay a quién culpar);
  · llegaron los dos           -> no se toca; si la entrega sigue sin registrarse pasadas
                                  HORAS_ESCALAR_SIN_ENTREGA horas, se abre un ticket para un administrador.

Antes de multar, HORAS_AVISO_PREVIO_MULTA hora se avisa (push y correo) a quien aún no demostró su llegada.

Salvaguardas para no multar a quien sí llegó: no se decide nada si la entrega ya empezó (hay un QR
escaneado o un checklist), si hay una disputa abierta, ni en reservas anteriores a la política (sin
`confirmar_dueno_antes_de`), ni dentro de la hora de gracia. Quien se sienta injustamente multado puede abrir
una disputa.

Recordatorios (push siempre; correo solo en los momentos críticos): al dueño cuando le quedan 12 h y 3 h
para confirmar; a quien no demostró su llegada, antes de la multa; y el resultado de cada cancelación.

Supuestos que el cliente debe validar (cambiar solo las constantes y `calcular_multa`):
  · plazo de 24 h, acotado por la hora de inicio y con un mínimo de 1 h;
  · gracia de 2 h desde el inicio; la llegada se puede confirmar desde 2 h antes; radio de 500 m;
  · multa = un día de arriendo (IVA incluido) para ambas partes; al arrendatario nunca más que lo
    cobrado, descontada de lo ya capturado; el 100 % va al dueño (sin comisión de la plataforma);
  · la multa al dueño queda como `Pago(tipo="multa_dueno", estado="pendiente")`: hoy no se descuenta
    sola de sus liquidaciones ni se le paga al arrendatario (ver BUG-044 en QA/BUG_TRACKER.md).
"""
import logging
import math
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.features.bookings.reservations import avisos, cancelacion_service
from app.features.payments.mercadopago_service import MercadoPagoService
from app.features.vehicles.catalog.pricing_service import PricingService
from app.models.entities import ConfiguracionPlataforma, Pago, Reserva, TicketSoporte

logger = logging.getLogger(__name__)

HORAS_CONFIRMACION_DUENO = 24
HORAS_MINIMAS_CONFIRMACION = 1
HORAS_GRACIA_NO_PRESENTACION = 2
HORAS_ANTICIPACION_LLEGADA = 2  # la llegada se puede confirmar desde 2 h antes del inicio
HORAS_AVISO_PREVIO_MULTA = 1  # se avisa 1 h antes de que venza la gracia (y se decida la multa)
HORAS_ESCALAR_SIN_ENTREGA = 4  # llegaron los dos y la entrega no se registra: lo revisa un admin
UMBRALES_RECORDATORIO_CONFIRMACION_H = (12, 3)  # horas que le quedan al dueño para confirmar

RADIO_LLEGADA_M = 500  # distancia máxima al punto de encuentro para dar por comprobada la llegada
PRECISION_MAX_TOLERADA_M = 150  # cuánto del error del GPS se perdona como máximo (se suma al radio)

MOTIVO_DUENO_NO_CONFIRMO = "dueno_no_confirmo"
MOTIVO_NO_PRESENTACION = "no_presentacion"  # el ausente fue el arrendatario
MOTIVO_DUENO_NO_PRESENTACION = "dueno_no_presentacion"
MOTIVO_DUENO_CANCELO_TARDE = "dueno_cancelo_tarde"
MOTIVO_NINGUNO = "ninguno_se_presento"


class PoliticaError(Exception):
    """Una regla de la política impide la operación (el endpoint la traduce a HTTP)."""

    def __init__(self, status_code: int, detalle: str):
        super().__init__(detalle)
        self.status_code = status_code
        self.detalle = detalle


def _naive(dt: Optional[datetime]) -> Optional[datetime]:
    return cancelacion_service._naive(dt)


def _ahora_de(ahora: Optional[datetime]) -> datetime:
    """`ahora` en UTC sin zona (acepta con zona: los tests y Postgres la traen)."""
    return _naive(ahora) if ahora is not None else cancelacion_service._ahora()


def _nombre_auto(reserva: Reserva) -> str:
    auto = reserva.auto
    return f"{auto.marca} {auto.modelo}" if auto else "el vehículo"


def _dueno_id(reserva: Reserva):
    return reserva.auto.dueno_id if reserva.auto else None


def _claves_enviadas(reserva: Reserva) -> List[str]:
    return list(reserva.recordatorios_politica or [])


def _marcar(reserva: Reserva, *claves: str) -> None:
    """Reasigna la lista (una mutación en sitio no se detecta en una columna JSON)."""
    enviadas = _claves_enviadas(reserva)
    reserva.recordatorios_politica = enviadas + [c for c in claves if c not in enviadas]


def _horas(td: timedelta) -> float:
    return td.total_seconds() / 3600


def _texto_horas(horas: float) -> str:
    if horas >= 1:
        n = math.ceil(horas)
        return f"{n} hora" + ("" if n == 1 else "s")
    minutos = max(1, math.ceil(horas * 60))
    return f"{minutos} minuto" + ("" if minutos == 1 else "s")


def _tiene_disputa_abierta(reserva: Reserva) -> bool:
    return any((d.estado or "") == "abierta" for d in (reserva.disputas or []))


# ---------------------------------------------------------------------------
# Plazo de confirmación
# ---------------------------------------------------------------------------
def plazo_de_confirmacion(reserva, ahora: datetime) -> datetime:
    """24 h desde el pago, sin pasar de la hora de inicio y con al menos 1 h para que alcance a responder."""
    ahora = _naive(ahora)
    plazo = ahora + timedelta(hours=HORAS_CONFIRMACION_DUENO)
    if getattr(reserva, "fecha_inicio", None):
        plazo = min(plazo, _naive(reserva.fecha_inicio))
    return max(plazo, ahora + timedelta(hours=HORAS_MINIMAS_CONFIRMACION))


def plazo_vencido(reserva: Reserva, ahora: Optional[datetime] = None) -> bool:
    plazo = _naive(reserva.confirmar_dueno_antes_de)
    return bool(plazo and _ahora_de(ahora) > plazo)


def esperar_confirmacion_del_dueno(db: Session, reserva: Reserva, ahora: Optional[datetime] = None) -> None:
    """
    Deja la reserva pagada en `pendiente` con su plazo y avisa a las dos partes. No hace commit: lo hace
    quien la llama, junto con el resto de lo que registró el pago (el correo sale tras ese commit).
    """
    ahora = _ahora_de(ahora)
    reserva.estado = "pendiente"
    reserva.confirmar_dueno_antes_de = plazo_de_confirmacion(reserva, ahora)
    horas = max(1, math.ceil(_horas(reserva.confirmar_dueno_antes_de - ahora)))
    nombre = _nombre_auto(reserva)

    avisos.avisar(
        db, reserva, _dueno_id(reserva), "Nueva solicitud de reserva",
        f"Reservaron tu {nombre} y ya pagaron. Tienes {horas} horas para confirmarla; "
        "si no lo haces, se cancela y se devuelve todo al arrendatario.",
        correo=True,
    )
    avisos.avisar(
        db, reserva, reserva.cliente_id, "Reserva enviada al dueño",
        f"Tu pago del {nombre} quedó registrado y la garantía retenida. El dueño tiene {horas} horas "
        "para confirmar; si no lo hace, cancelamos la reserva y te devolvemos todo.",
    )


def confirmar_reserva(db: Session, reserva: Reserva) -> Reserva:
    """El dueño (o un admin) acepta la solicitud. La validación de permisos y de plazo la hace el endpoint."""
    reserva.estado = "confirmada"
    avisos.avisar(
        db, reserva, reserva.cliente_id, "Reserva confirmada",
        f"El dueño confirmó tu reserva del {_nombre_auto(reserva)}. Ya puedes coordinar el retiro.",
        correo=True,
    )
    db.commit()
    db.refresh(reserva)
    return reserva


def expirar_confirmaciones_vencidas(db: Session, ahora: Optional[datetime] = None) -> int:
    """
    Cancela las reservas `pendiente` cuyo plazo de confirmación venció, devolviendo todo (garantía y
    arriendo) y avisando a las dos partes. Las anteriores a la política (sin plazo) no se tocan.
    Devuelve cuántas canceló.
    """
    ahora = _ahora_de(ahora)
    vencidas = (
        db.query(Reserva)
        .filter(
            Reserva.estado == "pendiente",
            Reserva.confirmar_dueno_antes_de.isnot(None),
            Reserva.confirmar_dueno_antes_de < ahora,
        )
        .with_for_update(skip_locked=True)
        .all()
    )
    for reserva in vencidas:
        resultado = cancelacion_service._devolver_dinero(db, reserva, reembolso_total=True)
        reserva.estado = "cancelada"
        reserva.motivo_cancelacion = MOTIVO_DUENO_NO_CONFIRMO
        _avisar_dueno_no_confirmo(db, reserva, resultado)
    if vencidas:
        db.commit()
    return len(vencidas)


def _avisar_dueno_no_confirmo(db: Session, reserva: Reserva, resultado: dict) -> None:
    nombre = _nombre_auto(reserva)
    clp = cancelacion_service._clp
    partes = []
    if resultado["reembolsado"]:
        partes.append(f"Te devolvimos {clp(resultado['reembolsado'])} del arriendo.")
    if resultado["garantia"]:
        partes.append(f"Liberamos tu garantía de {clp(resultado['garantia'])}.")
    if resultado["pendiente"]:
        partes.append("La devolución quedó en proceso; si no la ves en unos días, escríbenos a soporte.")
    avisos.avisar(
        db, reserva, reserva.cliente_id, "Tu reserva fue cancelada",
        f"El dueño no confirmó a tiempo tu reserva del {nombre}, así que la cancelamos. " + " ".join(partes),
        correo=True,
    )
    avisos.avisar(
        db, reserva, _dueno_id(reserva), "Reserva cancelada por falta de confirmación",
        f"No confirmaste a tiempo la reserva del {nombre}: se canceló y el vehículo quedó libre.",
        correo=True,
    )


# ---------------------------------------------------------------------------
# Recordatorios de la política
# ---------------------------------------------------------------------------
def enviar_recordatorios_de_politica(db: Session, ahora: Optional[datetime] = None, forzar: bool = False) -> dict:
    """
    Avisos que evitan sanciones por descuido (push siempre, correo en estos momentos críticos):

      · al dueño, cuando le quedan 12 h y 3 h para confirmar una solicitud pagada;
      · a quien aún no demostró su llegada, HORAS_AVISO_PREVIO_MULTA hora antes de que se decida la multa.

    Cada aviso sale una sola vez por reserva (`recordatorios_politica`). Una reserva que falla no frena las demás.
    """
    ahora = _ahora_de(ahora)
    resumen = {"confirmacion": 0, "aviso_previo_multa": 0}

    if not forzar:
        cfg = db.query(ConfiguracionPlataforma).first()
        if cfg and not cfg.recordatorios_politica_activos:
            logger.info("[RECORDATORIOS] Omitidos por configuración de plataforma (inactivos)")
            return resumen

    por_confirmar = (
        db.query(Reserva)
        .filter(
            Reserva.estado == "pendiente",
            Reserva.confirmar_dueno_antes_de.isnot(None),
            Reserva.confirmar_dueno_antes_de > ahora,
        )
        .all()
    )
    for reserva in por_confirmar:
        reserva_id = reserva.id
        try:
            restante = _horas(_naive(reserva.confirmar_dueno_antes_de) - ahora)
            claves = [f"confirmar_{u}h" for u in UMBRALES_RECORDATORIO_CONFIRMACION_H if restante <= u]
            # Si se pagó tarde y ya cae bajo varios umbrales, se manda un solo aviso y se marcan todos.
            if not claves or all(c in _claves_enviadas(reserva) for c in claves):
                continue
            avisos.avisar(
                db, reserva, _dueno_id(reserva), "Te quedan pocas horas para confirmar",
                f"Tienes {_texto_horas(restante)} para confirmar la reserva del {_nombre_auto(reserva)}. "
                "Si no la confirmas, se cancela y se devuelve todo al arrendatario.",
                correo=True,
            )
            _marcar(reserva, *claves)
            db.commit()
            resumen["confirmacion"] += 1
        except Exception:  # noqa: BLE001 — una reserva mala no frena las demás
            logger.exception("[RECORDATORIOS] Falló el aviso de confirmación de la reserva %s", reserva_id)
            db.rollback()

    en_gracia = (
        db.query(Reserva)
        .filter(
            Reserva.estado == "confirmada",
            Reserva.confirmar_dueno_antes_de.isnot(None),
            Reserva.fecha_inicio <= ahora - timedelta(hours=HORAS_GRACIA_NO_PRESENTACION - HORAS_AVISO_PREVIO_MULTA),
            Reserva.fecha_inicio > ahora - timedelta(hours=HORAS_GRACIA_NO_PRESENTACION),
        )
        .all()
    )
    for reserva in en_gracia:
        reserva_id = reserva.id
        try:
            if _entrega_empezo(reserva) or _tiene_disputa_abierta(reserva):
                continue
            llego = {"cliente": reserva.llegada_cliente_en is not None, "dueno": reserva.llegada_dueno_en is not None}
            if all(llego.values()):
                continue
            nombre = _nombre_auto(reserva)
            multa = cancelacion_service._clp(calcular_multa(reserva, int(reserva.monto_cobro or 0)))
            destinos = {"cliente": (reserva.cliente_id, "el dueño"), "dueno": (_dueno_id(reserva), "el arrendatario")}
            nuevos = []
            for rol, (usuario_id, otro) in destinos.items():
                clave = f"aviso_multa_{rol}"
                if llego[rol] or clave in _claves_enviadas(reserva):
                    continue
                otro_rol = "dueno" if rol == "cliente" else "cliente"
                if llego[otro_rol]:
                    mensaje = (
                        f"Ya llegó {otro} al punto de encuentro del {nombre}. Si no confirmas tu llegada en menos de "
                        f"una hora, se cancelará la reserva y se te aplicará una multa de {multa}. Abre la app en el "
                        "punto de encuentro: confirmaremos tu llegada por ubicación."
                    )
                else:
                    mensaje = (
                        f"Nadie ha confirmado su llegada a la entrega del {nombre}. Si ninguno lo hace en menos de una "
                        "hora, se cancelará la reserva sin multas. Abre la app en el punto de encuentro para confirmar "
                        "tu llegada por ubicación."
                    )
                avisos.avisar(db, reserva, usuario_id, "Confirma tu llegada", mensaje, correo=True)
                nuevos.append(clave)
            if nuevos:
                _marcar(reserva, *nuevos)
                db.commit()
                resumen["aviso_previo_multa"] += len(nuevos)
        except Exception:  # noqa: BLE001 — una reserva mala no frena las demás
            logger.exception("[RECORDATORIOS] Falló el aviso previo a la multa de la reserva %s", reserva_id)
            db.rollback()
    return resumen


# ---------------------------------------------------------------------------
# Multas
# ---------------------------------------------------------------------------
def calcular_multa(reserva: Reserva, cobrado: int) -> int:
    """Un día de arriendo (IVA incluido), sin superar lo que ya se capturó."""
    dias = PricingService.calcular_dias_reserva(reserva.fecha_inicio, reserva.fecha_fin)
    un_dia = round(int(reserva.monto_cobro or 0) / dias)
    return max(0, min(un_dia, int(cobrado or 0)))


def _reembolsar_parcial(pago_cobro: Pago, monto: int) -> bool:
    """Devuelve `monto` de un cobro ya capturado. `True` si quedó hecho."""
    if cancelacion_service._en_pasarela(pago_cobro):
        res = MercadoPagoService.reembolsar(pago_cobro.referencia_pago, monto)
        if not res.get("success"):
            logger.error("[NO_PRESENTACION] No se pudo reembolsar %s del pago %s: %s",
                         monto, pago_cobro.id, res.get("error"))
            return False
    return True


def _registrar_multa(
    reserva: Reserva, multa: int, ahora: datetime,
    tipo: str = MOTIVO_NO_PRESENTACION,
    nombre: str = "No presentación del arrendatario",
    motivo: str = "El arrendatario confirmó la reserva y no se presentó a retirar el vehículo.",
) -> None:
    item = {
        "tipo": tipo,
        "nombre": nombre,
        "monto_clp": multa,
        "motivo": motivo,
        "fotos": [],
        "timestamp": ahora.replace(tzinfo=timezone.utc).isoformat(),
    }
    reserva.multas_detalle = list(reserva.multas_detalle or []) + [item]
    texto = f"[{item['nombre']}: {cancelacion_service._clp(multa)} CLP - {motivo}]"
    reserva.motivo_multas = f"{reserva.motivo_multas} | {texto}" if reserva.motivo_multas else texto


def multar_al_dueno_por_cancelar(db: Session, reserva: Reserva, ahora: Optional[datetime] = None) -> int:
    """
    El dueño cancela una reserva ya confirmada con poca anticipación: se le aplica la multa de un día de
    arriendo como deuda pendiente (`Pago multa_dueno`). No hace commit ni avisa (lo hace quien cancela).
    Devuelve el monto, 0 si no correspondía.
    """
    ahora = _ahora_de(ahora)
    multa = calcular_multa(reserva, int(reserva.monto_cobro or 0))
    if not multa or not reserva.auto:
        return 0
    _registrar_multa(
        reserva, multa, ahora, tipo="cancelacion_tardia_dueno", nombre="Cancelación tardía del dueño",
        motivo="El dueño canceló una reserva ya confirmada con poca anticipación.",
    )
    db.add(Pago(
        reserva_id=reserva.id, usuario_id=reserva.auto.dueno_id, tipo="multa_dueno",
        monto=multa, estado="pendiente",
    ))
    reserva.motivo_cancelacion = MOTIVO_DUENO_CANCELO_TARDE
    return multa


# ---------------------------------------------------------------------------
# Llegada comprobada por ubicación
# ---------------------------------------------------------------------------
def distancia_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia en metros entre dos coordenadas (haversine)."""
    radio_tierra = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radio_tierra * math.asin(math.sqrt(a))


def _verificar_ubicacion(reserva: Reserva, latitud, longitud, precision_m) -> None:
    """
    Comprueba que quien avisa está en el punto de encuentro. Lanza `PoliticaError` si no puede demostrarlo.
    Sin coordenadas del auto no hay contra qué comparar: se acepta su aviso (no hay otra forma de saberlo).
    Las coordenadas recibidas no se guardan ni se registran.
    """
    auto = reserva.auto
    if auto is None or auto.latitud is None or auto.longitud is None:
        return
    if latitud is None or longitud is None:
        raise PoliticaError(
            422,
            "Para confirmar tu llegada necesitamos tu ubicación actual (solo para esto: no la guardamos). "
            "Activa el permiso de ubicación e inténtalo de nuevo.",
        )
    if not (-90 <= latitud <= 90 and -180 <= longitud <= 180):
        raise PoliticaError(422, "La ubicación recibida no es válida.")
    tolerancia = min(max(precision_m or 0, 0), PRECISION_MAX_TOLERADA_M)
    distancia = distancia_m(latitud, longitud, auto.latitud, auto.longitud)
    if distancia > RADIO_LLEGADA_M + tolerancia:
        raise PoliticaError(
            409,
            f"Todavía estás a unos {int(round(distancia, -1))} m del punto de encuentro. "
            "Acércate e inténtalo de nuevo.",
        )


def registrar_llegada(
    db: Session, reserva: Reserva, actor, ahora: Optional[datetime] = None,
    latitud: Optional[float] = None, longitud: Optional[float] = None, precision_m: Optional[float] = None,
) -> Reserva:
    """
    Llegada al punto de encuentro, comprobada por ubicación (ver el docstring del módulo). Idempotente: no
    cambia la hora ni vuelve a avisar. Es la señal con la que el barrido decide quién no se presentó.
    """
    ahora = _ahora_de(ahora)
    es_cliente = actor.id == reserva.cliente_id
    es_dueno = actor.id == _dueno_id(reserva)
    if not (es_cliente or es_dueno):
        raise PoliticaError(403, "Solo el arrendatario o el dueño de esta reserva pueden confirmar su llegada.")
    if reserva.estado != "confirmada":
        raise PoliticaError(409, "Solo se puede confirmar la llegada de una reserva confirmada.")
    if ahora < _naive(reserva.fecha_inicio) - timedelta(hours=HORAS_ANTICIPACION_LLEGADA):
        raise PoliticaError(
            409, f"Todavía es muy pronto: puedes confirmar tu llegada desde {HORAS_ANTICIPACION_LLEGADA} horas antes."
        )

    campo = "llegada_cliente_en" if es_cliente else "llegada_dueno_en"
    if getattr(reserva, campo) is None:
        _verificar_ubicacion(reserva, latitud, longitud, precision_m)
        setattr(reserva, campo, ahora)
        avisos.avisar(
            db, reserva, _dueno_id(reserva) if es_cliente else reserva.cliente_id, "Ya llegó al punto de encuentro",
            f"{'El arrendatario' if es_cliente else 'El dueño'} ya llegó al punto de encuentro del {_nombre_auto(reserva)}.",
        )
        db.commit()
    db.refresh(reserva)
    return reserva


# ---------------------------------------------------------------------------
# Decisión automática
# ---------------------------------------------------------------------------
def _validar_espera(reserva: Reserva, ahora: datetime) -> None:
    if reserva.estado != "confirmada":
        raise PoliticaError(409, "Solo se puede resolver la no presentación de una reserva confirmada.")
    if ahora < _naive(reserva.fecha_inicio) + timedelta(hours=HORAS_GRACIA_NO_PRESENTACION):
        raise PoliticaError(
            409,
            f"Todavía no se puede resolver: hay {HORAS_GRACIA_NO_PRESENTACION} horas de espera desde la hora de inicio.",
        )


def _entrega_empezo(reserva: Reserva) -> bool:
    """Un QR escaneado (aunque se rechazara) o un checklist iniciado prueban que hubo encuentro."""
    return bool(reserva.verificaciones) or bool(reserva.checklists)


def registrar_no_presentacion(db: Session, reserva: Reserva, ahora: Optional[datetime] = None) -> Reserva:
    """
    El arrendatario no se presentó: cancela, suelta la garantía, aplica la multa (descontada de lo
    cobrado), devuelve el resto y abona la multa al dueño. Lanza `PoliticaError` si no corresponde.
    """
    ahora = _ahora_de(ahora)
    _validar_espera(reserva, ahora)

    cobro = (
        db.query(Pago)
        .filter(Pago.reserva_id == reserva.id, Pago.tipo == "cobro_arriendo", Pago.estado == "capturado")
        .first()
    )
    multa = calcular_multa(reserva, cobro.monto if cobro else 0)

    # La garantía se suelta siempre; un cobro que nunca se acreditó se cancela. El arriendo capturado
    # NO se devuelve entero: primero se descuenta la multa.
    cancelacion_service._devolver_dinero(db, reserva, reembolso_total=False)

    devuelto = 0
    reembolso_pendiente = False
    if multa and cobro:
        _registrar_multa(reserva, multa, ahora)
        resto = cobro.monto - multa
        if resto > 0:
            hecho = _reembolsar_parcial(cobro, resto)
            reembolso_pendiente = not hecho
            devuelto = resto if hecho else 0
            db.add(Pago(
                reserva_id=reserva.id, usuario_id=reserva.cliente_id, tipo="reembolso_parcial",
                monto=resto, estado="reembolsado" if hecho else "pendiente",
                referencia_pago=cobro.referencia_pago,
            ))
        if reserva.auto:
            # Nace "pendiente": el depósito lo hace liquidaciones_service, como con cualquier liquidación.
            db.add(Pago(
                reserva_id=reserva.id, usuario_id=reserva.auto.dueno_id, tipo="liquidacion_dueno",
                monto=multa, estado="pendiente",
            ))
            reserva.liquidacion_dueno_clp = multa

    reserva.estado = "cancelada"
    reserva.motivo_cancelacion = MOTIVO_NO_PRESENTACION
    _avisar_no_presentacion(db, reserva, multa, devuelto, reembolso_pendiente)
    db.commit()
    db.refresh(reserva)
    return reserva


def _avisar_no_presentacion(db: Session, reserva: Reserva, multa: int, devuelto: int, pendiente: bool) -> None:
    nombre = _nombre_auto(reserva)
    clp = cancelacion_service._clp
    if multa:
        cliente = (
            f"No te presentaste a retirar el {nombre}, así que cancelamos la reserva y se aplicó una multa de "
            f"{clp(multa)}, que se entrega al dueño. "
        )
        if devuelto:
            cliente += f"Te devolvimos {clp(devuelto)} del arriendo. "
        if pendiente:
            cliente += "La devolución quedó en proceso; si no la ves en unos días, escríbenos a soporte. "
        cliente += "Liberamos tu garantía. Si crees que es un error, puedes abrir una disputa desde la reserva."
        dueno = (
            f"Registramos que el arrendatario no se presentó por el {nombre}. La multa de {clp(multa)} "
            "se abonará a tu cuenta de cobro."
        )
    else:
        cliente = f"No te presentaste a retirar el {nombre}, así que cancelamos la reserva y liberamos tu garantía."
        dueno = f"Registramos que el arrendatario no se presentó por el {nombre}. La reserva quedó cancelada."

    avisos.avisar(db, reserva, reserva.cliente_id, "Reserva cancelada: no te presentaste", cliente.strip(), correo=True)
    avisos.avisar(db, reserva, _dueno_id(reserva), "No presentación registrada", dueno, correo=True)


def registrar_no_presentacion_del_dueno(db: Session, reserva: Reserva, ahora: Optional[datetime] = None) -> Reserva:
    """
    El arrendatario llegó y el dueño no: se devuelve TODO al arrendatario (arriendo y garantía) y a
    quien faltó se le aplica la multa. No hay dinero capturado del dueño, así que queda como deuda
    (`Pago multa_dueno` pendiente) para cobrársela.
    """
    ahora = _ahora_de(ahora)
    _validar_espera(reserva, ahora)

    resultado = cancelacion_service._devolver_dinero(db, reserva, reembolso_total=True)
    multa = calcular_multa(reserva, int(reserva.monto_cobro or 0))
    if multa and reserva.auto:
        _registrar_multa(
            reserva, multa, ahora, tipo="no_presentacion_dueno", nombre="No presentación del dueño",
            motivo="El dueño confirmó la reserva y no se presentó a entregar el vehículo.",
        )
        db.add(Pago(
            reserva_id=reserva.id, usuario_id=reserva.auto.dueno_id, tipo="multa_dueno",
            monto=multa, estado="pendiente",
        ))

    reserva.estado = "cancelada"
    reserva.motivo_cancelacion = MOTIVO_DUENO_NO_PRESENTACION
    nombre = _nombre_auto(reserva)
    clp = cancelacion_service._clp
    devuelto = []
    if resultado["reembolsado"]:
        devuelto.append(f"Te devolvimos {clp(resultado['reembolsado'])} del arriendo.")
    if resultado["garantia"]:
        devuelto.append(f"Liberamos tu garantía de {clp(resultado['garantia'])}.")
    if resultado["pendiente"]:
        devuelto.append("La devolución quedó en proceso; si no la ves en unos días, escríbenos a soporte.")
    avisos.avisar(
        db, reserva, reserva.cliente_id, "Reserva cancelada: el dueño no se presentó",
        f"El dueño no se presentó a entregar el {nombre}, así que cancelamos la reserva. " + " ".join(devuelto),
        correo=True,
    )
    cierre = f" Se aplicó una multa de {clp(multa)}." if multa else ""
    avisos.avisar(
        db, reserva, _dueno_id(reserva), "Reserva cancelada: no te presentaste",
        f"No te presentaste a entregar el {nombre} y la reserva se canceló.{cierre} "
        "Si crees que es un error, puedes abrir una disputa desde la reserva.",
        correo=True,
    )
    db.commit()
    db.refresh(reserva)
    return reserva


def cancelar_por_ausencia_de_ambos(db: Session, reserva: Reserva, ahora: Optional[datetime] = None) -> Reserva:
    """No llegó ninguno: no hay a quién culpar. Se cancela devolviendo todo, sin multas."""
    ahora = _ahora_de(ahora)
    _validar_espera(reserva, ahora)

    resultado = cancelacion_service._devolver_dinero(db, reserva, reembolso_total=True)
    reserva.estado = "cancelada"
    reserva.motivo_cancelacion = MOTIVO_NINGUNO
    nombre = _nombre_auto(reserva)
    clp = cancelacion_service._clp
    devuelto = []
    if resultado["reembolsado"]:
        devuelto.append(f"Se devolvieron {clp(resultado['reembolsado'])} del arriendo.")
    if resultado["garantia"]:
        devuelto.append(f"Se liberó la garantía de {clp(resultado['garantia'])}.")
    if resultado["pendiente"]:
        devuelto.append("La devolución quedó en proceso; si no se ve en unos días, escríbenos a soporte.")
    mensaje = (
        f"Nadie se presentó a la entrega del {nombre} (ninguno comprobó su llegada), así que cancelamos la reserva "
        "sin multas. " + " ".join(devuelto)
    )
    for usuario_id in (reserva.cliente_id, _dueno_id(reserva)):
        avisos.avisar(db, reserva, usuario_id, "Reserva cancelada: nadie se presentó", mensaje.strip(), correo=True)
    db.commit()
    db.refresh(reserva)
    return reserva


def _escalar_sin_entrega(db: Session, reserva: Reserva) -> None:
    """
    Llegaron los dos y la entrega nunca se registró: no hay a quién multar ni qué devolver por reglas, así que
    lo revisa una persona. Ticket para soporte y aviso a las dos partes. Una sola vez por reserva.
    """
    if "escalada_sin_entrega" in _claves_enviadas(reserva):
        return
    _marcar(reserva, "escalada_sin_entrega")
    nombre = _nombre_auto(reserva)
    db.add(TicketSoporte(
        usuario_id=reserva.cliente_id,
        asunto=f"Entrega sin registrar: reserva {reserva.id[:8]}",
        descripcion=(
            f"Ambas partes comprobaron su llegada por ubicación a la entrega del {nombre}, pero pasaron "
            f"{HORAS_ESCALAR_SIN_ENTREGA} horas desde la hora de inicio y la entrega no se registró (sin QR ni "
            "checklist). La reserva sigue confirmada, con el arriendo cobrado y la garantía retenida. "
            "Revisar con ambas partes."
        ),
    ))
    mensaje = (
        f"Los dos llegaron a la entrega del {nombre}, pero la entrega no quedó registrada en la app. "
        "Regístrala ahora (escaneando el QR) o escríbenos a soporte; un administrador revisará el caso."
    )
    for usuario_id in (reserva.cliente_id, _dueno_id(reserva)):
        avisos.avisar(db, reserva, usuario_id, "La entrega no quedó registrada", mensaje, correo=True)
    db.commit()


def resolver_no_presentaciones(db: Session, ahora: Optional[datetime] = None, forzar: bool = False) -> dict:
    """
    Decide las reservas confirmadas cuya hora de inicio ya pasó más la gracia y donde la entrega no
    empezó (ver el docstring del módulo). Cada reserva se resuelve aparte: si una falla se reintenta en
    la próxima pasada sin frenar las demás. Devuelve cuántas resolvió de cada tipo.
    """
    ahora = _ahora_de(ahora)
    resumen = {"arrendatario": 0, "dueno": 0, "ninguno": 0}

    if not forzar:
        cfg = db.query(ConfiguracionPlataforma).first()
        if cfg and not cfg.politica_no_presentacion_activa:
            logger.info("[POLITICA] Barrido de no presentación omitido por configuración (inactiva)")
            return resumen
    candidatas = (
        db.query(Reserva)
        .filter(
            Reserva.estado == "confirmada",
            # Solo reservas creadas bajo la política: en las anteriores nadie pudo confirmar su llegada.
            Reserva.confirmar_dueno_antes_de.isnot(None),
            Reserva.fecha_inicio <= ahora - timedelta(hours=HORAS_GRACIA_NO_PRESENTACION),
        )
        .with_for_update(skip_locked=True)
        .all()
    )
    for reserva in candidatas:
        reserva_id = reserva.id
        try:
            if _entrega_empezo(reserva) or _tiene_disputa_abierta(reserva):
                continue
            llego_cliente = reserva.llegada_cliente_en is not None
            llego_dueno = reserva.llegada_dueno_en is not None
            if llego_cliente and llego_dueno:
                if ahora >= _naive(reserva.fecha_inicio) + timedelta(hours=HORAS_ESCALAR_SIN_ENTREGA):
                    _escalar_sin_entrega(db, reserva)
                continue
            if llego_dueno:
                registrar_no_presentacion(db, reserva, ahora)
                resumen["arrendatario"] += 1
            elif llego_cliente:
                registrar_no_presentacion_del_dueno(db, reserva, ahora)
                resumen["dueno"] += 1
            else:
                cancelar_por_ausencia_de_ambos(db, reserva, ahora)
                resumen["ninguno"] += 1
        except Exception:  # noqa: BLE001 — una reserva mala no frena el barrido
            logger.exception("[NO_PRESENTACION] No se pudo resolver la reserva %s; se reintenta", reserva_id)
            db.rollback()
    return resumen


def reintentar_reembolsos_pendientes(db: Session) -> dict:
    """
    Reintenta reembolsos parciales o totales de cancelaciones que fallaron en la pasarela
    y quedaron en estado 'pendiente'. Devuelve cuántos se lograron y cuántos siguen pendientes.
    """
    pendientes = (
        db.query(Pago)
        .filter(
            Pago.tipo.in_(["reembolso_parcial", "reembolso_total"]),
            Pago.estado == "pendiente",
        )
        .all()
    )
    exitosos = 0
    fallidos = 0
    for pago in pendientes:
        if pago.referencia_pago:
            res = MercadoPagoService.reembolsar(pago.referencia_pago, pago.monto)
            if res.get("success"):
                pago.estado = "reembolsado"
                exitosos += 1
            else:
                fallidos += 1
                logger.warning("[REEMBOLSO_REINTENTO] Falló reintento de pago %s: %s", pago.id, res.get("error"))
        else:
            fallidos += 1
    if exitosos:
        db.commit()
    return {"reintentados": len(pendientes), "exitosos": exitosos, "pendientes": fallidos}
