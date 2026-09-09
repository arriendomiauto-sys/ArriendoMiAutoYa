"""
Pago de la reserva (checkout dual: cobro a débito + hold de garantía a crédito).

Va aparte del router de reservas para no engordarlo más: el resto del ciclo de
vida de la reserva (crear, listar, firmar, entregar) vive en
`app.features.bookings.reservations`.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter
from app.models.entities import Reserva, Usuario
from app.schemas.schemas import PagarReservaRequest
from app.features.auth.login.service import get_current_user
from app.features.payments import checkout_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reservas", tags=["Reservas · Pago"])


@router.post("/{reserva_id}/pagar", summary="Paga la reserva: cobra el arriendo y retiene la garantía")
@limiter.limit("10/minute")
def pagar_reserva(
    request: Request,
    reserva_id: str,
    payload: PagarReservaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if reserva.cliente_id != current_user.id:
        raise HTTPException(status_code=403, detail="Esta reserva no es tuya.")

    try:
        return checkout_service.procesar_pago(
            db, reserva, current_user,
            tarjeta_cobro_id=payload.tarjeta_cobro_id,
            tarjeta_garantia_id=payload.tarjeta_garantia_id,
            device_id=payload.device_id,
        )
    except checkout_service.CheckoutError as e:
        raise HTTPException(status_code=e.http_status, detail=e.as_detail())
