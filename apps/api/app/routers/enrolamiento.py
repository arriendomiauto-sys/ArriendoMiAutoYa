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

from app.core.validators import validar_rut_chileno

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
    """
    Registra los documentos, activa el rol 'cliente', y crea el registro de retención (hold)
    de seguridad de $800.000 CLP separado de las reservas.
    """
    if not validar_rut_chileno(payload.rut):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="RUT chileno inválido (falla verificación de dígito verificador Módulo 11)."
        )

    # Sin este chequeo, un RUT repetido revienta recién en el commit() de
    # más abajo con un IntegrityError crudo de SQLite/Postgres (mensaje
    # técnico en inglés, no algo que se le pueda mostrar a un usuario).
    rut_en_uso = (
        db.query(Usuario)
        .filter(Usuario.rut == payload.rut, Usuario.id != current_user.id)
        .first()
    )
    if rut_en_uso:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este RUT ya está registrado en otra cuenta."
        )

    # Procesar documentos para calcular confianza
    resultado_ocr = OCRService.procesar_documentos_enrolamiento(
        carnet_frontal_url=payload.carnet_frontal_url,
        carnet_trasero_url=payload.carnet_trasero_url,
        licencia_url=payload.licencia_url,
        rut_usuario=payload.rut,
        selfie_url=payload.foto_perfil_verificada_url,
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
    current_user.rut = payload.rut
    current_user.telefono = payload.telefono
    if payload.foto_perfil_verificada_url:
        current_user.foto_perfil_verificada_url = payload.foto_perfil_verificada_url
    current_user.confianza_ocr = resultado_ocr.get("confianza_ocr", 0.95)
    current_user.estado_documentos = resultado_ocr.get("estado_recomendado", "verificado")
    if resultado_ocr.get("motivo"):
        current_user.notas_auditoria = resultado_ocr["motivo"]
    
    roles = current_user.roles_activos or []
    if "cliente" not in roles:
        roles.append("cliente")
    current_user.roles_activos = roles

    # Licencia que el OCR no pudo reconocer: se abre un ticket de soporte
    # para que un ejecutivo la revise a mano, sin frenar el resto del
    # enrolamiento (la identidad ya quedó resuelta arriba).
    if resultado_ocr.get("licencia_a_soporte") and payload.licencia_url:
        db.add(TicketSoporte(
            usuario_id=current_user.id,
            sucursal_id=current_user.sucursal_id,
            asunto="Revisión manual de licencia de conducir",
            descripcion=(
                "El OCR no reconoció la licencia subida en el enrolamiento. "
                f"Documento: {payload.licencia_url}"
            ),
        ))

    # Registrar hold de enrolamiento de $800.000 CLP
    pago_hold = Pago(
        usuario_id=current_user.id,
        tipo="hold_enrolamiento",
        monto=settings.HOLD_ENROLAMIENTO_CLP,
        estado="capturado",
        referencia_transbank=f"TBK-HOLD-{uuid.uuid4().hex[:8].upper()}"
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
            else "Un ejecutivo revisa tus documentos. Te avisamos apenas quede lista tu cuenta."
        ),
        entidad_tipo="usuario",
        entidad_id=current_user.id,
    )

    return current_user
