from fastapi import APIRouter, Depends, HTTPException, Query, Response
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import BookingCreate, BookingOut
from app.models.entities import Reserva, Auto, Usuario, Pago
from app.services.pricing import PricingService
from app.services.contract import ContractService
from app.services.auth import get_current_user_placeholder
import uuid

from app.core.validators import validar_disponibilidad_reserva

router = APIRouter(prefix="/reservas", tags=["Reservas"])

@router.post("", response_model=BookingOut, summary="Crear una nueva solicitud de reserva (Cliente)")
def crear_reserva(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user_placeholder)
):
    auto = db.query(Auto).filter(Auto.id == payload.auto_id).first()
    if not auto:
        raise HTTPException(status_code=404, detail="Auto no encontrado")
    if auto.estado != "activo":
        raise HTTPException(status_code=400, detail="El auto no está disponible para arriendo")

    # Validar que no haya solapamiento de fechas con reservas existentes
    if not validar_disponibilidad_reserva(payload.auto_id, payload.fecha_inicio, payload.fecha_fin, db):
        raise HTTPException(
            status_code=400,
            detail="El vehículo no se encuentra disponible para las fechas seleccionadas (ya cuenta con otra reserva activa)."
        )

    # Calcular monto de hold
    dias = PricingService.calcular_dias_reserva(payload.fecha_inicio, payload.fecha_fin)
    monto_hold = PricingService.calcular_monto_hold_reserva(auto.tarifa_dia, dias)

    reserva_id = str(uuid.uuid4())
    contrato_url = f"/api/v1/reservas/{reserva_id}/contrato-pdf"

    reserva = Reserva(
        id=reserva_id,
        auto_id=payload.auto_id,
        cliente_id=payload.cliente_id or current_user.id,
        fecha_inicio=payload.fecha_inicio,
        fecha_fin=payload.fecha_fin,
        estado="confirmada", # En flujo normal pasa a confirmada tras aceptar el hold
        monto_hold=monto_hold,
        lugar_entrega_acordado=payload.lugar_entrega_acordado,
        contrato_pdf_url=contrato_url
    )
    db.add(reserva)

    # Registrar retención (hold) de la tarjeta
    pago_hold = Pago(
        reserva_id=reserva.id,
        usuario_id=reserva.cliente_id,
        tipo="hold_reserva",
        monto=monto_hold,
        estado="capturado",
        referencia_transbank=f"TBK-RES-{uuid.uuid4().hex[:8].upper()}"
    )
    db.add(pago_hold)
    db.commit()
    db.refresh(reserva)
    return reserva

@router.get("", response_model=List[BookingOut], summary="Listar reservas del usuario actual")
def listar_reservas(
    rol: Optional[str] = Query(None, description="Filtrar por rol: 'cliente' o 'dueno'"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user_placeholder)
):
    if rol == "dueno":
        # Reservas asociadas a los autos del dueño
        autos_ids = [a.id for a in current_user.autos]
        return db.query(Reserva).filter(Reserva.auto_id.in_(autos_ids)).all()
    elif rol == "cliente":
        return db.query(Reserva).filter(Reserva.cliente_id == current_user.id).all()
    else:
        return db.query(Reserva).all()

@router.get("/{reserva_id}", response_model=BookingOut, summary="Detalle de una reserva")
def obtener_reserva(reserva_id: str, db: Session = Depends(get_db)):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    return reserva

@router.get("/{reserva_id}/contrato-pdf", summary="Descargar contrato digital de arriendo en PDF")
def descargar_contrato_pdf(reserva_id: str, db: Session = Depends(get_db)):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    cliente = db.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    dueno = db.query(Usuario).filter(Usuario.id == auto.dueno_id).first() if auto else None

    dias = PricingService.calcular_dias_reserva(reserva.fecha_inicio, reserva.fecha_fin)
    tarifa_dia = auto.tarifa_dia if auto else 35000
    subtotal = dias * tarifa_dia

    cfg = PricingService.obtener_configuracion(db)

    pdf_bytes = ContractService.generar_contrato_pdf(
        reserva_id=reserva.id,
        dueno_nombre=dueno.nombre if dueno else "Dueño Registrado",
        dueno_rut=dueno.rut if dueno else "15.892.341-6",
        dueno_telefono=dueno.telefono if dueno else "+56912345678",
        cliente_nombre=cliente.nombre if cliente else "Cliente Arrendatario",
        cliente_rut=cliente.rut if cliente else "19.234.567-7",
        cliente_telefono=cliente.telefono if cliente else "+56987654321",
        auto_marca=auto.marca if auto else "Toyota",
        auto_modelo=auto.modelo if auto else "RAV4",
        auto_anio=auto.anio if auto else 2022,
        auto_patente=auto.patente if auto else "BBCL-10",
        fecha_inicio=reserva.fecha_inicio,
        fecha_fin=reserva.fecha_fin,
        lugar_entrega=reserva.lugar_entrega_acordado,
        tarifa_dia_clp=tarifa_dia,
        dias=dias,
        monto_total_estimado_clp=subtotal,
        valor_uf_clp=float(cfg.valor_uf_clp)
    )

    filename = f"Contrato-Arriendo-{auto.patente if auto else 'AUTO'}-{reserva.id[:8].upper()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'}
    )

@router.patch("/{reserva_id}/estado", response_model=BookingOut, summary="Actualizar estado de reserva (Aceptar/Rechazar)")
def actualizar_estado_reserva(
    reserva_id: str,
    nuevo_estado: str = Query(..., description="Nuevo estado: 'confirmada', 'cancelada'"),
    db: Session = Depends(get_db)
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    
    reserva.estado = nuevo_estado
    db.commit()
    db.refresh(reserva)
    return reserva
