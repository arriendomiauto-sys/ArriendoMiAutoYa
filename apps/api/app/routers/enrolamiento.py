from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.schemas.schemas import UserEnrolamiento, UserOut
from app.models.entities import Usuario, Pago
from app.services.ocr import OCRService
from app.services.auth import get_current_user_placeholder
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
        rut_usuario=payload.rut
    )
    return {
        "mensaje": "Documentos procesados exitosamente",
        "datos_extraidos": resultado_ocr
    }

@router.post("/completar", response_model=UserOut, summary="Completa el enrolamiento y realiza el hold de seguridad de $800.000")
def completar_enrolamiento(
    payload: UserEnrolamiento,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user_placeholder)
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

    # Procesar documentos para calcular confianza
    resultado_ocr = OCRService.procesar_documentos_enrolamiento(
        carnet_frontal_url=payload.carnet_frontal_url,
        carnet_trasero_url=payload.carnet_trasero_url,
        licencia_url=payload.licencia_url,
        rut_usuario=payload.rut
    )

    current_user.nombre = payload.nombre
    current_user.rut = payload.rut
    current_user.telefono = payload.telefono
    current_user.confianza_ocr = resultado_ocr.get("confianza_ocr", 0.95)
    current_user.estado_documentos = resultado_ocr.get("estado_recomendado", "verificado")
    
    roles = current_user.roles_activos or []
    if "cliente" not in roles:
        roles.append("cliente")
    current_user.roles_activos = roles

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

    return current_user
