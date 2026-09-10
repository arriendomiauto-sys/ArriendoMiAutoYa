"""
Pago automático de las liquidaciones a los dueños vía transferencia BCI.

Barre los Pago(tipo="liquidacion_dueno") en 'pendiente'/'fallido'/'procesando'
cuyo dueño tiene una cuenta de cobro predeterminada y los transfiere. Se dispara
al cerrar la devolución (intentar_liquidar) y desde un bucle de fondo periódico.

No-op salvo `settings.BCI_PAYOUTS_HABILITADO`. Nunca toca holds ni cobros.

El barrido corre en paralelo (loop de fondo + POST /admin/liquidaciones/ejecutar),
así que el "claim" de cada fila es un UPDATE atómico con compare-and-set: dos
barridos simultáneos jamás transfieren la misma fila dos veces (camino de plata).
"""
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import String, cast, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import Pago, Usuario
from app.features.payments import bci_payouts
from app.features.communications.notifications.service import crear_notificacion

logger = logging.getLogger(__name__)

MAX_INTENTOS_LIQUIDACION = 3

_ESTADOS_BARRIDO = ["pendiente", "fallido", "procesando"]


def _ahora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _cuenta_predeterminada(db: Session, usuario_id: str) -> Optional[dict]:
    u = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    cb = (u.cuenta_bancaria or {}) if u else {}
    return cb if cb.get("numero") else None


def _claim(db: Session, pago_id: str, estado_previo: str) -> bool:
    """Compare-and-set atómico: reclama la fila para este barrido.

    Devuelve True solo si ESTE proceso pasó la fila de `estado_previo` a
    'procesando'. Si otro barrido ya la tomó, rowcount == 0 -> False.
    Funciona igual en SQLite y Postgres.
    """
    rc = db.execute(
        text(
            "UPDATE pagos SET estado='procesando' "
            "WHERE id=:id AND estado=:prev"
        ),
        {"id": pago_id, "prev": estado_previo},
    ).rowcount
    db.commit()
    return rc == 1


def _marcar_fallido(db: Session, pago: Pago) -> str:
    pago.estado = "fallido"
    pago.intentos_liquidacion = (pago.intentos_liquidacion or 0) + 1
    db.commit()
    if pago.intentos_liquidacion >= MAX_INTENTOS_LIQUIDACION:
        _notificar_fallo_final(db, pago)
    return "fallida"


def _marcar_pagado(db: Session, pago: Pago, cuenta: dict, transfer_id: Optional[str]) -> str:
    pago.estado = "pagado"
    if transfer_id:
        pago.referencia_pago = transfer_id
    pago.liquidado_en = pago.liquidado_en or _ahora()
    db.commit()
    _notificar_pagada(db, pago, cuenta)
    return "pagada"


def _reconciliar_procesando(db: Session, pago: Pago, cuenta: dict) -> Optional[str]:
    """Fila 'procesando' huérfana (proceso muerto entre el claim y el resultado).

    Con transfer_id -> se consulta el estado real en BCI. Sin transfer_id ->
    devuelve None para que el llamador la re-transfiera bajo un claim nuevo.
    """
    if pago.referencia_pago:
        try:
            estado = (bci_payouts.consultar_transferencia(pago.referencia_pago) or {}).get("estado")
        except Exception as e:  # noqa: BLE001
            logger.error("[LIQUIDACIONES] consultar_transferencia falló para %s: %s", pago.id, e)
            return "omitida"
        if estado == "acreditada":
            return _marcar_pagado(db, pago, cuenta, pago.referencia_pago)
        if estado == "rechazada":
            return _marcar_fallido(db, pago)
        return "omitida"  # sigue en proceso: no la contamos
    return None


def _procesar_uno(db: Session, pago: Pago) -> str:
    """Devuelve 'pagada' | 'fallida' | 'sin_cuenta' | 'omitida'."""
    cuenta = _cuenta_predeterminada(db, pago.usuario_id)
    if not cuenta:
        return "sin_cuenta"

    estado_previo = pago.estado
    if estado_previo == "procesando":
        resuelto = _reconciliar_procesando(db, pago, cuenta)
        if resuelto is not None:
            return resuelto
        # sin referencia_pago: re-transferir bajo un claim nuevo

    if not _claim(db, pago.id, estado_previo):
        return "omitida"  # otro barrido ya la tomó
    db.refresh(pago)

    ref = f"LIQ-{pago.id[:8]}"
    try:
        r = bci_payouts.transferir(cuenta, int(pago.monto or 0), ref)
    except Exception as e:  # noqa: BLE001 — API real no implementada / caída
        logger.error("[LIQUIDACIONES] transferir() falló para %s: %s", pago.id, e)
        r = {"ok": False, "transfer_id": None, "estado": "error", "detalle": str(e)}

    if r.get("ok"):
        return _marcar_pagado(db, pago, cuenta, r.get("transfer_id"))
    return _marcar_fallido(db, pago)


def ejecutar_liquidaciones_pendientes(db: Session, ahora: Optional[datetime] = None) -> Dict[str, int]:
    resumen = {"intentadas": 0, "pagadas": 0, "fallidas": 0, "sin_cuenta": 0}
    if not settings.BCI_PAYOUTS_HABILITADO:
        return resumen

    candidatos = (
        db.query(Pago)
        .filter(
            Pago.tipo == "liquidacion_dueno",
            Pago.estado.in_(_ESTADOS_BARRIDO),
            Pago.monto >= settings.BCI_PAYOUT_MIN_CLP,
            Pago.intentos_liquidacion < MAX_INTENTOS_LIQUIDACION,
        )
        .all()
    )
    for pago in candidatos:
        pago_id = pago.id
        try:
            resultado = _procesar_uno(db, pago)
        except Exception:  # noqa: BLE001 — un pago malo no aborta el barrido
            logger.exception("[LIQUIDACIONES] error procesando pago %s", pago_id)
            db.rollback()
            resumen["intentadas"] += 1
            resumen["fallidas"] += 1
            continue
        if resultado == "omitida":
            continue
        resumen["intentadas"] += 1
        if resultado == "pagada":
            resumen["pagadas"] += 1
        elif resultado == "fallida":
            resumen["fallidas"] += 1
        else:
            resumen["sin_cuenta"] += 1
    if resumen["intentadas"]:
        logger.info("[LIQUIDACIONES] %s", resumen)
    return resumen


def intentar_liquidar(db: Session, pago: Pago) -> None:
    """Best-effort para un pago recién creado (delivery). Nunca propaga."""
    if not settings.BCI_PAYOUTS_HABILITADO:
        return
    try:
        if pago.tipo == "liquidacion_dueno" and pago.estado == "pendiente" \
                and int(pago.monto or 0) >= settings.BCI_PAYOUT_MIN_CLP:
            _procesar_uno(db, pago)
    except Exception as e:  # noqa: BLE001
        logger.error("[LIQUIDACIONES] intentar_liquidar falló para %s: %s", pago.id, e)


def _admins(db: Session) -> List[Usuario]:
    return (
        db.query(Usuario)
        .filter(cast(Usuario.roles_activos, String).ilike('%"admin"%'))
        .all()
    )


def _notificar_pagada(db: Session, pago: Pago, cuenta: dict) -> None:
    ult4 = str(cuenta.get("numero", ""))[-4:]
    crear_notificacion(
        db, usuario_id=pago.usuario_id, tipo="pago",
        titulo="Depósito enviado",
        mensaje=f"Depositamos ${int(pago.monto or 0):,} CLP en tu cuenta {cuenta.get('banco','')} ····{ult4}.".replace(",", "."),
        entidad_tipo="pago", entidad_id=pago.id, commit=False,
    )
    db.commit()


def _notificar_fallo_final(db: Session, pago: Pago) -> None:
    logger.error(
        "[LIQUIDACIONES] Fallo final de liquidación %s (dueño %s, monto %s) "
        "tras %s intentos — requiere revisión manual",
        pago.id, pago.usuario_id, pago.monto, pago.intentos_liquidacion,
    )
    crear_notificacion(
        db, usuario_id=pago.usuario_id, tipo="pago",
        titulo="No pudimos depositar tu liquidación",
        mensaje="Revisá los datos de tu cuenta de cobro en Ganancias. Nuestro equipo también fue avisado.",
        entidad_tipo="pago", entidad_id=pago.id, commit=False,
    )
    for admin in _admins(db):
        crear_notificacion(
            db, usuario_id=admin.id, tipo="pago",
            titulo="Liquidación a dueño falló definitivamente",
            mensaje=(
                f"El pago {pago.id} al dueño {pago.usuario_id} por "
                f"${int(pago.monto or 0):,} CLP falló {pago.intentos_liquidacion} veces. "
                "Requiere revisión manual."
            ).replace(",", "."),
            entidad_tipo="pago", entidad_id=pago.id, commit=False,
        )
    db.commit()
