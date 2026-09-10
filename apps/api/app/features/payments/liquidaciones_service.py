"""
Pago automático de las liquidaciones a los dueños vía transferencia BCI.

Barre los Pago(tipo="liquidacion_dueno") en 'pendiente'/'fallido' cuyo dueño
tiene una cuenta de cobro predeterminada y los transfiere. Se dispara al cerrar
la devolución (intentar_liquidar) y desde un bucle de fondo periódico.

No-op salvo `settings.BCI_PAYOUTS_HABILITADO`. Nunca toca holds ni cobros.
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import Pago, Usuario
from app.features.payments import bci_payouts
from app.features.communications.notifications.service import crear_notificacion

logger = logging.getLogger(__name__)

MAX_INTENTOS_LIQUIDACION = 3


def _ahora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _cuenta_predeterminada(db: Session, usuario_id: str) -> Optional[dict]:
    u = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    cb = (u.cuenta_bancaria or {}) if u else {}
    return cb if cb.get("numero") else None


def _procesar_uno(db: Session, pago: Pago) -> str:
    """Devuelve 'pagada' | 'fallida' | 'sin_cuenta'."""
    cuenta = _cuenta_predeterminada(db, pago.usuario_id)
    if not cuenta:
        return "sin_cuenta"

    pago.estado = "procesando"
    db.commit()

    ref = f"LIQ-{pago.id[:8]}"
    try:
        r = bci_payouts.transferir(cuenta, int(pago.monto or 0), ref)
    except Exception as e:  # noqa: BLE001 — API real no implementada / caída
        logger.error("[LIQUIDACIONES] transferir() falló para %s: %s", pago.id, e)
        r = {"ok": False, "transfer_id": None, "estado": "error", "detalle": str(e)}

    if r.get("ok"):
        pago.estado = "pagado"
        pago.referencia_pago = r.get("transfer_id")
        pago.liquidado_en = _ahora()
        db.commit()
        _notificar_pagada(db, pago, cuenta)
        return "pagada"

    pago.estado = "fallido"
    pago.intentos_liquidacion = (pago.intentos_liquidacion or 0) + 1
    db.commit()
    if pago.intentos_liquidacion >= MAX_INTENTOS_LIQUIDACION:
        _notificar_fallo_final(db, pago)
    return "fallida"


def ejecutar_liquidaciones_pendientes(db: Session, ahora: Optional[datetime] = None) -> Dict[str, int]:
    resumen = {"intentadas": 0, "pagadas": 0, "fallidas": 0, "sin_cuenta": 0}
    if not settings.BCI_PAYOUTS_HABILITADO:
        return resumen

    candidatos = (
        db.query(Pago)
        .filter(
            Pago.tipo == "liquidacion_dueno",
            Pago.estado.in_(["pendiente", "fallido"]),
            Pago.monto >= settings.BCI_PAYOUT_MIN_CLP,
            Pago.intentos_liquidacion < MAX_INTENTOS_LIQUIDACION,
        )
        .all()
    )
    for pago in candidatos:
        resumen["intentadas"] += 1
        resultado = _procesar_uno(db, pago)
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
    crear_notificacion(
        db, usuario_id=pago.usuario_id, tipo="pago",
        titulo="No pudimos depositar tu liquidación",
        mensaje="Revisá los datos de tu cuenta de cobro en Ganancias. Nuestro equipo también fue avisado.",
        entidad_tipo="pago", entidad_id=pago.id, commit=False,
    )
    db.commit()
