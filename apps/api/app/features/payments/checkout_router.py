"""
Pago de la reserva (checkout dual: cobro a débito + hold de garantía a crédito).

Va aparte del router de reservas para no engordarlo más: el resto del ciclo de
vida de la reserva (crear, listar, firmar, entregar) vive en
`app.features.bookings.reservations`.
"""
import logging

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter
from app.models.entities import Auto, Reserva, Usuario
from app.schemas.schemas import PagarReservaRequest, CobroPosteriorRequest, CobroPosteriorOut
from app.features.auth.login.service import get_current_user
from app.features.payments import checkout_service, cargos_service
from app.features.communications.notifications.service import crear_notificacion

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


@router.post(
    "/{reserva_id}/cobro-posterior",
    response_model=CobroPosteriorOut,
    summary="Reportar y cobrar peaje, TAG o multa de tránsito dentro de los 30 días posteriores al arriendo",
)
@limiter.limit("10/minute")
def cobrar_posterior(
    request: Request,
    reserva_id: str,
    payload: CobroPosteriorRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada.")
    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    if not auto:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")

    # Solo el dueño del vehículo o un administrador pueden emitir cobros posteriores
    es_dueno = auto.dueno_id == current_user.id
    es_admin = "admin" in (current_user.roles_activos or [])
    if not (es_dueno or es_admin):
        raise HTTPException(
            status_code=403,
            detail="Solo el dueño del vehículo o un administrador pueden emitir cobros posteriores.",
        )

    if reserva.estado != "finalizada":
        raise HTTPException(
            status_code=400,
            detail=f"Solo se pueden registrar cobros posteriores en arriendos finalizados (estado actual: {reserva.estado}).",
        )

    # Ventana máxima de 30 días desde el fin del arriendo
    if reserva.fecha_fin:
        fecha_fin_utc = (
            reserva.fecha_fin.replace(tzinfo=timezone.utc)
            if reserva.fecha_fin.tzinfo is None
            else reserva.fecha_fin
        )
        dias_pasados = (datetime.now(timezone.utc) - fecha_fin_utc).days
        if dias_pasados > 30:
            raise HTTPException(
                status_code=400,
                detail="El plazo de 30 días para reportar cobros posteriores de TAG o multas ha expirado.",
            )

    # El cobro es del dueño: se le cobra al arrendatario con tope en la garantía de la reserva
    # y lo cobrado se le abona al dueño (cargos_service). La referencia es la clave de
    # idempotencia de MP: única por cobro, si no un segundo peaje de la misma reserva
    # devolvería el pago del primero sin cobrar nada nuevo.
    cliente = db.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    try:
        pago_posterior, abono = cargos_service.cobrar_cargo_a_tarjeta_de_credito(
            db, reserva, f"cobro_posterior_{payload.tipo.lower()}", payload.monto
        )
    except cargos_service.CargoError as e:
        raise HTTPException(status_code=e.http_status, detail=e.mensaje)
    db.commit()
    db.refresh(pago_posterior)
    cargos_service.liquidar_sin_bloquear(db, abono)

    # Notificar al cliente con el desglose y aviso
    crear_notificacion(
        db,
        usuario_id=reserva.cliente_id,
        tipo="pago",
        titulo=f"Cobro posterior de {payload.tipo.upper()}",
        mensaje=(
            f"Se ha registrado un cobro de ${payload.monto:,} CLP por concepto de {payload.tipo.upper()} "
            f"para el arriendo del {auto.marca} {auto.modelo}. Motivo: {payload.descripcion}."
        ),
        entidad_tipo="reserva",
        entidad_id=reserva.id,
        commit=True,
    )

    return CobroPosteriorOut(
        id=pago_posterior.id,
        reserva_id=reserva.id,
        tipo=payload.tipo,
        monto=payload.monto,
        estado=pago_posterior.estado,
        referencia_pago=pago_posterior.referencia_pago,
        descripcion=payload.descripcion,
        comprobante_url=payload.comprobante_url,
        creado_en=pago_posterior.timestamp if pago_posterior.timestamp else datetime.now(timezone.utc),
    )
