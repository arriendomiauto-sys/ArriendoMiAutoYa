"""
Renovación de la garantía (hold) antes de que Mercado Pago la libere sola.

El hold se toma al pagar la reserva, pero un pago autorizado sin capturar
dura pocos días (`GARANTIA_HOLD_VALIDEZ_DIAS`). Si la reserva empieza (o
termina) después, el auto se entregaría sin garantía real. Por eso, poco
antes del vencimiento, se toma un hold nuevo sobre la misma tarjeta y recién
entonces se suelta el viejo: el arrendatario nunca queda sin garantía.

Para tomar el hold nuevo hace falta un `card_token`:
- el barrido lo intenta una vez generándolo sin CVV (solo funciona si la
  cuenta de Mercado Pago lo permite);
- si falla, se le pide al arrendatario que la renueve desde la app con su
  CVV (`POST /reservas/{id}/garantia/renovar`), y el barrido no reintenta.

Cada hold es su propia fila `Pago(tipo="hold_reserva")`: el viejo queda
"liberado" y el nuevo "retenido", así el historial dice cuándo se tomó cada uno.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import Pago, Reserva, Tarjeta, Usuario
from app.features.payments import checkout_service
from app.features.payments.mercadopago_service import MercadoPagoService
from app.services import pagos_simulados

logger = logging.getLogger(__name__)

# Reservas cuya garantía todavía respalda algo: pagada, confirmada, en curso o en disputa.
ESTADOS_CON_GARANTIA = ("pendiente", "confirmada", "en_curso", "disputada")

# La garantía tiene que seguir viva un rato después de la devolución: ahí se
# capturan los cargos (daños, combustible, atraso).
MARGEN_TRAS_DEVOLUCION = timedelta(days=1)


class RenovacionError(Exception):
    def __init__(self, http_status: int, codigo: str, mensaje: str):
        super().__init__(mensaje)
        self.http_status = http_status
        self.codigo = codigo
        self.mensaje = mensaje

    def as_detail(self) -> Dict[str, Any]:
        return {"codigo": self.codigo, "mensaje": self.mensaje, "campo": "garantia"}


def _naive(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is not None and dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _ahora() -> datetime:
    return datetime.utcnow()


def _zona_chile():
    # Sin base de zonas horarias (Windows sin `tzdata`) cae a UTC-3: el aviso es orientativo.
    try:
        return ZoneInfo("America/Santiago")
    except Exception:  # noqa: BLE001
        return timezone(timedelta(hours=-3))


def hold_vigente(db: Session, reserva: Reserva) -> Optional[Pago]:
    return (
        db.query(Pago)
        .filter(Pago.reserva_id == reserva.id, Pago.tipo == "hold_reserva", Pago.estado == "retenido")
        .order_by(Pago.timestamp.desc())
        .first()
    )


def vence_en(pago: Pago) -> datetime:
    return _naive(pago.timestamp) + timedelta(days=settings.GARANTIA_HOLD_VALIDEZ_DIAS)


def necesita_renovacion(reserva: Reserva, pago: Pago, ahora: Optional[datetime] = None) -> bool:
    """El hold vence antes de que termine el arriendo y ya estamos dentro del margen para renovarlo."""
    ahora = ahora or _ahora()
    vence = vence_en(pago)
    fin = _naive(reserva.fecha_fin)
    if fin is None or vence >= fin + MARGEN_TRAS_DEVOLUCION:
        return False
    return ahora >= vence - timedelta(hours=settings.GARANTIA_RENOVAR_ANTES_HORAS)


def resumen(db: Session, reserva: Reserva) -> Dict[str, Any]:
    """Para la app: cuándo vence la garantía y si hay que renovarla con el CVV."""
    pago = hold_vigente(db, reserva)
    return {
        "vence_en": vence_en(pago).isoformat() if pago else None,
        "por_renovar": bool(reserva.garantia_renovacion_pedida_en) and reserva.estado in ESTADOS_CON_GARANTIA,
    }


def renovar(db: Session, reserva: Reserva, token_app: Optional[str] = None,
            ahora: Optional[datetime] = None) -> Pago:
    """
    Toma un hold nuevo por el mismo monto y suelta el viejo. Lanza
    `RenovacionError` si Mercado Pago no lo autoriza (el viejo sigue intacto).

    Idempotente: si la garantía vigente no necesita renovarse (ya se renovó,
    p. ej. un doble toque o el barrido y la app a la vez), la devuelve tal
    cual sin tomar otro hold en la tarjeta.
    """
    # Fila bloqueada hasta el commit: el barrido y la app no renuevan a la vez.
    db.query(Reserva).filter(Reserva.id == reserva.id).populate_existing().with_for_update().first()
    viejo = hold_vigente(db, reserva)
    if not viejo:
        raise RenovacionError(409, "SIN_GARANTIA", "Esta reserva no tiene una garantía retenida.")
    if not reserva.garantia_renovacion_pedida_en and not necesita_renovacion(reserva, viejo, ahora):
        return viejo
    tarjeta = db.query(Tarjeta).filter(Tarjeta.id == reserva.tarjeta_garantia_id).first()
    usuario = db.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    if not tarjeta or not usuario:
        raise RenovacionError(409, "SIN_TARJETA", "No encontramos la tarjeta de la garantía.")

    ref = f"HOLD-R-{reserva.id[:8]}-{uuid.uuid4().hex[:6]}"
    res = checkout_service._mover(
        tarjeta, usuario, int(viejo.monto), capturar=False, ref=ref, token_app=token_app, reserva=reserva,
    )
    if not res.get("autorizada"):
        if checkout_service._en_revision(res):
            checkout_service._liberar(res.get("payment_id"))
        if checkout_service._cvv_rechazado(res):
            raise RenovacionError(402, "CVV_INVALIDO", "El código de seguridad de tu tarjeta de crédito es incorrecto.")
        raise RenovacionError(402, "SIN_CUPO", "Tu tarjeta de crédito no tiene cupo para renovar la garantía.")

    nuevo = Pago(
        reserva_id=reserva.id,
        usuario_id=usuario.id,
        tipo="hold_reserva",
        monto=int(viejo.monto),
        estado="retenido",
        referencia_pago=str(res.get("payment_id")) if res.get("payment_id") else None,
    )
    db.add(nuevo)
    viejo.estado = "liberado"
    reserva.garantia_renovacion_pedida_en = None
    db.commit()

    # Recién con el nuevo a salvo se suelta el viejo. Si falla, igual vence solo.
    ref_vieja = viejo.referencia_pago
    if ref_vieja and not pagos_simulados.es_pago_simulado(ref_vieja):
        suelto = MercadoPagoService.liberar_hold(ref_vieja)
        if not suelto.get("success"):
            logger.error("[GARANTIA] No se pudo soltar el hold anterior %s de la reserva %s: %s",
                         ref_vieja, reserva.id, suelto.get("error"))
    logger.info("[GARANTIA] Reserva %s: garantía renovada (%s -> %s)", reserva.id, ref_vieja, nuevo.referencia_pago)
    return nuevo


def renovar_garantias_por_vencer(db: Session, ahora: Optional[datetime] = None) -> Dict[str, int]:
    """
    Una pasada del barrido. Intenta renovar sin CVV las garantías que están por
    vencer; si no se puede, le pide al arrendatario que lo haga desde la app
    (una sola vez: después ya no se reintenta sin CVV).
    """
    from app.features.bookings.reservations import avisos

    ahora = ahora or _ahora()
    resultado = {"renovadas": 0, "pedidas": 0}
    reservas = db.query(Reserva).filter(Reserva.estado.in_(ESTADOS_CON_GARANTIA)).all()
    for reserva in reservas:
        pago = hold_vigente(db, reserva)
        if not pago or not necesita_renovacion(reserva, pago, ahora):
            continue
        if pagos_simulados.es_pago_simulado(pago.referencia_pago) and not pagos_simulados.pagos_simulados_activos():
            # Garantía de datos de prueba (seed/QA) con la pasarela real: no hay nada que renovar
            # ni a quién pedirle el CVV.
            continue
        if reserva.garantia_renovacion_pedida_en:
            # Ya se le pidió: solo el arrendatario (con su CVV) puede renovarla.
            if vence_en(pago) <= ahora:
                logger.error("[GARANTIA] Reserva %s (%s): la garantía venció sin renovarse.",
                             reserva.id, reserva.estado)
            continue
        try:
            renovar(db, reserva, ahora=ahora)
            resultado["renovadas"] += 1
            continue
        except RenovacionError as e:
            logger.warning("[GARANTIA] Reserva %s: no se pudo renovar sin CVV (%s).", reserva.id, e.codigo)
        except Exception:  # noqa: BLE001 — una reserva rota no frena el barrido
            db.rollback()
            logger.exception("[GARANTIA] Reserva %s: error al renovar la garantía.", reserva.id)

        reserva.garantia_renovacion_pedida_en = ahora
        vence = vence_en(pago).replace(tzinfo=timezone.utc).astimezone(_zona_chile())
        avisos.avisar(
            db, reserva, reserva.cliente_id, "Renueva tu garantía",
            f"La retención de tu garantía vence el {vence:%d-%m} a las {vence:%H:%M}, antes de que termine tu "
            "arriendo. Entra a tu reserva y confirma el código de seguridad de tu tarjeta para renovarla; "
            "sin garantía vigente no se puede entregar el auto.",
            correo=True, tipo="pago",
        )
        db.commit()
        resultado["pedidas"] += 1
    return resultado
