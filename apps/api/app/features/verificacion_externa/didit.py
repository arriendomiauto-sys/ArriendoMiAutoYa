"""
Adaptador de Didit (https://didit.me) para verificación de identidad.

Flujo hosted:
  1. `crear_sesion(usuario)` -> POST /v3/session/ -> devuelve una URL a la que
     mandamos al usuario. Didit toma la foto de la cédula, hace liveness +
     face match y (según el workflow) valida el RUT contra Registro Civil.
  2. Didit avisa por webhook firmado (HMAC-SHA256) cada vez que cambia el
     estado de la sesión. `verificar_firma_webhook` valida la firma;
     `interpretar_payload` normaliza el resultado.
  3. Como respaldo (webhook perdido), `obtener_decision(session_id)` relee el
     veredicto por API.

Auth: header `x-api-key`. La API responde 403 —nunca 401— si la llave falta
o es inválida.

Todo el módulo es best-effort y no lanza hacia afuera salvo errores de
configuración: si Didit no responde, el llamador decide (normalmente:
derivar a revisión manual).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from typing import Any, Dict, Mapping, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Tolerancia del timestamp del webhook (segundos) contra replay.
_MARGEN_TIMESTAMP_SEG = 300

# Estados de sesión de Didit (case-sensitive) -> estado interno.
_MAPA_ESTADO = {
    "Approved": "aprobada",
    "Declined": "rechazada",
    "In Review": "revision",
    "Not Started": "pendiente",
    "In Progress": "pendiente",
    "Awaiting User": "pendiente",
    "Resubmitted": "pendiente",
    "Abandoned": "expirada",
    "Expired": "expirada",
    "Kyc Expired": "expirada",
}

ESTADOS_INTERNOS = {"pendiente", "aprobada", "rechazada", "revision", "expirada", "no_iniciada"}


class DiditNoConfigurado(RuntimeError):
    """El flag está encendido pero falta DIDIT_API_KEY / DIDIT_WORKFLOW_ID."""


def esta_habilitado() -> bool:
    return bool(
        settings.VERIFICACION_EXTERNA_HABILITADA
        and settings.DIDIT_API_KEY
        and settings.DIDIT_WORKFLOW_ID
    )


def _headers() -> Dict[str, str]:
    if not settings.DIDIT_API_KEY:
        raise DiditNoConfigurado("Falta DIDIT_API_KEY")
    return {"x-api-key": settings.DIDIT_API_KEY, "Content-Type": "application/json"}


def _base() -> str:
    return (settings.DIDIT_BASE_URL or "https://verification.didit.me").rstrip("/")


# --------------------------------------------------------------------------- #
# Crear sesión
# --------------------------------------------------------------------------- #
def crear_sesion(
    *,
    vendor_data: str,
    nombre: Optional[str] = None,
    apellido: Optional[str] = None,
    rut: Optional[str] = None,
    email: Optional[str] = None,
    callback_url: Optional[str] = None,
    idioma: str = "es",
) -> Dict[str, Any]:
    """
    Crea una sesión de verificación. `vendor_data` es nuestro identificador del
    usuario (se guarda y vuelve en cada webhook). Devuelve al menos
    `{"session_id": str, "url": str, "status": str}`.
    """
    if not settings.DIDIT_WORKFLOW_ID:
        raise DiditNoConfigurado("Falta DIDIT_WORKFLOW_ID")

    cuerpo: Dict[str, Any] = {
        "workflow_id": settings.DIDIT_WORKFLOW_ID,
        "vendor_data": vendor_data,
        "language": idioma,
    }
    callback = callback_url or settings.DIDIT_CALLBACK_URL
    if callback:
        cuerpo["callback"] = callback

    # `expected_details`: Didit contrasta lo que lee del documento contra esto.
    # El RUT chileno viaja en `identification_number`; el país del documento en
    # ISO 3166-1 alpha-3.
    esperado: Dict[str, Any] = {"id_country": "CHL"}
    if nombre:
        esperado["first_name"] = nombre
    if apellido:
        esperado["last_name"] = apellido
    if rut:
        esperado["identification_number"] = rut
    if len(esperado) > 1:
        cuerpo["expected_details"] = esperado

    if email:
        cuerpo["contact_details"] = {"email": email, "send_notification_emails": False}

    with httpx.Client(timeout=20.0) as client:
        resp = client.post(f"{_base()}/v3/session/", headers=_headers(), json=cuerpo)
    if resp.status_code not in (200, 201):
        logger.error("Didit crear_sesion %s: %s", resp.status_code, resp.text[:400])
        raise RuntimeError(f"Didit rechazó la creación de sesión (HTTP {resp.status_code}).")

    data = resp.json()
    return {
        "session_id": data.get("session_id"),
        "session_token": data.get("session_token"),
        "url": data.get("url"),
        "status": data.get("status"),
        "raw": data,
    }


# --------------------------------------------------------------------------- #
# Releer decisión
# --------------------------------------------------------------------------- #
def obtener_decision(session_id: str) -> Optional[Dict[str, Any]]:
    """Relee el veredicto de una sesión. None si Didit no responde 200."""
    if not session_id:
        return None
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(
                f"{_base()}/v3/session/{session_id}/decision/", headers=_headers()
            )
        if resp.status_code == 200:
            return resp.json()
        logger.warning("Didit obtener_decision %s: %s", resp.status_code, resp.text[:300])
    except Exception as e:  # noqa: BLE001
        logger.error("Didit obtener_decision error: %s", e)
    return None


# --------------------------------------------------------------------------- #
# Webhook: verificación de firma
# --------------------------------------------------------------------------- #
def _canonico(raw_body: bytes) -> str:
    """JSON canónico como lo firma Didit para X-Signature-V2."""
    return json.dumps(
        json.loads(raw_body),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def verificar_firma_webhook(raw_body: bytes, headers: Mapping[str, str]) -> bool:
    """
    Valida un webhook de Didit. Se aceptan X-Signature-V2 (JSON canónico) y
    X-Signature (bytes crudos); se exige que X-Timestamp esté dentro de
    ±300 s. Comparación en tiempo constante.
    """
    secret = settings.DIDIT_WEBHOOK_SECRET
    if not secret:
        logger.error("Webhook Didit recibido pero falta DIDIT_WEBHOOK_SECRET")
        return False

    # Headers case-insensitive.
    h = {k.lower(): v for k, v in headers.items()}
    ts = h.get("x-timestamp")
    if not ts:
        return False
    try:
        if abs(time.time() - int(ts)) > _MARGEN_TIMESTAMP_SEG:
            logger.warning("Webhook Didit fuera de la ventana de tiempo (replay?)")
            return False
    except (TypeError, ValueError):
        return False

    firmas_candidatas = []
    try:
        firmas_candidatas.append(
            hmac.new(secret.encode(), _canonico(raw_body).encode(), hashlib.sha256).hexdigest()
        )
    except Exception:  # noqa: BLE001 — body no-JSON: solo queda la firma cruda
        pass
    firmas_candidatas.append(
        hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    )

    recibidas = [
        h.get("x-signature-v2", ""),
        h.get("x-signature", ""),
    ]
    for esperada in firmas_candidatas:
        for recibida in recibidas:
            if recibida and hmac.compare_digest(esperada, recibida):
                return True
    return False


# --------------------------------------------------------------------------- #
# Normalización del resultado
# --------------------------------------------------------------------------- #
def _primero(lst: Any) -> Dict[str, Any]:
    return lst[0] if isinstance(lst, list) and lst and isinstance(lst[0], dict) else {}


def _buscar(d: Mapping[str, Any], *claves: str) -> Optional[Any]:
    for c in claves:
        v = d.get(c)
        if v not in (None, "", []):
            return v
    return None


def interpretar_payload(payload: Mapping[str, Any]) -> Dict[str, Any]:
    """
    Normaliza un webhook (`{status, session_id, vendor_data, decision, ...}`)
    o el cuerpo de `GET /decision/` a:

      {
        "estado": "pendiente|aprobada|rechazada|revision|expirada",
        "session_id": str | None,
        "vendor_data": str | None,
        "motivos": [str, ...],
        "datos": {"nombre","apellido","nombre_completo","rut",
                  "fecha_nacimiento","nacionalidad","documento_numero"},
        "rut_verificado_registro_civil": bool | None,
      }
    """
    estado_didit = payload.get("status")
    estado = _MAPA_ESTADO.get(estado_didit or "", "pendiente")

    # El webhook trae `decision` anidado; `GET /decision/` ES la decisión.
    decision = payload.get("decision")
    if not isinstance(decision, dict):
        decision = payload if any(
            k in payload for k in ("id_verifications", "face_matches", "liveness_checks")
        ) else {}

    motivos: list[str] = []
    datos: Dict[str, Any] = {}

    idv = _primero(decision.get("id_verifications"))
    if idv:
        nombre = _buscar(idv, "first_name", "given_name")
        apellido = _buscar(idv, "last_name", "surname", "family_name")
        completo = _buscar(idv, "full_name", "name")
        datos.update(
            {
                "nombre": nombre,
                "apellido": apellido,
                "nombre_completo": completo
                or (" ".join(p for p in (nombre, apellido) if p) or None),
                "rut": _buscar(idv, "identification_number", "personal_number", "document_number"),
                "documento_numero": _buscar(idv, "document_number", "identification_number"),
                "fecha_nacimiento": _buscar(idv, "date_of_birth", "birth_date"),
                "nacionalidad": _buscar(idv, "nationality", "issuing_state", "id_country"),
            }
        )
        if str(idv.get("status")).lower() == "declined":
            motivos.append("La verificación del documento de identidad no pasó.")

    face = _primero(decision.get("face_matches"))
    if face and str(face.get("status")).lower() == "declined":
        motivos.append("La selfie no coincide con la foto del documento.")

    live = _primero(decision.get("liveness_checks"))
    if live and str(live.get("status")).lower() == "declined":
        motivos.append("El control de vida (liveness) no pasó.")

    dbv = _primero(decision.get("database_validations"))
    rut_ok: Optional[bool] = None
    if dbv:
        st = str(dbv.get("status")).lower()
        rut_ok = st == "approved"
        if st == "declined":
            motivos.append("El RUT no calza con los datos del Registro Civil.")

    # Motivos explícitos que a veces trae Didit a nivel de decisión.
    for w in decision.get("warnings", []) or []:
        txt = w.get("description") or w.get("message") if isinstance(w, dict) else str(w)
        if txt:
            motivos.append(str(txt))

    return {
        "estado": estado,
        "estado_proveedor": estado_didit,
        "session_id": payload.get("session_id"),
        "vendor_data": payload.get("vendor_data"),
        "motivos": [m for m in motivos if m],
        "datos": {k: v for k, v in datos.items() if v},
        "rut_verificado_registro_civil": rut_ok,
    }
