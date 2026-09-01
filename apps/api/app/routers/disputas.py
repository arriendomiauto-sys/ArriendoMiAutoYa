from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.limiter import limiter
from app.core.security_audit import SecurityAudit
from app.schemas.schemas import DisputeOut, DisputeResolveRequest, DisputeCreate
from app.models.entities import Disputa, Reserva, Usuario
from app.services.auth import get_current_user

router = APIRouter(prefix="/disputas", tags=["Disputas (Manager & Admin)"])

def _requerir_admin_o_manager(current_user: Usuario):
    roles = current_user.roles_activos or []
    if "admin" not in roles and "manager" not in roles:
        raise HTTPException(status_code=403, detail="Acceso restringido a Manager o Admin.")

@router.get("", response_model=List[DisputeOut], summary="Listar disputas activas")
def listar_disputas(
    estado: str = "abierta",
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _requerir_admin_o_manager(current_user)
    return db.query(Disputa).filter(Disputa.estado == estado).all()

@router.get("/{disputa_id}", response_model=DisputeOut, summary="Obtener detalle y evidencia de una disputa")
def obtener_disputa(
    disputa_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _requerir_admin_o_manager(current_user)
    disputa = db.query(Disputa).filter(Disputa.id == disputa_id).first()
    if not disputa:
        raise HTTPException(status_code=404, detail="Disputa no encontrada")
    return disputa

@router.post("/{disputa_id}/resolver", response_model=DisputeOut, summary="Resolver formalmente una disputa (Admin)")
@limiter.limit("20/minute")
def resolver_disputa(
    request: Request,
    disputa_id: str,
    payload: DisputeResolveRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    if "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=403, detail="Solo un Admin puede resolver disputas formalmente.")

    disputa = db.query(Disputa).filter(Disputa.id == disputa_id).first()
    if not disputa:
        raise HTTPException(status_code=404, detail="Disputa no encontrada")

    disputa.estado = "resuelta"
    disputa.resolucion = f"[{payload.accion_pago}] {payload.resolucion}"
    disputa.admin_asignado_id = current_user.id

    reserva = db.query(Reserva).filter(Reserva.id == disputa.reserva_id).first()
    if reserva:
        reserva.estado = "cancelada" if "reembolso" in payload.accion_pago else "finalizada"

    db.commit()
    db.refresh(disputa)
    return disputa
