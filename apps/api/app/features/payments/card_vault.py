"""
Bóveda de tarjetas: alta / baja en Mercado Pago y tokenización para cobrar.

El usuario puede guardar varias tarjetas. Cada una vive en el `customer` del
usuario dentro de Mercado Pago; acá solo se guarda el `mp_card_id` y los datos
mínimos para que la reconozca. El número de la tarjeta nunca llega al backend:
la app tokeniza contra Mercado Pago y manda el `card_token` (de un solo uso).

Para cobrar o retener un hold sobre una tarjeta ya guardada se genera un
`card_token` nuevo desde el `mp_card_id` (`token_para_movimiento`), porque el
token que usó el alta ya se consumió.

Modo simulado (`pagos_simulados_activos()`): no se sale a la red. El tipo de
tarjeta (débito / crédito) y los últimos 4 dígitos se leen del propio token
falso `SIMULADO-DEBITO-1234` / `SIMULADO-CREDITO-1234`.
"""
import logging
import re
import uuid
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings
from app.services import pagos_simulados

logger = logging.getLogger(__name__)

API_BASE = "https://api.mercadopago.com"
TIMEOUT = 15.0

# Prefijo de los tokens falsos que genera la app sin llave pública de MP.
SIMULADO_RE = re.compile(r"^SIMULADO-(DEBITO|CREDITO)-(\d{2,4})$", re.IGNORECASE)

# `payment_type_id` de Mercado Pago -> nuestro `tipo`.
_TIPO_MP = {
    "credit_card": "credito",
    "debit_card": "debito",
    "prepaid_card": "debito",
}


class VaultError(Exception):
    """Falla de negocio al registrar / borrar una tarjeta. `codigo` es estable."""

    def __init__(self, codigo: str, mensaje: str, titular_detectado: Optional[str] = None):
        super().__init__(mensaje)
        self.codigo = codigo
        self.mensaje = mensaje
        self.titular_detectado = titular_detectado


# ===========================================================================
# Modo simulado
# ===========================================================================
def _tarjeta_desde_token_simulado(card_token: str, titular: Optional[str]) -> Dict[str, Any]:
    m = SIMULADO_RE.match(card_token or "")
    if not m:
        raise VaultError(
            "TARJETA_INVALIDA",
            "El token de la tarjeta no es válido. Vuelve a ingresarla.",
        )
    tipo = "debito" if m.group(1).upper() == "DEBITO" else "credito"
    ultimos4 = m.group(2).rjust(4, "0")[-4:]
    return {
        "mp_customer_id": f"SIM-CUST-{uuid.uuid4().hex[:12]}",
        "mp_card_id": f"SIM-CARD-{uuid.uuid4().hex[:12]}",
        "marca": "visa",
        "ultimos4": ultimos4,
        "vencimiento": "12/30",
        "tipo": tipo,
        "titular": (titular or "").strip() or None,
    }


# ===========================================================================
# Mercado Pago real
# ===========================================================================
def _headers(idempotency_key: Optional[str] = None) -> Dict[str, str]:
    headers = {
        "Authorization": f"Bearer {settings.MERCADOPAGO_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    if idempotency_key:
        headers["X-Idempotency-Key"] = idempotency_key
    return headers


def _pedir(metodo: str, ruta: str, **kwargs) -> Dict[str, Any]:
    """HTTP con manejo de error unificado. Devuelve `{success, data|error}`."""
    if not (settings.MERCADOPAGO_ACCESS_TOKEN or "").strip():
        return {"success": False, "error": "Mercado Pago no está configurado."}
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            resp = client.request(metodo, f"{API_BASE}{ruta}", headers=_headers(), **kwargs)
    except Exception as e:  # noqa: BLE001 — cualquier fallo de red es "no disponible"
        logger.error("[VAULT] Fallo de conexión en %s %s: %s", metodo, ruta, e)
        return {"success": False, "error": str(e)}
    if resp.status_code >= 400:
        logger.error("[VAULT] %s %s respondió %s: %s", metodo, ruta, resp.status_code, resp.text)
        return {"success": False, "error": resp.text, "status_code": resp.status_code}
    return {"success": True, "data": resp.json()}


def _asegurar_cliente(email: str, nombre: Optional[str], mp_customer_id: Optional[str]) -> str:
    """Devuelve el `customer_id` del usuario, creándolo o reusándolo."""
    if mp_customer_id:
        return mp_customer_id

    # Mercado Pago rechaza dos customers con el mismo email: si ya existe, se
    # reusa en vez de reventar.
    buscar = _pedir("GET", f"/v1/customers/search?email={email}")
    if buscar["success"]:
        resultados = (buscar["data"] or {}).get("results") or []
        if resultados:
            return resultados[0]["id"]

    crear = _pedir("POST", "/v1/customers", json={"email": email, "first_name": (nombre or "")[:255]})
    if not crear["success"]:
        raise VaultError("TARJETA_INVALIDA", "No pudimos abrir tu bóveda de tarjetas. Reintenta.")
    return crear["data"]["id"]


def _normalizar_tarjeta_mp(card: Dict[str, Any]) -> Dict[str, Any]:
    metodo = card.get("payment_method") or {}
    tipo = _TIPO_MP.get(metodo.get("payment_type_id"), None)
    mes = card.get("expiration_month")
    anio = card.get("expiration_year")
    vencimiento = f"{int(mes):02d}/{str(anio)[-2:]}" if mes and anio else None
    titular = ((card.get("cardholder") or {}).get("name") or "").strip() or None
    return {
        "mp_card_id": card.get("id"),
        "marca": (metodo.get("id") or metodo.get("name") or "otra").lower(),
        "ultimos4": card.get("last_four_digits"),
        "vencimiento": vencimiento,
        "tipo": tipo,          # puede venir None: lo resuelve quien llama
        "titular": titular,
    }


def registrar_tarjeta(
    email: str,
    nombre: Optional[str],
    card_token: str,
    payment_method_id: Optional[str] = None,
    mp_customer_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Guarda la tarjeta tokenizada en el vault del usuario.

    Devuelve `{mp_customer_id, mp_card_id, marca, ultimos4, vencimiento, tipo,
    titular}`. Lanza `VaultError` si el token es inválido o la pasarela falla.
    """
    if pagos_simulados.pagos_simulados_activos() and (card_token or "").upper().startswith("SIMULADO-"):
        return _tarjeta_desde_token_simulado(card_token, nombre)

    customer_id = _asegurar_cliente(email, nombre, mp_customer_id)

    cuerpo: Dict[str, Any] = {"token": card_token}
    if payment_method_id:
        cuerpo["payment_method_id"] = payment_method_id
    alta = _pedir("POST", f"/v1/customers/{customer_id}/cards", json=cuerpo)
    if not alta["success"]:
        raise VaultError("TARJETA_INVALIDA", "La tarjeta no se pudo validar con el banco. Prueba con otra.")

    datos = _normalizar_tarjeta_mp(alta["data"])
    datos["mp_customer_id"] = customer_id
    if not datos.get("tipo"):
        # Sin `payment_type_id` en la respuesta, se infiere del id del método
        # que mandó la app (la app ya distingue credit_card / debit_card).
        datos["tipo"] = "debito" if (payment_method_id or "").startswith("deb") else "credito"
    return datos


def eliminar_tarjeta(mp_customer_id: Optional[str], mp_card_id: Optional[str]) -> None:
    """Borra la tarjeta del vault. Silencioso si ya no existe o es simulada."""
    if not mp_customer_id or not mp_card_id:
        return
    if str(mp_customer_id).startswith("SIM-") or pagos_simulados.pagos_simulados_activos():
        return
    _pedir("DELETE", f"/v1/customers/{mp_customer_id}/cards/{mp_card_id}")


def token_para_movimiento(mp_customer_id: Optional[str], mp_card_id: Optional[str]) -> Optional[str]:
    """
    Genera un `card_token` nuevo (de un solo uso) desde una tarjeta guardada,
    para cobrar o retener un hold. En modo simulado devuelve un token falso.
    """
    if not mp_card_id or str(mp_card_id).startswith("SIM-") or pagos_simulados.pagos_simulados_activos():
        return f"SIMTOK-{uuid.uuid4().hex[:20]}"

    cuerpo = {"card_id": mp_card_id}
    if mp_customer_id:
        cuerpo["customer_id"] = mp_customer_id
    resp = _pedir("POST", "/v1/card_tokens", json=cuerpo)
    if not resp["success"]:
        return None
    return resp["data"].get("id")
