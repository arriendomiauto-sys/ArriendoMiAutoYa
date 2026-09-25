import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import (
    GenerateQRResponse,
    ValidateQRRequest,
    ValidateQRResponse,
    ConfirmVerificationRequest,
    ConfirmVerificationResponse,
    ChecklistRequest,
    ChecklistResponse,
    AIDamageAnalysisRequest,
    AIDamageAnalysisResponse
)
from app.features.bookings.delivery.service import DeliveryService
from app.features.bookings.delivery.ai_damage_service import AIDamageService
from app.features.auth.login.service import get_current_user
from app.features.communications.messages.socketio_server import sio
from app.models.entities import Usuario, Reserva, Auto

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Flujo de Entrega y Devolución"])


def _obtener_reserva_o_404(reserva_id: str, db: Session) -> Reserva:
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    return reserva


def _requerir_cliente_de_reserva(reserva: Reserva, current_user: Usuario):
    if "admin" in (current_user.roles_activos or []):
        return
    if reserva.cliente_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el arrendatario de esta reserva puede generar su código.")


def _requerir_dueno_del_auto(reserva: Reserva, current_user: Usuario, db: Session):
    if "admin" in (current_user.roles_activos or []):
        return
    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    if not auto or auto.dueno_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el dueño del vehículo puede realizar esta acción.")


@router.post(
    "/reservas/{reserva_id}/generar-codigo",
    response_model=GenerateQRResponse,
    summary="Genera el código QR para entrega o devolución (Cliente)"
)
def generar_codigo_entrega(
    reserva_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Genera y devuelve el hash del código QR de la reserva, junto con la URL de la foto
    de perfil verificada del cliente para cachear offline.
    """
    reserva = _obtener_reserva_o_404(reserva_id, db)
    _requerir_cliente_de_reserva(reserva, current_user)
    return DeliveryService.generar_codigo_qr(reserva_id, db)

@router.post(
    "/entrega/validar-codigo",
    response_model=ValidateQRResponse,
    summary="Escanea y valida el código QR presentado por el cliente (Dueño)"
)
def validar_codigo_entrega(
    payload: ValidateQRRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Devuelve los datos del auto, cliente y foto de perfil verificada para confirmación visual humana.
    """
    resultado = DeliveryService.validar_codigo_qr(payload.codigo_qr_hash, db)
    reserva = _obtener_reserva_o_404(resultado["reserva_id"], db)
    _requerir_dueno_del_auto(reserva, current_user, db)
    DeliveryService.registrar_escaneo_qr(reserva, db)
    return resultado

@router.post(
    "/entrega/{reserva_id}/confirmar-verificacion",
    response_model=ConfirmVerificationResponse,
    summary="Confirma o rechaza la identidad del cliente (Dueño)"
)
async def confirmar_verificacion_identidad(
    reserva_id: str,
    payload: ConfirmVerificationRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Registra el resultado de la verificación visual manual.
    Si se rechaza, bloquea la reserva, solicita foto y motivo, y abre automáticamente una disputa formal.
    """
    reserva = _obtener_reserva_o_404(reserva_id, db)
    _requerir_dueno_del_auto(reserva, current_user, db)
    resultado = DeliveryService.confirmar_verificacion(
        reserva_id=reserva_id,
        resultado=payload.resultado,
        tipo=payload.tipo,
        dueno_id=current_user.id,
        db=db,
        foto_evidencia_url=payload.foto_evidencia_url,
        motivo_rechazo=payload.motivo_rechazo
    )
    if payload.resultado == "confirmada":
        # El cliente puede seguir mirando su pantalla de código QR: se le
        # avisa por el socket de la reserva en vez de obligarlo a volver a
        # entrar a la app para enterarse de que ya lo verificaron.
        try:
            await sio.emit(
                "entrega_confirmada",
                {"reserva_id": reserva_id, "tipo": payload.tipo, "resultado": resultado.get("siguiente_paso")},
                room=f"reserva_{reserva_id}",
            )
        except Exception as e:
            logger.warning("[SOCKET.IO] No se pudo emitir entrega_confirmada: %s", e)
    return resultado

@router.post(
    "/entrega/{reserva_id}/checklist",
    response_model=ChecklistResponse,
    summary="Registra el checklist fotográfico del auto (Dueño)"
)
def registrar_checklist_auto(
    reserva_id: str,
    payload: ChecklistRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Registra checklist inicial (antes) o final (después).
    Al completar el checklist final, calcula el cobro total y registra la liquidación al dueño.
    """
    reserva = _obtener_reserva_o_404(reserva_id, db)
    _requerir_dueno_del_auto(reserva, current_user, db)
    resultado = DeliveryService.registrar_checklist(
        reserva_id=reserva_id,
        tipo=payload.tipo,
        fotos=payload.fotos,
        kilometraje=payload.kilometraje,
        nivel_combustible=payload.nivel_combustible,
        estado_limpieza=payload.estado_limpieza,
        cargo_limpieza_clp=payload.cargo_limpieza_clp,
        notas=payload.notas,
        selfie_entrega_url=payload.selfie_entrega_url,
        firma_svg=payload.firma_svg,
        db=db
    )

    from app.features.communications.notifications.service import crear_notificacion
    if payload.tipo == "antes":
        crear_notificacion(
            db, usuario_id=reserva.cliente_id, tipo="entrega",
            titulo="Arriendo iniciado",
            mensaje="El dueño registró la entrega. ¡Buen viaje!",
            entidad_tipo="reserva", entidad_id=reserva_id,
        )
    else:
        crear_notificacion(
            db, usuario_id=reserva.cliente_id, tipo="entrega",
            titulo="Devolución confirmada",
            mensaje="El arriendo quedó cerrado. Tu garantía se libera tras la inspección.",
            entidad_tipo="reserva", entidad_id=reserva_id,
        )
    return resultado


@router.post(
    "/entrega/{reserva_id}/analisis-ia",
    response_model=AIDamageAnalysisResponse,
    summary="Peritaje visual asistido por IA para detección de daños (Dueño, Cliente y Admin)"
)
def analizar_danos_ia(
    reserva_id: str,
    payload: AIDamageAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Compara las fotos del checklist inicial vs. las fotos del checklist final y calcula
    probabilidades de daños (rayones, abolladuras, etc.) mediante visión multimodal.
    """
    reserva = _obtener_reserva_o_404(reserva_id, db)
    roles = current_user.roles_activos or []
    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    es_dueno = auto and auto.dueno_id == current_user.id
    es_cliente = reserva.cliente_id == current_user.id
    es_admin = "admin" in roles or "manager" in roles

    if not (es_dueno or es_cliente or es_admin):
        raise HTTPException(status_code=403, detail="No tienes permiso para consultar el peritaje de esta reserva.")

    return AIDamageService.analizar_danos(
        reserva_id=reserva_id,
        fotos_despues=payload.fotos_despues,
        fotos_antes=payload.fotos_antes,
        notas=payload.notas,
        db=db,
    )

