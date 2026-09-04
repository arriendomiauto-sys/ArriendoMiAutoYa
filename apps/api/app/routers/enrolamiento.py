from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.schemas.schemas import UserEnrolamiento, UserOut
from app.models.entities import Usuario, Pago, TicketSoporte
from app.features.verificacion_identidad.ocr_engine import OCRService
from app.services.auth import get_current_user
from app.core.limiter import limiter
import uuid

from app.core.validators import validar_documento_identidad
from app.services.licencias import evaluar_licencia_usuario
from app.services.pricing import PricingService
from app.services import tarjetas

router = APIRouter(prefix="/enrolamiento", tags=["Enrolamiento de Clientes"])

@router.post("/procesar-documentos", summary="Extrae datos de carnet y licencia vía OCR")
def procesar_documentos_ocr(payload: UserEnrolamiento):
    """
    Envía las imágenes a Google Cloud Vision (o usa mock local con datos demo) para extraer RUT y validar vigencia.
    """
    resultado_ocr = OCRService.procesar_documentos_enrolamiento(
        carnet_frontal_url=payload.carnet_frontal_url,
        carnet_trasero_url=payload.carnet_trasero_url,
        licencia_url=payload.licencia_url,
        rut_usuario=payload.rut,
        selfie_url=payload.foto_perfil_verificada_url,
        tipo_documento=payload.tipo_documento,
        pais_documento=payload.pais_documento,
    )
    return {
        "mensaje": "Documentos procesados exitosamente",
        "datos_extraidos": resultado_ocr
    }

@router.post("/completar", response_model=UserOut, summary="Completa el enrolamiento y realiza el hold de seguridad de $800.000")
@limiter.limit("10/minute")
def completar_enrolamiento(
    request: Request,
    payload: UserEnrolamiento,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    # Si el usuario ya está verificado, no re-ejecutar OCR ni volver a cobrar el hold
    if current_user.estado_documentos == "verificado":
        return current_user

    # El chileno se identifica con RUT (Módulo 11); el extranjero con pasaporte
    # o DNI de su país. ClaveÚnica no es alternativa: solo la integran
    # organismos del Estado, no una empresa privada.
    es_chileno = (payload.tipo_documento or "rut") == "rut"
    numero_identidad = payload.rut if es_chileno else payload.numero_documento

    valido, motivo_documento = validar_documento_identidad(
        payload.tipo_documento, numero_identidad, payload.pais_documento
    )
    if not valido:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=motivo_documento
        )

    # Sin este chequeo, un documento repetido revienta recién en el commit()
    # de más abajo con un IntegrityError crudo de SQLite/Postgres (mensaje
    # técnico en inglés, no algo que se le pueda mostrar a un usuario).
    if es_chileno:
        documento_en_uso = (
            db.query(Usuario)
            .filter(Usuario.rut == payload.rut, Usuario.id != current_user.id)
            .first()
        )
        detalle_duplicado = "Este RUT ya está registrado en otra cuenta."
    else:
        documento_en_uso = (
            db.query(Usuario)
            .filter(
                Usuario.numero_documento == payload.numero_documento,
                Usuario.pais_documento == payload.pais_documento,
                Usuario.id != current_user.id,
            )
            .first()
        )
        detalle_duplicado = "Este documento ya está registrado en otra cuenta."

    if documento_en_uso:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detalle_duplicado
        )

    # La tarjeta es requisito para operar y se pide acá, junto con los
    # documentos, para que un problema no parta el flujo en dos.
    if not payload.tarjeta_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Necesitas registrar una tarjeta de crédito para completar tu cuenta. "
                "Es la garantía con la que se retiene el hold y se cobran los cargos del arriendo."
            ),
        )

    resultado_tarjeta = tarjetas.validar_tarjeta(
        payload.tarjeta_token,
        payload.tarjeta_ultimos4,
        payload.tarjeta_marca,
        titular=payload.tarjeta_titular,
        nombre_cuenta=payload.nombre,
    )

    # Procesar documentos para calcular confianza
    resultado_ocr = OCRService.procesar_documentos_enrolamiento(
        carnet_frontal_url=payload.carnet_frontal_url,
        carnet_trasero_url=payload.carnet_trasero_url,
        licencia_url=payload.licencia_url,
        rut_usuario=payload.rut,
        selfie_url=payload.foto_perfil_verificada_url,
        tipo_documento=payload.tipo_documento,
        pais_documento=payload.pais_documento,
    )

    # Un rechazo del OCR bloquea el enrolamiento de verdad: no se otorga el
    # rol "cliente" ni se cobra el hold de garantía sobre documentos que la
    # verificación marcó como no válidos.
    if resultado_ocr.get("estado_recomendado") == "rechazado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=resultado_ocr.get("motivo") or "No se pudo verificar tus documentos. Vuelve a tomar las fotos con buena iluminación."
        )

    current_user.nombre = payload.nombre
    if es_chileno:
        current_user.rut = payload.rut
    current_user.tipo_documento = payload.tipo_documento
    current_user.numero_documento = numero_identidad
    current_user.pais_documento = payload.pais_documento or ("CL" if es_chileno else None)
    if payload.fecha_nacimiento:
        current_user.fecha_nacimiento = payload.fecha_nacimiento

    # Licencia de conducir. Un chileno que no declara país se asume con
    # licencia chilena Clase B, que es el flujo que ya existía.
    current_user.licencia_pais_emisor = payload.licencia_pais_emisor or ("CL" if es_chileno else None)
    current_user.licencia_numero = payload.licencia_numero
    current_user.licencia_clase = payload.licencia_clase or ("B" if es_chileno else None)
    current_user.licencia_vencimiento = payload.licencia_vencimiento
    current_user.pic_url = payload.pic_url
    current_user.pic_vencimiento = payload.pic_vencimiento
    current_user.es_residente_chile = payload.es_residente_chile
    current_user.fecha_inicio_residencia = payload.fecha_inicio_residencia

    current_user.tarjeta_token = payload.tarjeta_token
    current_user.tarjeta_ultimos4 = payload.tarjeta_ultimos4
    current_user.tarjeta_marca = resultado_tarjeta["marca"]
    current_user.tarjeta_estado = resultado_tarjeta["estado"]
    current_user.tarjeta_titular = payload.tarjeta_titular

    if payload.email:
        current_user.email = payload.email
    if payload.telefono is not None:
        current_user.telefono = payload.telefono
    if payload.foto_perfil_verificada_url:
        current_user.foto_perfil_verificada_url = payload.foto_perfil_verificada_url
    current_user.confianza_ocr = resultado_ocr.get("confianza_ocr", 0.95)
    current_user.estado_documentos = resultado_ocr.get("estado_recomendado", "verificado")

    notas = [resultado_ocr["motivo"]] if resultado_ocr.get("motivo") else []
    if payload.qr_carnet_payload:
        # No se sabe con certeza qué formato trae el QR de la cédula nueva
        # (ver notas de la Fase 1 del plan) — se guarda tal cual para que
        # soporte lo revise, sin usarlo para aprobar ni rechazar solo.
        notas.append(f"QR cédula leído (sin interpretar): {payload.qr_carnet_payload[:500]}")
    if notas:
        current_user.notas_auditoria = " | ".join(notas)
    
    roles = current_user.roles_activos or []
    if "cliente" not in roles:
        roles.append("cliente")
    current_user.roles_activos = roles

    # Árbol de decisión de licencia (Convenio de Viena, PIC, residencia > 1 año
    # y edad mínima). No bloquea el enrolamiento: lo deriva a un ejecutivo, igual
    # que se hace con la licencia ilegible.
    config = PricingService.obtener_configuracion(db)
    evaluacion_licencia = evaluar_licencia_usuario(
        current_user,
        edad_minima=getattr(config, "edad_minima_arriendo", None) or 21,
    )

    # Todo lo que no se pudo verificar automáticamente se junta acá y sale en
    # UN SOLO ticket. Antes se abría uno por cada problema: el ejecutivo veía
    # tres tickets del mismo usuario sin saber que eran el mismo caso, y el
    # usuario recibía tres respuestas distintas.
    problemas = []

    if resultado_ocr.get("estado_recomendado") == "requiere_revision_manual":
        problemas.append(
            f"Documento de identidad: {resultado_ocr.get('motivo') or 'requiere revisión manual'}."
        )

    if not evaluacion_licencia["permitido"]:
        problemas.append(f"Licencia de conducir: {evaluacion_licencia['motivo']}")

    if resultado_ocr.get("licencia_a_soporte") and payload.licencia_url:
        problemas.append(
            "Licencia de conducir: el OCR no la reconoció. "
            f"Documento: {payload.licencia_url}"
        )

    if resultado_tarjeta["estado"] == tarjetas.REVISION_MANUAL:
        problemas.append(f"Medio de pago: {resultado_tarjeta['motivo']}")

    if problemas:
        current_user.estado_documentos = "requiere_revision_manual"
        current_user.notas_auditoria = " | ".join(problemas)
        db.add(TicketSoporte(
            usuario_id=current_user.id,
            sucursal_id=current_user.sucursal_id,
            asunto="Revisión manual de enrolamiento",
            descripcion=(
                f"Enrolamiento de {payload.nombre} que no se pudo verificar por completo "
                f"de forma automática. Puntos a revisar ({len(problemas)}):\n\n"
                + "\n".join(f"- {p}" for p in problemas)
            ),
        ))

    # Registrar hold de enrolamiento de $800.000 CLP
    pago_hold = Pago(
        usuario_id=current_user.id,
        tipo="hold_enrolamiento",
        monto=settings.HOLD_ENROLAMIENTO_CLP,
        estado="capturado",
        referencia_pago=f"MP-HOLD-{uuid.uuid4().hex[:8].upper()}"
    )
    db.add(pago_hold)
    db.commit()
    db.refresh(current_user)

    from app.services.notificaciones import crear_notificacion
    _estado = current_user.estado_documentos
    crear_notificacion(
        db,
        usuario_id=current_user.id,
        tipo="kyc",
        titulo=(
            "Identidad verificada" if _estado == "verificado"
            else "Tus documentos están en revisión"
        ),
        mensaje=(
            "Ya puedes reservar y publicar autos."
            if _estado == "verificado"
            else "Un ejecutivo revisa tu caso. Te avisamos apenas quede lista tu cuenta."
        ),
        entidad_tipo="usuario",
        entidad_id=current_user.id,
    )

    return current_user
