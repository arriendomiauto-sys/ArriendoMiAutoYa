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
from app.core.validators import formatear_rut, validar_rut_chileno

logger = logging.getLogger(__name__)

# Tolerancia del timestamp del webhook (segundos) contra replay.
_MARGEN_TIMESTAMP_SEG = 300

# Estados de sesión de Didit (case-sensitive) -> estado interno. La doc de
# Didit escribe el de KYC vencido de dos formas ("Kyc Expired" / "KYC
# Expired") según la página; se aceptan ambas.
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
    "KYC Expired": "expirada",
}

# webhook_type que nos interesan (sesiones de usuario). El resto —entidades,
# transacciones, actividad— se ignora.
_WEBHOOK_TYPES_SESION = {"status.updated", "data.updated"}

ESTADOS_INTERNOS = {"pendiente", "aprobada", "rechazada", "revision", "expirada", "no_iniciada"}


class DiditNoConfigurado(RuntimeError):
    """El flag está encendido pero falta DIDIT_API_KEY / DIDIT_WORKFLOW_ID."""


def esta_habilitado() -> bool:
    # Se exige también el secret del webhook: sin él, cada webhook de Didit se
    # rechazaría con 401 y el enrolamiento quedaría dependiendo solo del
    # re-poll. Mejor "medio configurado" == apagado (cae al OCR de siempre).
    return bool(
        settings.VERIFICACION_EXTERNA_HABILITADA
        and settings.DIDIT_API_KEY
        and settings.DIDIT_WORKFLOW_ID
        and settings.DIDIT_WEBHOOK_SECRET
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
    rut: Optional[str] = None,  # aceptado por compatibilidad; Didit lo lee de la cédula
    email: Optional[str] = None,
    callback_url: Optional[str] = None,
    idioma: str = "es",
) -> Dict[str, Any]:
    """
    Crea una sesión de verificación. `vendor_data` es nuestro identificador del
    usuario (se guarda y vuelve en cada webhook). Devuelve al menos
    `{"session_id": str, "url": str, "status": str}`.
    """
    _ = rut  # el RUT no se envía: lo valida el workflow contra Registro Civil
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

    # `expected_details`: Didit contrasta lo que lee del documento contra esto
    # (chequeo de coherencia, no filtro duro). País del documento en ISO
    # 3166-1 alpha-3. El RUT no se manda: lo lee Didit de la cédula y lo cruza
    # contra Registro Civil en el paso Database Validation del workflow.
    esperado: Dict[str, Any] = {"id_country": "CHL"}
    if nombre:
        esperado["first_name"] = nombre
    if apellido:
        esperado["last_name"] = apellido
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
def _acortar_floats(v: Any) -> Any:
    """
    Floats que son enteros (1.0) -> int (1), recursivo. Didit canonicaliza
    así antes de firmar X-Signature-V2 (su `shortenFloats`): JSON.parse en JS
    ya colapsa `1.0` a `1`, y hay que replicarlo para que el HMAC calce.

    Solo se acortan por debajo de 2**53: más allá, JS deja el número en
    notación científica (`1.18e+38`) y `json.dumps` de Python hace lo mismo
    con el float — convertirlo a int rompería la coincidencia.
    """
    if isinstance(v, bool):
        return v
    if isinstance(v, float) and v.is_integer() and abs(v) < 2 ** 53:
        return int(v)
    if isinstance(v, list):
        return [_acortar_floats(x) for x in v]
    if isinstance(v, dict):
        return {k: _acortar_floats(x) for k, x in v.items()}
    return v


def _canonico(raw_body: bytes) -> str:
    """
    JSON canónico como lo firma Didit para X-Signature-V2: claves ordenadas,
    separadores compactos, Unicode sin escapar, floats-enteros como int.
    Equivale a `JSON.stringify(sortKeys(shortenFloats(parsed)))` en JS.
    """
    return json.dumps(
        _acortar_floats(json.loads(raw_body)),
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

    def _es_declined(item: Mapping[str, Any]) -> bool:
        return str(item.get("status") or "").lower() == "declined"

    # id_verifications[]: first_name, last_name, full_name, document_number,
    # personal_number, date_of_birth, age, nationality, issuing_state,
    # portrait_image, warnings[] (esquema V3 real de Didit).
    idv = _primero(decision.get("id_verifications"))
    if idv:
        nombre = _buscar(idv, "first_name", "given_name")
        apellido = _buscar(idv, "last_name", "surname", "family_name")
        edad = idv.get("age")

        # En una cédula chilena, `document_number` es el N° del documento
        # (cambia en cada renovación) y el RUN va en `personal_number` /
        # `identification_number` — pero Didit no es consistente entre países.
        # Se prueban todos los candidatos y se toma el que pase Módulo 11;
        # si ninguno pasa, `rut` queda None (el usuario lo confirma en
        # /completar) y no se pisa lo declarado.
        rut_valido = None
        for cand in (
            idv.get("personal_number"),
            idv.get("identification_number"),
            idv.get("document_number"),
            idv.get("run"),
        ):
            if cand and validar_rut_chileno(str(cand)):
                rut_valido = formatear_rut(str(cand))
                break

        datos.update(
            {
                "nombre": nombre,
                "apellido": apellido,
                "nombre_completo": (
                    _buscar(idv, "full_name", "name")
                    or (" ".join(p for p in (nombre, apellido) if p) or None)
                ),
                "rut": rut_valido,
                "documento_numero": _buscar(idv, "document_number", "identification_number"),
                "fecha_nacimiento": _buscar(idv, "date_of_birth", "birth_date"),
                "nacionalidad": _buscar(idv, "nationality", "issuing_state", "id_country"),
                "edad": int(edad) if isinstance(edad, (int, float)) else None,
            }
        )
        if _es_declined(idv):
            motivos.append("La verificación del documento de identidad no pasó.")
        for w in idv.get("warnings", []) or []:
            txt = (w.get("description") or w.get("message")) if isinstance(w, dict) else str(w)
            if txt:
                motivos.append(str(txt))

    face = _primero(decision.get("face_matches"))
    if _es_declined(face):
        motivos.append("La selfie no coincide con la foto del documento.")

    live = _primero(decision.get("liveness_checks"))
    if _es_declined(live):
        motivos.append("El control de vida (liveness) no pasó.")

    # Selfie del usuario para usarla de foto de perfil (en orden de preferencia).
    # Son URLs de assets de Didit; pueden expirar, así que el que las use debe
    # tolerar un <Image> que falle (o rebajarlas a nuestro storage).
    foto = (
        _buscar(face, "source_image")
        or _buscar(live, "reference_image")
        or _buscar(idv, "portrait_image")
    )
    if foto:
        datos["foto_url"] = foto

    if _es_declined(_primero(decision.get("nfc_verifications"))):
        motivos.append("La lectura del chip NFC del documento no pasó.")

    dbv = _primero(decision.get("database_validations"))
    rut_ok: Optional[bool] = None
    if dbv:
        st = str(dbv.get("status") or "").lower()
        if st == "approved":
            rut_ok = True
        elif st == "declined":
            rut_ok = False
            motivos.append("Los datos no calzan con el Registro Civil.")

    if _es_declined(_primero(decision.get("aml_screenings"))):
        motivos.append("Aparición en listas de sanciones / PEP (screening AML).")

    return {
        "estado": estado,
        "estado_proveedor": estado_didit,
        "session_id": payload.get("session_id"),
        "vendor_data": payload.get("vendor_data"),
        "motivos": [m for m in motivos if m],
        "datos": {k: v for k, v in datos.items() if v},
        "rut_verificado_registro_civil": rut_ok,
    }
