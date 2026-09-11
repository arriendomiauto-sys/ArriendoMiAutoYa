"""
Webhooks entrantes de proveedores externos.

Hoy solo Didit (verificación de identidad). El endpoint valida la firma
HMAC, normaliza el resultado y actualiza `Usuario.verificacion_externa_*`.
Nunca lanza 5xx por datos que no reconoce — responde 200 para que el
proveedor no reintente en loop — salvo firma inválida (401).
"""
import logging
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.features.auth.background_checks import BackgroundCheckService
from app.features.auth.verification.storage_sync import persist_verification_assets
from app.features.auth.didit import didit as verificacion_didit
from app.models.entities import Usuario
from app.features.communications.notifications.service import crear_notificacion

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


# ============================================================================
# Tarea en background: verificación de antecedentes del conductor (ChapiAPI)
# ============================================================================
def _run_background_check(user_id: str) -> None:
    """
    Corre `BackgroundCheckService` con su propia sesión de BD (la del request
    ya se cerró). Best-effort: si algo falla, se loguea y no revienta nada.
    """
    db = SessionLocal()
    try:
        BackgroundCheckService.run_and_flag_user(db, user_id)
    except Exception:  # noqa: BLE001
        logger.exception("Verificación de antecedentes falló para usuario %s", user_id)
    finally:
        db.close()


def _parse_fecha(valor) -> "datetime | None":
    """Convierte una fecha ISO parcial del proveedor a datetime, o None."""
    if not valor:
        return None
    try:
        return datetime.fromisoformat(str(valor)[:10])
    except ValueError:
        return None


@router.post("/didit", summary="Webhook de resultado de verificación de identidad (Didit)")
async def webhook_didit(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    raw = await request.body()

    if not verificacion_didit.verificar_firma_webhook(raw, request.headers):
        # 401: firma inválida o secret sin configurar. No revela cuál. Se
        # loguea el cuerpo (truncado) para depurar fallos de canonicalización.
        logger.warning("Webhook Didit: firma inválida. Cuerpo: %s", raw[:1000])
        raise HTTPException(status_code=401, detail="Firma de webhook inválida.")

    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        logger.warning("Webhook Didit con cuerpo no-JSON")
        return {"ok": True}

    # Solo interesan los eventos de sesión de usuario. El resto (entidades,
    # transacciones, actividad) se acepta y se ignora.
    webhook_type = payload.get("webhook_type")
    if webhook_type and webhook_type not in verificacion_didit._WEBHOOK_TYPES_SESION:
        logger.info("Webhook Didit ignorado (webhook_type=%s)", webhook_type)
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
        # `datos["rut"]` ya viene validado con Módulo 11 desde interpretar_payload.
        # Se descarta si otra cuenta ya lo tiene (la columna es UNIQUE — un
        # commit con choque tumbaría el webhook con 500).
        rut_nuevo = datos.get("rut")
        if not usuario.rut and rut_nuevo:
            ya_usado = (
                db.query(Usuario.id)
                .filter(Usuario.rut == rut_nuevo, Usuario.id != usuario.id)
                .first()
            )
            if not ya_usado:
                usuario.rut = rut_nuevo
        if not usuario.fecha_nacimiento and datos.get("fecha_nacimiento"):
            usuario.fecha_nacimiento = (
                _parse_fecha(datos["fecha_nacimiento"]) or usuario.fecha_nacimiento
            )

        # Bloque: Persistencia permanente de las fotos del proveedor.
        # Didit entrega URLs temporales (expiran); se rebajan al bucket
        # privado "documentos-kyc" antes de guardarlas en el usuario.
        #
        # La licencia de conducir NO se toma de Didit: todavía no la
        # reconoce de forma confiable (solo certifica cédula/pasaporte). Se
        # verifica siempre aparte, con el pipeline casero de Google Vision
        # (ver POST /enrolamiento/completar-licencia).
        persisted = persist_verification_assets(
            {
                "verified_avatar_url": datos.get("foto_url"),
                "front_card_url": datos.get("carnet_frontal_url"),
                "back_card_url": datos.get("carnet_trasero_url"),
            },
            usuario.id,
        )
        avatar_url = persisted.get("verified_avatar_url") or datos.get("foto_url")
        if avatar_url:
            usuario.foto_perfil_verificada_url = avatar_url
        if persisted.get("front_card_url") or datos.get("carnet_frontal_url"):
            usuario.carnet_frontal_url = persisted.get("front_card_url") or datos.get("carnet_frontal_url")
        if persisted.get("back_card_url") or datos.get("carnet_trasero_url"):
            usuario.carnet_trasero_url = persisted.get("back_card_url") or datos.get("carnet_trasero_url")

        # Bloque: Método de verificación usado (para auditoría y el perfil).
        usuario.metodo_verificacion = "didit"

    motivos = list(resultado.get("motivos") or [])
    if datos.get("edad") is not None:
        motivos.append(f"Edad leída del documento: {datos['edad']} años.")
    if motivos:
        usuario.notas_auditoria = " | ".join(motivos)[:1000]

    try:
        db.commit()
    except Exception:  # noqa: BLE001 — no dejar el webhook en 500 por datos raros
        logger.exception("Webhook Didit: commit falló para usuario %s", usuario.id)
        db.rollback()
        return {"ok": True}

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

    # Con la identidad recién aprobada, se dispara en background la
    # verificación de antecedentes del conductor (ChapiAPI). Si sale mal,
    # `run_and_flag_user` deja la cuenta en revisión manual.
    if estado == "aprobada" and anterior != "aprobada":
        background_tasks.add_task(_run_background_check, usuario.id)

    logger.info(
        "Webhook Didit: usuario=%s estado %s -> %s (proveedor=%s)",
        usuario.id, anterior, estado, resultado.get("estado_proveedor"),
    )
    return {"ok": True}
