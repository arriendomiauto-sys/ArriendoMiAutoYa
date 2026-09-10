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
import json
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


_MARCAS_OK = {"visa", "mastercard", "amex", "diners", "magna", "otra"}

# Correo de "cliente" que se manda a Mercado Pago con `MERCADOPAGO_TEST_MODE`
# encendido: en sandbox MP rechaza / ensucia el entorno con el correo real del
# usuario, así que se usa uno ficticio (mismo criterio que el `payer` de
# `mercadopago_service`).
_EMAIL_PRUEBA = "test@test.com"


def _en_modo_prueba() -> bool:
    return bool(getattr(settings, "MERCADOPAGO_TEST_MODE", True))


def _tarjeta_desde_token_simulado(
    card_token: str,
    titular: Optional[str],
    tipo_hint: Optional[str] = None,
    ultimos4_hint: Optional[str] = None,
    marca_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Arma la tarjeta sin salir a la red. Cubre dos casos:

    - Token falso `SIMULADO-DEBITO-1234` / `SIMULADO-CREDITO-1234`: el tipo y los
      últimos 4 se leen del propio token.
    - Token REAL de una llave `TEST-` de Mercado Pago mientras el backend está en
      modo simulado (no hay `MERCADOPAGO_ACCESS_TOKEN`): no se puede consultar la
      tarjeta en MP, así que se usa lo que la app detectó/eligió (`*_hint`).
    """
    m = SIMULADO_RE.match(card_token or "")
    if m:
        tipo = "debito" if m.group(1).upper() == "DEBITO" else "credito"
        ultimos4 = m.group(2).rjust(4, "0")[-4:]
    else:
        tipo = tipo_hint if tipo_hint in ("credito", "debito") else None
        ultimos4 = re.sub(r"\D", "", ultimos4_hint or "")[-4:] or None

    if tipo not in ("credito", "debito"):
        raise VaultError(
            "TARJETA_TIPO_DESCONOCIDO",
            "No pudimos determinar si la tarjeta es de crédito o débito. "
            "Elige el tipo y vuelve a intentarlo.",
        )

    marca = (marca_hint or "").strip().lower()
    return {
        "mp_customer_id": f"SIM-CUST-{uuid.uuid4().hex[:12]}",
        "mp_card_id": f"SIM-CARD-{uuid.uuid4().hex[:12]}",
        "marca": marca if marca in _MARCAS_OK else "visa",
        "ultimos4": ultimos4 or "0000",
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
    if _en_modo_prueba():
        # En sandbox el customer real (de producción) no existe bajo credenciales
        # `TEST-` y MP no quiere el correo real: se resuelve siempre contra el
        # correo de prueba.
        email = _EMAIL_PRUEBA
        mp_customer_id = None

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
    tipo_hint: Optional[str] = None,
    ultimos4_hint: Optional[str] = None,
    marca_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Guarda la tarjeta tokenizada en el vault del usuario.

    Devuelve `{mp_customer_id, mp_card_id, marca, ultimos4, vencimiento, tipo,
    titular}`. Lanza `VaultError` si el token es inválido o la pasarela falla.

    En modo simulado NUNCA se contacta a Mercado Pago — ni con un token real de
    una llave `TEST-`: sin `MERCADOPAGO_ACCESS_TOKEN` no hay a quién preguntarle,
    así que se arma la tarjeta con lo que detectó/eligió la app. Un token falso
    `SIMULADO-...` fuerza el camino simulado aunque el flag esté apagado (solo la
    app local lo genera y no hay nada real que hacer con él).
    """
    token_falso = (card_token or "").upper().startswith("SIMULADO-")
    if token_falso or pagos_simulados.pagos_simulados_activos():
        return _tarjeta_desde_token_simulado(
            card_token, nombre, tipo_hint, ultimos4_hint, marca_hint
        )

    customer_id = _asegurar_cliente(email, nombre, mp_customer_id)

    cuerpo: Dict[str, Any] = {"token": card_token}
    if payment_method_id:
        cuerpo["payment_method_id"] = payment_method_id
    alta = _pedir("POST", f"/v1/customers/{customer_id}/cards", json=cuerpo)
    if not alta["success"]:
        mensaje_error = "La tarjeta no se pudo validar con el banco. Prueba con otra."
        err_raw = alta.get("error")
        if isinstance(err_raw, str):
            try:
                err_json = json.loads(err_raw)
                causes = err_json.get("cause") or []
                codigos = [str(c.get("code")) for c in causes if isinstance(c, dict) and c.get("code")]
                if any(c in codigos for c in ("205", "E301")):
                    mensaje_error = "El número de tarjeta es inválido o no pudimos procesarlo."
                elif any(c in codigos for c in ("208", "325", "326")):
                    mensaje_error = "La fecha de vencimiento es inválida."
                elif "E302" in codigos:
                    mensaje_error = "El código de seguridad (CVV) es inválido."
                elif err_json.get("message") and "not found" in str(err_json.get("message")).lower():
                    mensaje_error = "El token de la tarjeta expiró o es inválido. Intenta registrarla nuevamente."
            except Exception:
                pass
        raise VaultError("TARJETA_INVALIDA", mensaje_error)

    datos = _normalizar_tarjeta_mp(alta["data"])
    datos["mp_customer_id"] = customer_id
    if not datos.get("tipo"):
        # Sin `payment_type_id` en la respuesta: primero lo que detectó la app
        # (`/payment_methods` ya distingue credit_card / debit_card), y si no,
        # se infiere del id del método.
        if tipo_hint in ("credito", "debito"):
            datos["tipo"] = tipo_hint
        else:
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
