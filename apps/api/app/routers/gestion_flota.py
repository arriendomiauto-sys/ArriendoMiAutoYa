from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List
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
