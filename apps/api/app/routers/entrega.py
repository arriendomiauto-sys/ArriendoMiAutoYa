from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import (
    GenerateQRResponse,
    ValidateQRRequest,
    ValidateQRResponse,
    ConfirmVerificationRequest,
    ConfirmVerificationResponse,
    ChecklistRequest,
    ChecklistResponse
)
from app.services.delivery import DeliveryService
from app.services.auth import get_current_user_placeholder
from app.models.entities import Usuario

router = APIRouter(tags=["Flujo de Entrega y Devolución"])

@router.post(
    "/reservas/{reserva_id}/generar-codigo",
    response_model=GenerateQRResponse,
    summary="Genera el código QR para entrega o devolución (Cliente)"
)
def generar_codigo_entrega(
    reserva_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user_placeholder)
):
    """
    Genera y devuelve el hash del código QR de la reserva, junto con la URL de la foto
    de perfil verificada del cliente para cachear offline.
    """
    return DeliveryService.generar_codigo_qr(reserva_id, db)

@router.post(
    "/entrega/validar-codigo",
    response_model=ValidateQRResponse,
    summary="Escanea y valida el código QR presentado por el cliente (Dueño)"
)
def validar_codigo_entrega(
    payload: ValidateQRRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user_placeholder)
):
    """
    Devuelve los datos del auto, cliente y foto de perfil verificada para confirmación visual humana.
    """
    return DeliveryService.validar_codigo_qr(payload.codigo_qr_hash, db)

@router.post(
    "/entrega/{reserva_id}/confirmar-verificacion",
    response_model=ConfirmVerificationResponse,
    summary="Confirma o rechaza la identidad del cliente (Dueño)"
)
def confirmar_verificacion_identidad(
    reserva_id: str,
    payload: ConfirmVerificationRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user_placeholder)
):
    """
    Registra el resultado de la verificación visual manual.
    Si se rechaza, bloquea la reserva, solicita foto y motivo, y abre automáticamente una disputa formal.
    """
    return DeliveryService.confirmar_verificacion(
        reserva_id=reserva_id,
        resultado=payload.resultado,
        tipo=payload.tipo,
        dueno_id=current_user.id,
        db=db,
        foto_evidencia_url=payload.foto_evidencia_url,
        motivo_rechazo=payload.motivo_rechazo
    )

@router.post(
    "/entrega/{reserva_id}/checklist",
    response_model=ChecklistResponse,
    summary="Registra el checklist fotográfico del auto (Dueño)"
)
def registrar_checklist_auto(
    reserva_id: str,
    payload: ChecklistRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user_placeholder)
):
    """
    Registra checklist inicial (antes) o final (después).
    Al completar el checklist final, calcula el cobro total y registra la liquidación al dueño.
    """
    return DeliveryService.registrar_checklist(
        reserva_id=reserva_id,
        tipo=payload.tipo,
        fotos=payload.fotos,
        kilometraje=payload.kilometraje,
        nivel_combustible=payload.nivel_combustible,
        estado_limpieza=payload.estado_limpieza,
        cargo_limpieza_clp=payload.cargo_limpieza_clp,
        notas=payload.notas,
        db=db
    )
