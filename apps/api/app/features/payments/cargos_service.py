"""
Cobro de los cargos del arriendo que son del dueño: combustible, kilómetros,
limpieza, atraso, multas y penalización GPS, más los cobros posteriores.

Decisión de negocio (2026-09-20, BUG-023/024/033/034): ese dinero es del dueño
(100 %, sin comisión) y hay que cobrárselo de verdad al arrendatario.

  · Lo ligado al arriendo se descuenta de la **garantía**: una sola captura
    parcial al devolver (una autorización solo se captura una vez; Mercado Pago
    libera el resto solo), con **tope en el monto de la garantía**. Lo que pasa
    de ahí no se cobra en silencio a una tarjeta: se registra como no cobrado.
  · Una multa o cargo ya con la devolución cerrada y un cobro posterior
    (peaje, TAG, multa de tránsito) se cobran a la tarjeta de crédito, también
    con tope en la garantía.
  · Al dueño solo se le abona lo que efectivamente se cobró.

Un cargo aplicado durante el arriendo nace `pendiente` (un `Pago` `cargo_*` sin
referencia de pasarela) y se salda al devolver.
"""
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.entities import Pago, Reserva, Tarjeta, Usuario
from app.services import pagos_simulados

logger = logging.getLogger(__name__)

_PREFIJO_CARGO = "cargo\\_%"
_PREFIJO_POSTERIOR = "cobro\\_posterior\\_%"


class CargoError(Exception):
    """Un cargo que no se puede aplicar. `http_status` y `mensaje` estables."""

    def __init__(self, http_status: int, mensaje: str):
        super().__init__(mensaje)
        self.http_status = http_status
        self.mensaje = mensaje


@dataclass
class ResultadoGarantia:
    """Qué pasó con la garantía al cerrar la devolución."""
    cobrado: int = 0          # CLP capturados de la garantía
    extras_cobrados: int = 0  # parte de `cobrado` que corresponde a los extras de la devolución
    sin_cubrir: int = 0       # CLP que se debían y no se pudieron cobrar
    garantia_liberada: bool = False


# ===========================================================================
# Consultas
# ===========================================================================
def _pagos_de(db: Session, reserva: Reserva):
    return db.query(Pago).filter(Pago.reserva_id == reserva.id)


def cargos_pendientes(db: Session, reserva: Reserva) -> List[Pago]:
    """Cargos (`cargo_*`) aplicados durante el arriendo que aún no se cobran."""
    return (
        _pagos_de(db, reserva)
        .filter(Pago.tipo.like(_PREFIJO_CARGO, escape="\\"), Pago.estado == "pendiente")
        .order_by(Pago.timestamp, Pago.id)
        .all()
    )


def _garantia_retenida(db: Session, reserva: Reserva) -> Optional[Pago]:
    return (
        _pagos_de(db, reserva)
        .filter(Pago.tipo == "hold_reserva", Pago.estado == "retenido")
        .first()
    )


def garantia_total(db: Session, reserva: Reserva) -> int:
    """
    Monto de la garantía de la reserva. Las reservas de hoy lo traen en `monto_hold`; si no
    (datos antiguos), se usa el fijo de la categoría del auto, el mismo que se retiene al pagar.
    """
    monto = int(reserva.monto_hold or 0)
    if monto > 0:
        return monto
    from app.models.entities import Auto
    from app.features.payments import checkout_service
    from app.features.vehicles.catalog.pricing_service import PricingService

    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    return checkout_service.monto_garantia_auto(PricingService.obtener_configuracion(db), auto)


def tope_disponible(db: Session, reserva: Reserva) -> int:
    """Cuánto de la garantía de la reserva aún se puede cargar (CLP, nunca negativo)."""
    pagos = _pagos_de(db, reserva).all()
    refs_garantia = {p.referencia_pago for p in pagos if p.tipo == "hold_reserva" and p.referencia_pago}
    comprometido = 0
    for p in pagos:
        monto = int(p.monto or 0)
        if p.tipo == "hold_reserva":
            if p.estado == "capturado":
                comprometido += monto
        elif p.tipo.startswith("cargo_"):
            # Un cargo ya saldado con la garantía está contado en el `hold_reserva` capturado.
            if p.estado == "pendiente" or (p.estado == "capturado" and p.referencia_pago not in refs_garantia):
                comprometido += monto
        elif p.tipo.startswith("cobro_posterior_") and p.estado == "capturado":
            comprometido += monto
    return max(0, garantia_total(db, reserva) - comprometido)


def validar_tope(db: Session, reserva: Reserva, monto: int) -> None:
    """Rechaza (400) un cargo que, sumado a los anteriores, supera la garantía."""
    disponible = tope_disponible(db, reserva)
    if monto > disponible:
        raise CargoError(
            400,
            f"El cargo de ${monto:,} supera lo que queda de la garantía (${disponible:,}). "
            "Para un monto mayor abre una disputa.".replace(",", "."),
        )


# ===========================================================================
# Cargos durante el arriendo
# ===========================================================================
def registrar_cargo_pendiente(db: Session, reserva: Reserva, tipo_pago: str, monto: int) -> Pago:
    """Anota un cargo que se saldará contra la garantía al devolver el auto."""
    validar_tope(db, reserva, int(monto))
    pago = Pago(
        reserva_id=reserva.id,
        usuario_id=reserva.cliente_id,
        tipo=tipo_pago,
        monto=int(monto),
        estado="pendiente",
    )
    db.add(pago)
    db.flush()
    return pago


# ===========================================================================
# Garantía: captura parcial o liberación al devolver
# ===========================================================================
def _es_real(referencia: Optional[str]) -> bool:
    return bool(referencia) and not pagos_simulados.es_pago_simulado(referencia)


def _capturar(garantia: Pago, monto: int) -> bool:
    """Captura `monto` de la garantía; Mercado Pago libera el resto solo."""
    if not _es_real(garantia.referencia_pago):
        return True
    from app.features.payments.mercadopago_service import MercadoPagoService

    try:
        res = MercadoPagoService.capturar_pago(garantia.referencia_pago, monto)
    except Exception as e:  # noqa: BLE001
        logger.error("[CARGOS] Falló la captura de la garantía %s: %s", garantia.referencia_pago, e)
        return False
    if not (res.get("success") and res.get("capturado")):
        logger.error("[CARGOS] La pasarela no capturó la garantía %s: %s", garantia.referencia_pago, res)
        return False
    return True


def liberar_garantia(garantia: Pago) -> bool:
    """Suelta la garantía sin cobrarla. Solo la marca `liberado` si la pasarela lo confirmó."""
    if _es_real(garantia.referencia_pago):
        from app.features.payments.mercadopago_service import MercadoPagoService

        try:
            res = MercadoPagoService.liberar_hold(garantia.referencia_pago)
        except Exception as e:  # noqa: BLE001
            logger.error("[CARGOS] Error al liberar la garantía %s: %s", garantia.referencia_pago, e)
            return False
        if not res.get("success", True):
            logger.error("[CARGOS] La pasarela no liberó la garantía %s: %s", garantia.referencia_pago, res)
            return False
    garantia.estado = "liberado"
    return True


def saldar_garantia(db: Session, reserva: Reserva, extras: int, cobrar: bool = True) -> ResultadoGarantia:
    """
    Cierra la garantía al devolver el auto.

    `extras` son los cargos calculados en la devolución (combustible, km,
    limpieza, atraso). Se suman a los cargos pendientes del arriendo y se
    capturan de la garantía hasta su monto; lo que sobra de la garantía se
    libera. Con `cobrar=False` (hay disputa) no se toca nada.
    """
    extras = max(0, int(extras or 0))
    pendientes = cargos_pendientes(db, reserva)
    total = extras + sum(int(p.monto or 0) for p in pendientes)
    garantia = _garantia_retenida(db, reserva)

    if not cobrar or garantia is None:
        return ResultadoGarantia(sin_cubrir=total if cobrar else 0, garantia_liberada=False)

    if total <= 0:
        return ResultadoGarantia(garantia_liberada=liberar_garantia(garantia))

    a_capturar = min(total, int(garantia.monto or 0))
    referencia = garantia.referencia_pago
    if _capturar(garantia, a_capturar):
        garantia.estado = "capturado"
        garantia.monto = a_capturar
        cobrado = a_capturar
    else:
        # Sin captura no hay dinero cobrado: se suelta la garantía para no dejarle
        # el cupo bloqueado al arrendatario, y el dueño no recibe lo no cobrado.
        cobrado = 0
        liberar_garantia(garantia)

    # Reparto de lo cobrado: primero los extras de la devolución, luego los cargos en orden.
    restante = max(0, cobrado - extras)
    for cargo in pendientes:
        monto = int(cargo.monto or 0)
        cubierto = min(monto, restante)
        restante -= cubierto
        if cubierto == monto:
            cargo.estado = "capturado"
            cargo.referencia_pago = referencia
        elif cubierto > 0:
            cargo.monto = cubierto
            cargo.estado = "capturado"
            cargo.referencia_pago = referencia
            db.add(Pago(
                reserva_id=reserva.id, usuario_id=cargo.usuario_id, tipo=cargo.tipo,
                monto=monto - cubierto, estado="fallido",
            ))
        else:
            cargo.estado = "fallido"
    db.flush()

    return ResultadoGarantia(
        cobrado=cobrado,
        extras_cobrados=min(extras, cobrado),
        sin_cubrir=total - cobrado,
        garantia_liberada=garantia.estado == "liberado" or cobrado < int(reserva.monto_hold or 0),
    )


# ===========================================================================
# Cobros a tarjeta (con la devolución ya cerrada, o al extender)
# ===========================================================================
def tarjeta_de_credito(db: Session, reserva: Reserva) -> Optional[Tarjeta]:
    """La tarjeta de crédito del arrendatario: la de la garantía o, si no, cualquier crédito validado."""
    tarjeta = None
    if reserva.tarjeta_garantia_id:
        tarjeta = db.query(Tarjeta).filter(Tarjeta.id == reserva.tarjeta_garantia_id).first()
    if not tarjeta:
        tarjeta = (
            db.query(Tarjeta)
            .filter(Tarjeta.usuario_id == reserva.cliente_id, Tarjeta.tipo == "credito", Tarjeta.estado == "validada")
            .first()
        )
    return tarjeta


def tarjeta_del_cobro(db: Session, reserva: Reserva) -> Optional[Tarjeta]:
    """La tarjeta con la que se pagó el arriendo."""
    if not reserva.tarjeta_cobro_id:
        return None
    return db.query(Tarjeta).filter(Tarjeta.id == reserva.tarjeta_cobro_id).first()


def cobrar_a_tarjeta(db: Session, reserva: Reserva, tarjeta: Tarjeta, monto: int, ref: str) -> Dict[str, Any]:
    """Cobra `monto` a `tarjeta` (captura inmediata). Devuelve la respuesta de la pasarela."""
    from app.features.payments import checkout_service

    cliente = db.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    if not cliente:
        raise CargoError(404, "Cliente no encontrado.")
    return checkout_service._mover(tarjeta, cliente, int(monto), capturar=True, ref=ref, reserva=reserva)


def abonar_al_dueno(db: Session, reserva: Reserva, monto: int) -> Optional[Pago]:
    """Deja pendiente de liquidar al dueño lo que se cobró a su favor (100 %, sin comisión)."""
    from app.models.entities import Auto

    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    if not auto or not auto.dueno_id:
        return None
    abono = Pago(
        reserva_id=reserva.id, usuario_id=auto.dueno_id, tipo="liquidacion_dueno",
        monto=int(monto), estado="pendiente",
    )
    db.add(abono)
    db.flush()
    return abono


def liquidar_sin_bloquear(db: Session, abono: Optional[Pago]) -> None:
    """Enganche con el depósito automático al dueño: best-effort, nunca bloquea."""
    if abono is None:
        return
    try:
        from app.features.payments import liquidaciones_service

        liquidaciones_service.intentar_liquidar(db, abono)
    except Exception:  # noqa: BLE001
        logger.exception("[CARGOS] intentar_liquidar falló (no bloqueante)")


def cobrar_cargo_a_tarjeta_de_credito(
    db: Session, reserva: Reserva, tipo_pago: str, monto: int, pago_id: Optional[str] = None, prefijo_ref: str = "POST"
) -> tuple:
    """
    Cobra un cargo con la devolución ya cerrada (no queda garantía retenida): va a la
    tarjeta de crédito del arrendatario, con tope en la garantía de la reserva, y lo
    cobrado se le abona al dueño. Devuelve `(pago, abono_al_dueno)`; quien llama hace el commit y
    después `liquidar_sin_bloquear(db, abono)`. Lanza `CargoError` (400 tope, 422 sin tarjeta, 402 rechazo).
    """
    import uuid

    monto = int(monto)
    validar_tope(db, reserva, monto)
    tarjeta = tarjeta_de_credito(db, reserva)
    if not tarjeta:
        raise CargoError(
            422, "El arrendatario no cuenta con una tarjeta de crédito activa en la bóveda para procesar este cobro."
        )

    pago_id = pago_id or str(uuid.uuid4())
    ref = f"{prefijo_ref}-{pago_id}"
    resultado = cobrar_a_tarjeta(db, reserva, tarjeta, monto, ref)
    if not resultado.get("autorizada"):
        motivo = resultado.get("detalle_estado") or "Cobro rechazado por la pasarela"
        raise CargoError(402, f"No se pudo procesar el cobro posterior en la tarjeta de crédito ({motivo}).")

    pago = Pago(
        id=pago_id, reserva_id=reserva.id, usuario_id=reserva.cliente_id, tipo=tipo_pago,
        monto=monto, estado="capturado", referencia_pago=str(resultado.get("payment_id") or ref),
    )
    db.add(pago)
    db.flush()
    abono = abonar_al_dueno(db, reserva, monto)
    return pago, abono
