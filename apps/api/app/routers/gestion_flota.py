from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import (
    MaintenanceCreate,
    MaintenanceOut,
    CalendarBlockCreate,
    CalendarBlockOut,
)
from app.models.entities import Usuario, Auto, MantencionAuto, BloqueoCalendarioAuto, Reserva
from app.services.auth import get_current_user
from app.core.limiter import limiter
from app.core.security_audit import SecurityAudit
from app.features.rastreo_gps.manager import GPSManager

router = APIRouter(tags=["Gestión de Flota (Mantenciones y Calendario)"])


def _obtener_auto_o_404(auto_id: str, db: Session) -> Auto:
    auto = db.query(Auto).filter(Auto.id == auto_id).first()
    if not auto:
        raise HTTPException(status_code=404, detail="Auto no encontrado")
    return auto


def _requerir_dueno_del_auto(auto: Auto, current_user: Usuario):
    if "admin" in (current_user.roles_activos or []):
        return
    if auto.dueno_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el dueño del vehículo puede realizar esta acción.")


# ==============================================================================
# MANTENCIONES Y DOCUMENTACIÓN LEGAL
# ==============================================================================
@router.get(
    "/autos/{auto_id}/mantenciones",
    response_model=List[MaintenanceOut],
    summary="Listar documentos legales y bitácora de taller de un auto",
)
def listar_mantenciones(auto_id: str, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    auto = _obtener_auto_o_404(auto_id, db)
    _requerir_dueno_del_auto(auto, current_user)
    return db.query(MantencionAuto).filter(MantencionAuto.auto_id == auto_id).order_by(MantencionAuto.creado_en.desc()).all()


@router.post(
    "/autos/{auto_id}/mantenciones",
    response_model=MaintenanceOut,
    summary="Registrar un documento legal o servicio de taller (Dueño)",
)
@limiter.limit("30/minute")
def crear_mantencion(
    request: Request,
    auto_id: str,
    payload: MaintenanceCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    auto = _obtener_auto_o_404(auto_id, db)
    _requerir_dueno_del_auto(auto, current_user)

    mantencion = MantencionAuto(auto_id=auto_id, **payload.model_dump())
    db.add(mantencion)
    db.commit()
    db.refresh(mantencion)
    return mantencion


@router.delete(
    "/mantenciones/{mantencion_id}",
    status_code=204,
    summary="Eliminar un registro de mantención (Dueño)",
)
def eliminar_mantencion(mantencion_id: str, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    mantencion = db.query(MantencionAuto).filter(MantencionAuto.id == mantencion_id).first()
    if not mantencion:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    auto = _obtener_auto_o_404(mantencion.auto_id, db)
    _requerir_dueno_del_auto(auto, current_user)
    db.delete(mantencion)
    db.commit()


# ==============================================================================
# CALENDARIO DE DISPONIBILIDAD (BLOQUEOS DE USO PERSONAL)
# ==============================================================================
@router.get(
    "/autos/{auto_id}/bloqueos",
    response_model=List[CalendarBlockOut],
    summary="Listar días bloqueados por uso personal de un auto",
)
def listar_bloqueos(auto_id: str, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    auto = _obtener_auto_o_404(auto_id, db)
    _requerir_dueno_del_auto(auto, current_user)
    return db.query(BloqueoCalendarioAuto).filter(BloqueoCalendarioAuto.auto_id == auto_id).all()


@router.post(
    "/autos/{auto_id}/bloqueos",
    response_model=CalendarBlockOut,
    summary="Bloquear un día del calendario para uso personal (Dueño)",
)
@limiter.limit("30/minute")
def crear_bloqueo(
    request: Request,
    auto_id: str,
    payload: CalendarBlockCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    auto = _obtener_auto_o_404(auto_id, db)
    _requerir_dueno_del_auto(auto, current_user)

    dia_reservado = db.query(Reserva).filter(
        Reserva.auto_id == auto_id,
        Reserva.estado.in_(["confirmada", "en_curso"]),
        Reserva.fecha_inicio <= payload.fecha,
        Reserva.fecha_fin > payload.fecha,
    ).first()
    if dia_reservado:
        raise HTTPException(status_code=400, detail="Ese día ya tiene una reserva confirmada, no se puede bloquear.")

    bloqueo = BloqueoCalendarioAuto(auto_id=auto_id, fecha=payload.fecha, motivo=payload.motivo)
    db.add(bloqueo)
    db.commit()
    db.refresh(bloqueo)
    return bloqueo


@router.delete(
    "/bloqueos/{bloqueo_id}",
    status_code=204,
    summary="Quitar un bloqueo del calendario (Dueño)",
)
def eliminar_bloqueo(bloqueo_id: str, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    bloqueo = db.query(BloqueoCalendarioAuto).filter(BloqueoCalendarioAuto.id == bloqueo_id).first()
    if not bloqueo:
        raise HTTPException(status_code=404, detail="Bloqueo no encontrado")
    auto = _obtener_auto_o_404(bloqueo.auto_id, db)
    _requerir_dueno_del_auto(auto, current_user)
    db.delete(bloqueo)
    db.commit()


# ==============================================================================
# RASTREO GPS
# ==============================================================================
class CorteMotorRequest(BaseModel):
    motivo: str = Field(..., min_length=10, description="Justificación del corte remoto de motor")
    reserva_id: str = Field(..., description="Reserva por la que se activa el protocolo de recuperación")


@router.get(
    "/autos/{auto_id}/gps/posicion",
    summary="Última posición conocida del vehículo (Dueño o Admin)",
)
def obtener_posicion_gps(
    auto_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    auto = _obtener_auto_o_404(auto_id, db)
    _requerir_dueno_del_auto(auto, current_user)

    if not auto.gps_consentimiento:
        raise HTTPException(
            status_code=403,
            detail="El dueño no ha autorizado el monitoreo GPS de este vehículo.",
        )
    if not auto.gps_device_id:
        raise HTTPException(status_code=404, detail="Este vehículo aún no tiene un equipo GPS instalado.")

    posicion = GPSManager.get_provider().obtener_posicion(auto.gps_device_id)
    if not posicion:
        raise HTTPException(status_code=503, detail="El equipo GPS no está reportando posición en este momento.")

    auto.gps_ultima_posicion = posicion.to_dict()
    db.commit()

    return {"auto_id": auto.id, "patente": auto.patente, "posicion": posicion.to_dict()}


@router.post(
    "/autos/{auto_id}/gps/cortar-motor",
    summary="Corte remoto de motor por no devolución del vehículo (Admin exclusivo)",
)
@limiter.limit("5/minute")
def cortar_motor_gps(
    request: Request,
    auto_id: str,
    payload: CorteMotorRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Último recurso para recuperar un vehículo no devuelto.

    El protocolo exige tres cosas antes de mandar el comando: que lo pida un
    Admin (nunca el dueño desde su app), que exista una reserva disputada o
    vencida sin devolver, y que quede el motivo registrado en la auditoría.
    """
    if "admin" not in (current_user.roles_activos or []):
        raise HTTPException(
            status_code=403,
            detail="Solo un administrador puede ordenar el corte remoto de motor.",
        )

    auto = _obtener_auto_o_404(auto_id, db)
    if not auto.gps_device_id:
        raise HTTPException(status_code=404, detail="Este vehículo aún no tiene un equipo GPS instalado.")

    reserva = db.query(Reserva).filter(
        Reserva.id == payload.reserva_id,
        Reserva.auto_id == auto_id,
    ).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada para este vehículo.")

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    fecha_fin = reserva.fecha_fin.replace(tzinfo=None) if reserva.fecha_fin.tzinfo else reserva.fecha_fin
    vencida_sin_devolver = reserva.estado == "en_curso" and fecha_fin < ahora

    if reserva.estado != "disputada" and not vencida_sin_devolver:
        raise HTTPException(
            status_code=400,
            detail=(
                "El corte de motor solo procede sobre una reserva disputada o vencida "
                "sin devolución del vehículo."
            ),
        )

    resultado = GPSManager.get_provider().cortar_motor(auto.gps_device_id, payload.motivo)

    SecurityAudit.log_event(
        event_type="GPS_CORTE_MOTOR",
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        resource=f"auto:{auto.id}",
        status="SUCCESS" if resultado.ejecutado else "FAILURE",
        details={"reserva_id": reserva.id, "motivo": payload.motivo, "patente": auto.patente},
    )

    return {"ejecutado": resultado.ejecutado, "mensaje": resultado.mensaje}
