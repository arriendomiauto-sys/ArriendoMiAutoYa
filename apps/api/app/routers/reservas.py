from fastapi import APIRouter, Depends, HTTPException, Query, Response, Request
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from datetime import datetime, timezone, timedelta
from app.schemas.schemas import (
    BookingCreate,
    BookingOut,
    ExtendBookingRequest,
    PreCheckinRequest,
    PreCheckinResponse,
    AplicarMultaRequest,
)
from app.models.entities import Reserva, Auto, Usuario, Pago
from app.services.pricing import PricingService
from app.services.contract import ContractService
from app.services.fines import FinesService
from app.services.notificaciones import crear_notificacion
from app.services.auth import get_current_user
from app.core.limiter import limiter
import uuid

from app.core.validators import validar_disponibilidad_reserva

router = APIRouter(prefix="/reservas", tags=["Reservas"])

@router.post("", response_model=BookingOut, summary="Crear una nueva solicitud de reserva (Cliente)")
@limiter.limit("20/minute")
def crear_reserva(
    request: Request,
    payload: BookingCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    # La cuenta se crea simple (sin RUT ni documentos); recién acá, al
    # reservar de verdad un vehículo, se exige identidad verificada — no en
    # el registro.
    if current_user.estado_documentos != "verificado":
        raise HTTPException(
            status_code=403,
            detail="Debes verificar tu identidad antes de reservar un vehículo."
        )

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

    # cliente_id siempre es el usuario autenticado: no se confía en el valor
    # del payload (evita crear reservas y holds a nombre de otro usuario).
    # La reserva nace "pendiente": se confirma recién cuando el hold de
    # garantía queda autorizado en Webpay (POST /pagos/webpay/confirmar).
    # El pago NO se crea acá — lo crea /pagos/webpay/iniciar con el token real.
    reserva = Reserva(
        id=reserva_id,
        auto_id=payload.auto_id,
        cliente_id=current_user.id,
        fecha_inicio=payload.fecha_inicio,
        fecha_fin=payload.fecha_fin,
        estado="pendiente",
        monto_hold=monto_hold,
        lugar_entrega_acordado=payload.lugar_entrega_acordado,
        contrato_pdf_url=contrato_url
    )
    db.add(reserva)
    db.commit()
    db.refresh(reserva)
    return reserva

@router.get("", response_model=List[BookingOut], summary="Listar reservas del usuario actual")
def listar_reservas(
    rol: Optional[str] = Query(None, description="Filtrar por rol: 'cliente' o 'dueno'"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    if rol == "dueno":
        # Reservas asociadas a los autos del dueño
        autos_ids = [a.id for a in current_user.autos]
        return db.query(Reserva).filter(Reserva.auto_id.in_(autos_ids)).all()
    elif rol == "cliente":
        return db.query(Reserva).filter(Reserva.cliente_id == current_user.id).all()
    else:
        return db.query(Reserva).all()

def _verificar_acceso_reserva(reserva: Reserva, current_user: Usuario, db: Session):
    if "admin" in (current_user.roles_activos or []):
        return
    if reserva.cliente_id == current_user.id:
        return
    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    if auto and auto.dueno_id == current_user.id:
        return
    raise HTTPException(status_code=403, detail="No tienes permiso para acceder a esta reserva.")

@router.get("/{reserva_id}", response_model=BookingOut, summary="Detalle de una reserva")
def obtener_reserva(
    reserva_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    _verificar_acceso_reserva(reserva, current_user, db)
    return reserva

@router.get("/{reserva_id}/contrato-pdf", summary="Descargar contrato digital de arriendo en PDF")
def descargar_contrato_pdf(
    reserva_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    _verificar_acceso_reserva(reserva, current_user, db)

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
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    _verificar_acceso_reserva(reserva, current_user, db)

    reserva.estado = nuevo_estado
    db.commit()
    db.refresh(reserva)
    return reserva

@router.post(
    "/{reserva_id}/extender",
    response_model=BookingOut,
    summary="Extender la fecha de devolución de una reserva activa (Cliente)"
)
@limiter.limit("10/minute")
def extender_reserva(
    request: Request,
    reserva_id: str,
    payload: ExtendBookingRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if reserva.cliente_id != current_user.id and "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=403, detail="Solo el arrendatario de esta reserva puede extenderla.")
    if reserva.estado not in ("confirmada", "en_curso"):
        raise HTTPException(status_code=400, detail="Solo se puede extender una reserva confirmada o en curso.")

    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    nueva_fecha_fin = reserva.fecha_fin + timedelta(days=payload.dias_adicionales)

    if not validar_disponibilidad_reserva(reserva.auto_id, reserva.fecha_fin, nueva_fecha_fin, db, excluir_reserva_id=reserva.id):
        raise HTTPException(
            status_code=400,
            detail="El vehículo ya tiene otra reserva confirmada en los días solicitados para la extensión."
        )

    monto_adicional = PricingService.calcular_monto_hold_reserva(auto.tarifa_dia, payload.dias_adicionales)

    reserva.fecha_fin = nueva_fecha_fin
    reserva.monto_hold += monto_adicional
    db.add(Pago(
        reserva_id=reserva.id,
        usuario_id=reserva.cliente_id,
        tipo="hold_reserva",
        monto=monto_adicional,
        estado="capturado",
        referencia_transbank=f"TBK-EXT-{uuid.uuid4().hex[:8].upper()}"
    ))
    db.commit()
    db.refresh(reserva)
    return reserva

@router.post(
    "/{reserva_id}/precheckin",
    response_model=PreCheckinResponse,
    summary="Realizar Pre-Checkin 24h antes del viaje (Cliente o Dueño)"
)
def realizar_precheckin(
    reserva_id: str,
    payload: PreCheckinRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    _verificar_acceso_reserva(reserva, current_user, db)

    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    ahora = datetime.now(timezone.utc)

    if payload.rol == "cliente":
        if reserva.cliente_id != current_user.id and "admin" not in (current_user.roles_activos or []):
            raise HTTPException(status_code=403, detail="Solo el arrendatario puede confirmar el precheck del cliente.")
        reserva.precheck_cliente_confirmado = True
        reserva.precheck_cliente_timestamp = ahora

        if auto:
            crear_notificacion(
                db,
                usuario_id=auto.dueno_id,
                tipo="reserva",
                titulo="Arrendatario listo para mañana",
                mensaje=f"{current_user.nombre} completó el pre-checkin para la entrega en {reserva.lugar_entrega_acordado}.",
                entidad_tipo="reserva",
                entidad_id=reserva.id,
            )
    else:
        if (not auto or auto.dueno_id != current_user.id) and "admin" not in (current_user.roles_activos or []):
            raise HTTPException(status_code=403, detail="Solo el dueño del vehículo puede confirmar este precheck.")
        reserva.precheck_dueno_confirmado = True
        reserva.precheck_dueno_timestamp = ahora

        crear_notificacion(
            db,
            usuario_id=reserva.cliente_id,
            tipo="reserva",
            titulo="Vehículo preparado para entrega",
            mensaje=f"El anfitrión confirmó que tu {auto.marca if auto else 'auto'} estará listo en {reserva.lugar_entrega_acordado}.",
            entidad_tipo="reserva",
            entidad_id=reserva.id,
        )

    db.commit()
    db.refresh(reserva)

    ambos = bool(reserva.precheck_cliente_confirmado and reserva.precheck_dueno_confirmado)
    msg = (
        "¡Pre-checkin completado! Ambas partes han confirmado la entrega de mañana."
        if ambos
        else f"Pre-checkin registrado para {payload.rol}. Esperando confirmación de la contraparte."
    )

    return {
        "reserva_id": reserva.id,
        "precheck_cliente_confirmado": reserva.precheck_cliente_confirmado or False,
        "precheck_cliente_timestamp": reserva.precheck_cliente_timestamp,
        "precheck_dueno_confirmado": reserva.precheck_dueno_confirmado or False,
        "precheck_dueno_timestamp": reserva.precheck_dueno_timestamp,
        "ambos_confirmados": ambos,
        "mensaje": msg,
    }

@router.get(
    "/{reserva_id}/precheckin",
    response_model=PreCheckinResponse,
    summary="Consultar estado del Pre-Checkin 24h antes"
)
def obtener_estado_precheckin(
    reserva_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    _verificar_acceso_reserva(reserva, current_user, db)

    ambos = bool(reserva.precheck_cliente_confirmado and reserva.precheck_dueno_confirmado)
    return {
        "reserva_id": reserva.id,
        "precheck_cliente_confirmado": reserva.precheck_cliente_confirmado or False,
        "precheck_cliente_timestamp": reserva.precheck_cliente_timestamp,
        "precheck_dueno_confirmado": reserva.precheck_dueno_confirmado or False,
        "precheck_dueno_timestamp": reserva.precheck_dueno_timestamp,
        "ambos_confirmados": ambos,
        "mensaje": "Pre-checkin completo" if ambos else "Pendiente de confirmación",
    }

@router.post(
    "/{reserva_id}/aplicar-multa",
    response_model=BookingOut,
    summary="Reportar y aplicar multa o cargo por falta en arriendo (Dueño o Admin)"
)
def aplicar_multa_reserva(
    reserva_id: str,
    payload: AplicarMultaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    es_dueno = auto and auto.dueno_id == current_user.id
    es_admin = "admin" in (current_user.roles_activos or [])

    if not es_dueno and not es_admin:
        raise HTTPException(status_code=403, detail="Solo el anfitrión del vehículo o un administrador pueden reportar multas.")

    if reserva.estado not in ("confirmada", "en_curso", "finalizada", "disputada"):
        raise HTTPException(status_code=400, detail="Solo se pueden aplicar multas en reservas activas o finalizadas.")

    item_multa = FinesService.validar_y_calcular_multa(
        tipo=payload.tipo,
        monto_clp=payload.monto_clp,
        motivo=payload.motivo,
        fotos=payload.fotos,
    )

    monto = item_multa["monto_clp"]

    # Actualizar campos de multas en la reserva
    detalles = list(reserva.multas_detalle or [])
    detalles.append(item_multa)
    reserva.multas_detalle = detalles

    reserva.cargo_falta_grave_clp = (reserva.cargo_falta_grave_clp or 0) + monto
    reserva.cargos_adicionales_clp = (reserva.cargos_adicionales_clp or 0) + monto
    reserva.monto_cobro_final = (reserva.monto_cobro_final or 0) + monto
    reserva.liquidacion_dueno_clp = (reserva.liquidacion_dueno_clp or 0) + monto

    desglose_txt = f"[{item_multa['nombre']}: ${monto:,} CLP - {payload.motivo}]"
    if reserva.motivo_multas:
        reserva.motivo_multas += f" | {desglose_txt}"
    else:
        reserva.motivo_multas = desglose_txt

    # Registrar cobro por la multa
    pago_multa = Pago(
        reserva_id=reserva.id,
        usuario_id=reserva.cliente_id,
        tipo=f"cargo_{payload.tipo}",
        monto=monto,
        estado="capturado",
        referencia_transbank=f"TBK-FINE-{uuid.uuid4().hex[:8].upper()}"
    )
    db.add(pago_multa)

    # Notificar al cliente con el detalle transparente
    crear_notificacion(
        db,
        usuario_id=reserva.cliente_id,
        tipo="reserva",
        titulo="Cargo por falta / penalización",
        mensaje=f"Se ha aplicado un cargo de ${monto:,} CLP por '{item_multa['nombre']}'. Motivo: {payload.motivo}.",
        entidad_tipo="reserva",
        entidad_id=reserva.id,
    )

    db.commit()
    db.refresh(reserva)
    return reserva
