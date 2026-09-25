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
    # La captura falló (red, pasarela): la garantía sigue retenida y el barrido reintenta.
    captura_pendiente: bool = False


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
        .order_by(Pago.timestamp.desc())
        .first()
    )


def _garantia_en_disputa(db: Session, reserva: Reserva) -> Optional[Pago]:
    """Garantía ya capturada entera al abrir una disputa, a la espera de la resolución."""
    return (
        _pagos_de(db, reserva)
        .filter(Pago.tipo == "hold_reserva", Pago.estado == "capturado_disputa")
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


def _anotar_extras(db: Session, reserva: Reserva, extras: int) -> None:
    """Los cargos de la devolución quedan como cargo pendiente para cobrarse más adelante."""
    if extras > 0:
        db.add(Pago(
            reserva_id=reserva.id, usuario_id=reserva.cliente_id, tipo="cargo_devolucion",
            monto=int(extras), estado="pendiente",
        ))
        db.flush()


def _repartir(db: Session, reserva: Reserva, cobrado: int, extras: int, pendientes: List[Pago],
              referencia: Optional[str]) -> None:
    """Reparte lo cobrado: primero los extras de la devolución, luego los cargos en orden."""
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


def asegurar_garantia_en_disputa(db: Session, reserva: Reserva, extras: int = 0) -> bool:
    """
    Al abrir una disputa se captura la garantía ENTERA y se guarda como
    `capturado_disputa`. Una retención dura pocos días y una disputa puede
    tardar semanas: si se esperaba a la resolución, la retención ya se había
    liberado sola y el dueño no cobraba los daños. Al resolver se cobra lo que
    corresponda y el resto se le devuelve al arrendatario (saldar_garantia).

    `True` si la garantía quedó asegurada. Si la captura falla, sigue retenida
    y el barrido lo reintenta.
    """
    _anotar_extras(db, reserva, max(0, int(extras or 0)))
    garantia = _garantia_retenida(db, reserva)
    if garantia is None:
        return _garantia_en_disputa(db, reserva) is not None
    if not _capturar(garantia, int(garantia.monto or 0)):
        return False
    garantia.estado = "capturado_disputa"
    db.flush()
    return True


def _saldar_desde_captura(db: Session, reserva: Reserva, garantia: Pago, extras: int,
                          pendientes: List[Pago], total: int) -> ResultadoGarantia:
    """Resuelve una garantía capturada en disputa: queda lo que se cobra, el resto se devuelve."""
    from app.features.payments import estado_pagos
    from app.features.payments.mercadopago_service import MercadoPagoService

    capturado = int(garantia.monto or 0)
    cobrado = min(total, capturado)
    devolver = capturado - cobrado
    devuelto = True
    if devolver > 0 and _es_real(garantia.referencia_pago):
        res = MercadoPagoService.reembolsar(garantia.referencia_pago, devolver)
        if not res.get("success"):
            logger.error("[CARGOS] No se pudo devolver %s de la garantía %s: %s",
                         devolver, garantia.referencia_pago, res.get("error"))
            estado_pagos.registrar_reembolso_pendiente(db, garantia, devolver, "reembolso_parcial")
            devuelto = False
    garantia.monto = cobrado
    garantia.estado = "reembolsado" if cobrado == 0 and devuelto else "capturado"
    _repartir(db, reserva, cobrado, extras, pendientes, garantia.referencia_pago)
    return ResultadoGarantia(
        cobrado=cobrado,
        extras_cobrados=min(extras, cobrado),
        sin_cubrir=total - cobrado,
        garantia_liberada=devolver > 0,
    )


def saldar_garantia(db: Session, reserva: Reserva, extras: int, cobrar: bool = True) -> ResultadoGarantia:
    """
    Cierra la garantía al devolver el auto (o al resolver una disputa).

    `extras` son los cargos calculados en la devolución (combustible, km,
    limpieza, atraso). Se suman a los cargos pendientes del arriendo y se
    capturan de la garantía hasta su monto; lo que sobra se libera (o se
    devuelve, si la garantía ya estaba capturada por una disputa).

    Con `cobrar=False` (se abre una disputa) la garantía se captura entera y
    los extras quedan como cargo pendiente: se resuelve después.
    """
    extras = max(0, int(extras or 0))
    if not cobrar:
        if not asegurar_garantia_en_disputa(db, reserva, extras):
            logger.error("[CARGOS] Reserva %s: no se pudo asegurar la garantía de la disputa; se reintenta.",
                         reserva.id)
        return ResultadoGarantia()

    pendientes = cargos_pendientes(db, reserva)
    total = extras + sum(int(p.monto or 0) for p in pendientes)

    en_disputa = _garantia_en_disputa(db, reserva)
    if en_disputa is not None:
        return _saldar_desde_captura(db, reserva, en_disputa, extras, pendientes, total)

    garantia = _garantia_retenida(db, reserva)
    if garantia is None:
        return ResultadoGarantia(sin_cubrir=total, garantia_liberada=False)

    if total <= 0:
        return ResultadoGarantia(garantia_liberada=liberar_garantia(garantia))

    a_capturar = min(total, int(garantia.monto or 0))
    if not _capturar(garantia, a_capturar):
        # Antes se soltaba la garantía y los cargos se perdían por un simple timeout.
        # Ahora sigue retenida, los extras quedan anotados y el barrido reintenta
        # (reintentar_garantias) hasta que se cobre o la retención venza.
        _anotar_extras(db, reserva, extras)
        return ResultadoGarantia(captura_pendiente=True)

    garantia.estado = "capturado"
    garantia.monto = a_capturar
    _repartir(db, reserva, a_capturar, extras, pendientes, garantia.referencia_pago)
    return ResultadoGarantia(
        cobrado=a_capturar,
        extras_cobrados=min(extras, a_capturar),
        sin_cubrir=total - a_capturar,
        garantia_liberada=a_capturar < int(reserva.monto_hold or 0),
    )


def reintentar_garantias(db: Session) -> Dict[str, int]:
    """
    Barrido de garantías que quedaron colgando:
      · disputas cuya garantía sigue retenida -> se captura entera;
      · arriendos finalizados con la garantía retenida -> se cobra lo pendiente
        (o se libera si no hay nada que cobrar), abonándole al dueño lo cobrado.
    Si la retención ya venció, se avisa a los admins con lo que quedó sin cobrar.
    """
    from app.features.payments import estado_pagos, garantia_renovacion

    from app.models.entities import ChecklistAuto

    resumen = {"disputas_aseguradas": 0, "cobradas": 0, "liberadas": 0, "vencidas": 0}
    ahora = garantia_renovacion._ahora()
    # Solo las disputas abiertas en la DEVOLUCIÓN (daños): una disputa previa al arriendo
    # (identidad que no coincide) no justifica cobrarle la garantía al arrendatario.
    devueltas = db.query(ChecklistAuto.reserva_id).filter(ChecklistAuto.tipo == "despues")
    retenidas = (
        db.query(Pago, Reserva)
        .join(Reserva, Reserva.id == Pago.reserva_id)
        .filter(Pago.tipo == "hold_reserva", Pago.estado == "retenido",
                Reserva.estado.in_(["disputada", "finalizada"]),
                Reserva.id.in_(devueltas))
        .all()
    )
    for garantia, reserva in retenidas:
        try:
            if garantia_renovacion.vence_en(garantia) <= ahora:
                pendientes = cargos_pendientes(db, reserva)
                sin_cobrar = sum(int(p.monto or 0) for p in pendientes)
                garantia.estado = "vencido"
                for cargo in pendientes:
                    cargo.estado = "fallido"
                resumen["vencidas"] += 1
                if sin_cobrar or reserva.estado == "disputada":
                    estado_pagos.avisar_admins(
                        db, "Garantía vencida sin cobrar",
                        (f"La garantía de la reserva ({reserva.estado}) se liberó sola en Mercado Pago "
                         f"antes de poder cobrarla. Quedaron ${sin_cobrar:,} CLP sin cobrar: evalúa un "
                         "cobro posterior a la tarjeta de crédito.").replace(",", "."),
                        reserva.id,
                    )
            elif reserva.estado == "disputada":
                if asegurar_garantia_en_disputa(db, reserva):
                    resumen["disputas_aseguradas"] += 1
            else:
                resultado = saldar_garantia(db, reserva, extras=0, cobrar=True)
                if resultado.cobrado > 0:
                    abono = abonar_al_dueno(db, reserva, resultado.cobrado)
                    reserva.liquidacion_dueno_clp = int(reserva.liquidacion_dueno_clp or 0) + resultado.cobrado
                    db.commit()
                    liquidar_sin_bloquear(db, abono)
                    resumen["cobradas"] += 1
                elif resultado.garantia_liberada:
                    resumen["liberadas"] += 1
            db.commit()
        except Exception:  # noqa: BLE001 — una reserva mala no frena el barrido
            db.rollback()
            logger.exception("[CARGOS] Falló el reintento de la garantía de la reserva %s", reserva.id)
    return resumen


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


def cobrar_a_tarjeta(
    db: Session, reserva: Reserva, tarjeta: Tarjeta, monto: int, ref: str, token_app: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Cobra `monto` a `tarjeta` (captura inmediata). Devuelve la respuesta de la pasarela.

    Un cobro que queda "en revisión" del banco se cancela y se informa como no
    autorizado: quien llama no lo registra, y si el banco lo aprobara después
    el cliente quedaría cobrado por algo que no recibió.
    """
    from app.features.payments import checkout_service

    cliente = db.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    if not cliente:
        raise CargoError(404, "Cliente no encontrado.")
    res = checkout_service._mover(
        tarjeta, cliente, int(monto), capturar=True, ref=ref, reserva=reserva, token_app=token_app,
    )
    if not res.get("autorizada") and checkout_service._en_revision(res):
        checkout_service._liberar(res.get("payment_id"))
        res = {**res, "detalle_estado": "en_revision_cancelado"}
    return res


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
