"""
Transferencias a la cuenta de cobro del dueño desde la cuenta BCI de la empresa.

La API de pagos masivos de BCI todavía no está disponible: por defecto
(`BCI_PAYOUTS_MOCK=True`) esto NO sale a la red y da las transferencias por
acreditadas. Convención de pruebas: número o RUT que termina en "0000" -> rechazo.

Cuando la API real exista: `BCI_PAYOUTS_MOCK=False` + `BCI_API_URL`/`BCI_API_KEY`
y completar `_transferir_real` / `_consultar_real` con httpx.
"""
import logging
import re
import uuid
from typing import Any, Dict

from app.core.config import settings

logger = logging.getLogger(__name__)

_PREFIJO_MOCK = "BCI-MOCK-"


def _es_rechazo_simulado(cuenta: Dict[str, Any]) -> bool:
    return re.sub(r"\D", "", str(cuenta.get("numero", ""))).endswith("0000") or \
        re.sub(r"\D", "", str(cuenta.get("rut", ""))).endswith("0000")


def transferir(cuenta: Dict[str, Any], monto: int, referencia: str) -> Dict[str, Any]:
    if settings.BCI_PAYOUTS_MOCK:
        if _es_rechazo_simulado(cuenta):
            logger.warning("[BCI MOCK] Transferencia rechazada (cuenta 0000) ref=%s", referencia)
            return {"ok": False, "transfer_id": None, "estado": "rechazada",
                    "detalle": "Cuenta de prueba rechazada (termina en 0000)."}
        tid = f"{_PREFIJO_MOCK}{uuid.uuid4().hex[:12].upper()}"
        logger.warning("[BCI MOCK] Transferencia acreditada ref=%s monto=%s id=%s",
                       referencia, monto, tid)
        return {"ok": True, "transfer_id": tid, "estado": "acreditada", "detalle": None}
    return _transferir_real(cuenta, monto, referencia)


def consultar_transferencia(transfer_id: str) -> Dict[str, Any]:
    if settings.BCI_PAYOUTS_MOCK or str(transfer_id).startswith(_PREFIJO_MOCK):
        return {"estado": "acreditada"}
    return _consultar_real(transfer_id)


def _transferir_real(cuenta: Dict[str, Any], monto: int, referencia: str) -> Dict[str, Any]:
    if not (settings.BCI_API_URL or "").strip() or not (settings.BCI_API_KEY or "").strip():
        raise NotImplementedError(
            "BCI_PAYOUTS_MOCK=False pero faltan BCI_API_URL / BCI_API_KEY. "
            "La integración real de pagos masivos BCI aún no está implementada."
        )
    # TODO: httpx.post(settings.BCI_API_URL + "/transferencias", ...)
    raise NotImplementedError("Integración real de pagos masivos BCI pendiente.")


def _consultar_real(transfer_id: str) -> Dict[str, Any]:
    raise NotImplementedError("Consulta real de transferencias BCI pendiente.")
