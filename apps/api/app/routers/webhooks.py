"""
Webhooks entrantes de proveedores externos.

Hoy solo Didit (verificación de identidad). El endpoint valida la firma
HMAC, normaliza el resultado y actualiza `Usuario.verificacion_externa_*`.
Nunca lanza 5xx por datos que no reconoce — responde 200 para que el
proveedor no reintente en loop — salvo firma inválida (401).
"""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.features.verificacion_externa import didit as verificacion_didit
from app.models.entities import Usuario
from app.services.notificaciones import crear_notificacion

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

_MENSAJES_USUARIO = {
    "aprobada": ("Identidad verificada", "Tu identidad quedó verificada. Ya puedes continuar."),
    "rechazada": (
        "No pudimos verificar tu identidad",
        "La verificación no pasó. Puedes reintentar o escribir a soporte.",
    ),
    "revision": (
        "Estamos revisando tu identidad",
        "Un ejecutivo está revisando tu verificación. Te avisamos apenas quede lista.",
    ),
    "expirada": (
        "Tu verificación expiró",
        "La sesión de verificación caducó. Vuelve a iniciarla desde tu perfil.",
    ),
}


@router.post("/didit", summary="Webhook de resultado de verificación de identidad (Didit)")
async def webhook_didit(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()

    if not verificacion_didit.verificar_firma_webhook(raw, request.headers):
        # 401: firma inválida o secret sin configurar. No revela cuál.
        raise HTTPException(status_code=401, detail="Firma de webhook inválida.")

    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        logger.warning("Webhook Didit con cuerpo no-JSON")
        return {"ok": True}

    resultado = verificacion_didit.interpretar_payload(payload)
    estado = resultado["estado"]
    vendor_data = resultado.get("vendor_data")
    session_id = resultado.get("session_id")

    usuario = None
    if vendor_data:
        usuario = db.query(Usuario).filter(Usuario.id == vendor_data).first()
    if not usuario and session_id:
        usuario = (
            db.query(Usuario)
            .filter(Usuario.verificacion_externa_ref == session_id)
            .first()
        )
    if not usuario:
        logger.warning(
            "Webhook Didit sin usuario (vendor_data=%s session_id=%s)", vendor_data, session_id
        )
        return {"ok": True}

    # Ignorar si esta sesión no es la última que abrimos para el usuario
    # (webhook viejo de una sesión anterior).
    if (
        usuario.verificacion_externa_ref
        and session_id
        and usuario.verificacion_externa_ref != session_id
    ):
        logger.info("Webhook Didit de una sesión antigua de %s, ignorado", usuario.id)
        return {"ok": True}

    anterior = usuario.verificacion_externa_estado
    usuario.verificacion_externa_estado = estado
    usuario.verificacion_externa_actualizada = datetime.utcnow()
    if not usuario.verificacion_externa_ref and session_id:
        usuario.verificacion_externa_ref = session_id

    # Con la identidad aprobada, se rellenan los datos que falten con lo que
    # leyó el proveedor (nunca se pisan datos ya cargados).
    datos = resultado.get("datos") or {}
    if estado == "aprobada":
        if not usuario.nombre and datos.get("nombre_completo"):
            usuario.nombre = datos["nombre_completo"]
        if not usuario.rut and datos.get("rut"):
            usuario.rut = datos["rut"]
        if not usuario.fecha_nacimiento and datos.get("fecha_nacimiento"):
            try:
                usuario.fecha_nacimiento = datetime.fromisoformat(
                    str(datos["fecha_nacimiento"])[:10]
                )
            except ValueError:
                pass

    motivos = resultado.get("motivos") or []
    if motivos:
        usuario.notas_auditoria = " | ".join(motivos)[:1000]

    db.commit()

    if estado != anterior and estado in _MENSAJES_USUARIO:
        titulo, mensaje = _MENSAJES_USUARIO[estado]
        crear_notificacion(
            db,
            usuario_id=usuario.id,
            tipo="kyc",
            titulo=titulo,
            mensaje=mensaje,
            entidad_tipo="usuario",
            entidad_id=usuario.id,
        )

    logger.info(
        "Webhook Didit: usuario=%s estado %s -> %s (proveedor=%s)",
        usuario.id, anterior, estado, resultado.get("estado_proveedor"),
    )
    return {"ok": True}
