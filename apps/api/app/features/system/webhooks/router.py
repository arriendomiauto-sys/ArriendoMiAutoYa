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
from app.features.auth.onboarding.license_service import evaluar_licencia_usuario
from app.features.vehicles.catalog.pricing_service import PricingService
from app.models.entities import TicketSoporte, Usuario
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

# Igual que `_MENSAJES_USUARIO`, pero para el resultado de `licencia_estado`
# (no `estado`/`verificacion_externa_estado`) tras el webhook de LICENCIA.
_MENSAJES_LICENCIA = {
    "verificada": ("Licencia validada", "Ya puedes reservar autos."),
    "rechazada": (
        "No pudimos validar tu licencia",
        "La verificación no pasó. Puedes reintentar o escribir a soporte.",
    ),
    "revision": (
        "Tu licencia está en revisión",
        "Un ejecutivo la revisa a mano. Te avisamos apenas puedas reservar.",
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


def _procesar_webhook_conductor(
    db: Session, conductor_id: str, session_id: "str | None", resultado: dict,
    background_tasks: "BackgroundTasks | None" = None,
) -> dict:
    """
    Veredicto de Didit para la IDENTIDAD de un segundo conductor (ver
    crear_sesion_verificacion_segundo_conductor). Solo actualiza identidad
    (nombre/rut/fecha de nacimiento/fotos de cédula) — la licencia tiene su
    propio workflow y su propio webhook (`_procesar_webhook_licencia_conductor`).
    """
    from app.models.entities import ConductorAdicional

    conductor = db.query(ConductorAdicional).filter(ConductorAdicional.id == conductor_id).first()
    if not conductor:
        logger.warning("Webhook Didit: conductor adicional %s no existe", conductor_id)
        return {"ok": True}

    estado = resultado["estado"]
    if (
        conductor.verificacion_externa_ref
        and session_id
        and conductor.verificacion_externa_ref != session_id
    ):
        logger.info("Webhook Didit de una sesión antigua del conductor %s, ignorado", conductor.id)
        return {"ok": True}

    anterior = conductor.verificacion_externa_estado
    conductor.verificacion_externa_estado = estado
    conductor.verificacion_externa_actualizada = datetime.utcnow()
    if not conductor.verificacion_externa_ref and session_id:
        conductor.verificacion_externa_ref = session_id

    datos = resultado.get("datos") or {}
    if estado == "aprobada":
        if not conductor.nombre and datos.get("nombre_completo"):
            conductor.nombre = datos["nombre_completo"]
        if not conductor.rut and datos.get("rut"):
            conductor.rut = datos["rut"]
        if not conductor.fecha_nacimiento and datos.get("fecha_nacimiento"):
            conductor.fecha_nacimiento = _parse_fecha(datos["fecha_nacimiento"]) or conductor.fecha_nacimiento

        persisted = persist_verification_assets(
            {
                "front_card_url": datos.get("carnet_frontal_url"),
                "back_card_url": datos.get("carnet_trasero_url"),
            },
            conductor.id,
        )
        if persisted.get("front_card_url") or datos.get("carnet_frontal_url"):
            conductor.carnet_frontal_url = persisted.get("front_card_url") or datos.get("carnet_frontal_url")
        if persisted.get("back_card_url") or datos.get("carnet_trasero_url"):
            conductor.carnet_trasero_url = persisted.get("back_card_url") or datos.get("carnet_trasero_url")

    try:
        db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Webhook Didit: commit falló para conductor %s", conductor.id)
        db.rollback()
        return {"ok": True}

    # Con la identidad resuelta por Didit, se re-evalúa el KYC completo del
    # conductor: sigue exigiendo la licencia por el pipeline casero aunque
    # la cédula ya esté aprobada.
    if estado != anterior:
        from app.features.auth.onboarding.driver_kyc_service import ConductorKycService
        from app.models.entities import Reserva as _Reserva

        reserva = db.query(_Reserva).filter(_Reserva.id == conductor.reserva_id).first()
        if reserva:
            ConductorKycService.procesar_kyc_conductor(conductor, reserva, db)
            if background_tasks is not None and conductor.estado_kyc == "verificado":
                from app.features.auth.background_checks import BackgroundCheckService
                background_tasks.add_task(
                    BackgroundCheckService.run_and_flag_conductor_in_background, conductor.id
                )

    logger.info(
        "Webhook Didit: conductor=%s estado %s -> %s", conductor.id, anterior, estado,
    )
    return {"ok": True}


def _procesar_webhook_licencia_usuario(
    db: Session, usuario_id: str, session_id: "str | None", resultado: dict,
    background_tasks: "BackgroundTasks | None" = None,
) -> dict:
    """
    Veredicto de Didit para la LICENCIA del titular (workflow separado del de
    identidad — ver crear_sesion_verificacion_licencia). Aprobada: rellena
    licencia_numero/vencimiento/url y corre el árbol de decisión de
    `evaluar_licencia_usuario` (edad, PIC, residencia) para fijar el
    `licencia_estado` final — igual criterio que POST /completar-licencia.
    """
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        logger.warning("Webhook Didit (licencia): usuario %s no existe", usuario_id)
        return {"ok": True}

    estado = resultado["estado"]
    if (
        usuario.licencia_verificacion_externa_ref
        and session_id
        and usuario.licencia_verificacion_externa_ref != session_id
    ):
        logger.info("Webhook Didit (licencia) de una sesión antigua de %s, ignorado", usuario.id)
        return {"ok": True}

    anterior_estado_licencia = usuario.licencia_estado
    usuario.licencia_verificacion_externa_estado = estado
    usuario.licencia_verificacion_externa_actualizada = datetime.utcnow()
    if not usuario.licencia_verificacion_externa_ref and session_id:
        usuario.licencia_verificacion_externa_ref = session_id

    datos = resultado.get("datos") or {}
    a_revision = False
    if estado == "aprobada":
        es_chileno = (usuario.tipo_documento or "rut") == "rut"
        if datos.get("licencia_numero"):
            usuario.licencia_numero = datos["licencia_numero"]
        venc = _parse_fecha(datos.get("licencia_vencimiento"))
        if venc:
            usuario.licencia_vencimiento = venc
        if not usuario.licencia_pais_emisor:
            usuario.licencia_pais_emisor = "CL" if es_chileno else usuario.licencia_pais_emisor
        if not usuario.licencia_clase:
            usuario.licencia_clase = "B" if es_chileno else usuario.licencia_clase

        # Fotos temporales de Didit -> bucket privado propio.
        persisted = persist_verification_assets(
            {
                "license_front_url": datos.get("licencia_frontal_url"),
                "license_back_url": datos.get("licencia_trasera_url"),
            },
            usuario.id,
        )
        licencia_url = persisted.get("license_front_url") or datos.get("licencia_frontal_url")
        if licencia_url:
            usuario.licencia_url = licencia_url
        usuario.metodo_verificacion = usuario.metodo_verificacion or "didit"

        config = PricingService.obtener_configuracion(db)
        evaluacion = evaluar_licencia_usuario(
            usuario, edad_minima=getattr(config, "edad_minima_arriendo", None) or 21,
        )
        a_revision = not evaluacion["permitido"]
        usuario.licencia_estado = "revision" if a_revision else "verificada"

        if a_revision:
            db.add(TicketSoporte(
                usuario_id=usuario.id,
                sucursal_id=usuario.sucursal_id,
                asunto="Validación de licencia (Didit) para arrendar",
                descripcion=(
                    f"{usuario.nombre or usuario.email} validó su licencia con Didit, "
                    "pero requiere revisión manual.\n\n"
                    f"Licencia: {usuario.licencia_url}\n"
                    f"Motivo: {evaluacion.get('motivo') or 'revisión manual'}"
                ),
            ))
    elif estado == "rechazada":
        usuario.licencia_estado = "rechazada"
    elif estado == "revision":
        usuario.licencia_estado = "revision"

    try:
        db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Webhook Didit (licencia): commit falló para usuario %s", usuario.id)
        db.rollback()
        return {"ok": True}

    if usuario.licencia_estado != anterior_estado_licencia and usuario.licencia_estado in _MENSAJES_LICENCIA:
        titulo, mensaje = _MENSAJES_LICENCIA[usuario.licencia_estado]
        crear_notificacion(
            db, usuario_id=usuario.id, tipo="kyc", titulo=titulo, mensaje=mensaje,
            entidad_tipo="usuario", entidad_id=usuario.id,
        )

    if estado == "aprobada" and not a_revision and background_tasks is not None:
        background_tasks.add_task(_run_background_check, usuario.id)

    logger.info(
        "Webhook Didit (licencia): usuario=%s estado %s -> %s (licencia_estado=%s)",
        usuario.id, anterior_estado_licencia, estado, usuario.licencia_estado,
    )
    return {"ok": True}


def _procesar_webhook_licencia_conductor(
    db: Session, conductor_id: str, session_id: "str | None", resultado: dict,
    background_tasks: "BackgroundTasks | None" = None,
) -> dict:
    """
    Veredicto de Didit para la LICENCIA de un segundo conductor. Rellena los
    campos y deja que `ConductorKycService.procesar_kyc_conductor` recalcule
    el `estado_kyc` completo (ya sabe distinguir licencia validada por Didit
    de licencia manual, ver driver_kyc_service.py).
    """
    from app.models.entities import ConductorAdicional, Reserva as _Reserva
    from app.features.auth.onboarding.driver_kyc_service import ConductorKycService

    conductor = db.query(ConductorAdicional).filter(ConductorAdicional.id == conductor_id).first()
    if not conductor:
        logger.warning("Webhook Didit (licencia): conductor adicional %s no existe", conductor_id)
        return {"ok": True}

    estado = resultado["estado"]
    if (
        conductor.licencia_verificacion_externa_ref
        and session_id
        and conductor.licencia_verificacion_externa_ref != session_id
    ):
        logger.info("Webhook Didit (licencia) de una sesión antigua del conductor %s, ignorado", conductor.id)
        return {"ok": True}

    anterior = conductor.licencia_verificacion_externa_estado
    conductor.licencia_verificacion_externa_estado = estado
    conductor.licencia_verificacion_externa_actualizada = datetime.utcnow()
    if not conductor.licencia_verificacion_externa_ref and session_id:
        conductor.licencia_verificacion_externa_ref = session_id

    datos = resultado.get("datos") or {}
    if estado == "aprobada":
        es_chileno = (conductor.tipo_documento or "rut").lower() == "rut"
        if datos.get("licencia_numero"):
            conductor.licencia_numero = datos["licencia_numero"]
        venc = _parse_fecha(datos.get("licencia_vencimiento"))
        if venc:
            conductor.licencia_vencimiento = venc
        if not conductor.licencia_pais_emisor:
            conductor.licencia_pais_emisor = "CL" if es_chileno else conductor.licencia_pais_emisor
        if not conductor.licencia_clase:
            conductor.licencia_clase = "B" if es_chileno else conductor.licencia_clase

        persisted = persist_verification_assets(
            {
                "license_front_url": datos.get("licencia_frontal_url"),
                "license_back_url": datos.get("licencia_trasera_url"),
            },
            conductor.id,
        )
        licencia_url = persisted.get("license_front_url") or datos.get("licencia_frontal_url")
        if licencia_url:
            conductor.licencia_url = licencia_url

    try:
        db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Webhook Didit (licencia): commit falló para conductor %s", conductor.id)
        db.rollback()
        return {"ok": True}

    if estado != anterior:
        reserva = db.query(_Reserva).filter(_Reserva.id == conductor.reserva_id).first()
        if reserva:
            ConductorKycService.procesar_kyc_conductor(conductor, reserva, db)
            if background_tasks is not None and conductor.estado_kyc == "verificado":
                from app.features.auth.background_checks import BackgroundCheckService
                background_tasks.add_task(
                    BackgroundCheckService.run_and_flag_conductor_in_background, conductor.id
                )

    logger.info(
        "Webhook Didit (licencia): conductor=%s estado %s -> %s", conductor.id, anterior, estado,
    )
    return {"ok": True}


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

    # El workflow de LICENCIA no trae liveness/face_match/database_validation
    # (ver interpretar_payload_licencia) — hay que elegir el parser correcto
    # ANTES de interpretar, según el prefijo de vendor_data.
    _vendor_data_crudo = payload.get("vendor_data") or ""
    _es_licencia = _vendor_data_crudo.startswith(("licencia:", "licencia_conductor:"))
    resultado = (
        verificacion_didit.interpretar_payload_licencia(payload)
        if _es_licencia
        else verificacion_didit.interpretar_payload(payload)
    )
    estado = resultado["estado"]
    vendor_data = resultado.get("vendor_data")
    session_id = resultado.get("session_id")

    # Sesión de LICENCIA (titular o segundo conductor) — ver
    # crear_sesion_verificacion_licencia /
    # crear_sesion_verificacion_licencia_segundo_conductor.
    if vendor_data and vendor_data.startswith("licencia_conductor:"):
        return _procesar_webhook_licencia_conductor(
            db, vendor_data.split(":", 1)[1], session_id, resultado, background_tasks
        )
    if vendor_data and vendor_data.startswith("licencia:"):
        return _procesar_webhook_licencia_usuario(
            db, vendor_data.split(":", 1)[1], session_id, resultado, background_tasks
        )

    # Sesión de un segundo conductor (crear_sesion_verificacion_segundo_conductor
    # la crea con vendor_data="conductor:{id}") en vez de la del titular.
    if vendor_data and vendor_data.startswith("conductor:"):
        return _procesar_webhook_conductor(
            db, vendor_data.split(":", 1)[1], session_id, resultado, background_tasks
        )

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
