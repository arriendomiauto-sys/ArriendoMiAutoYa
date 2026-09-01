from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import TicketCreate, TicketOut
from app.models.entities import TicketSoporte, Disputa, Usuario
from app.services.auth import get_current_user

router = APIRouter(prefix="/soporte", tags=["Soporte"])

@router.post("/tickets", response_model=TicketOut, summary="Crear ticket de soporte")
def crear_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    ticket = TicketSoporte(
        usuario_id=current_user.id,
        sucursal_id=payload.sucursal_id or current_user.sucursal_id,
        asunto=payload.asunto,
        descripcion=payload.descripcion
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket

@router.get("/mis-tickets", response_model=List[TicketOut], summary="Listar los tickets creados por el usuario autenticado")
def listar_mis_tickets(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return db.query(TicketSoporte).filter(TicketSoporte.usuario_id == current_user.id).order_by(TicketSoporte.timestamp.desc()).all()

def _requerir_admin_o_manager(current_user: Usuario):
    roles = current_user.roles_activos or []
    if "admin" not in roles and "manager" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso restringido a Manager o Admin.")

@router.get("/tickets", response_model=List[TicketOut], summary="Listar tickets (con filtro por sucursal)")
def listar_tickets(
    sucursal_id: Optional[str] = Query(None, description="Filtrar por sucursal"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _requerir_admin_o_manager(current_user)
    query = db.query(TicketSoporte)

    roles = current_user.roles_activos or []
    if "admin" not in roles:
        # Un Manager solo ve los tickets de su propia sucursal, sin importar
        # qué sucursal_id se pida por query param.
        query = query.filter(TicketSoporte.sucursal_id == current_user.sucursal_id)
    elif sucursal_id:
        query = query.filter(TicketSoporte.sucursal_id == sucursal_id)

    return query.all()

@router.post("/tickets/{ticket_id}/cerrar", response_model=TicketOut, summary="Marcar un ticket como resuelto localmente (Manager)")
def cerrar_ticket(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _requerir_admin_o_manager(current_user)
    ticket = db.query(TicketSoporte).filter(TicketSoporte.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    ticket.estado = "cerrado"
    db.commit()
    db.refresh(ticket)
    return ticket

@router.post("/tickets/{ticket_id}/escalar", response_model=TicketOut, summary="Escalar ticket a disputa formal (Manager)")
def escalar_ticket(
    ticket_id: str,
    reserva_id: str = Query(..., description="ID de la reserva asociada"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _requerir_admin_o_manager(current_user)
    ticket = db.query(TicketSoporte).filter(TicketSoporte.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")

    # Crear disputa
    disputa = Disputa(
        reserva_id=reserva_id,
        tipo="otro",
        motivo=f"Escalado desde Ticket {ticket.id}: {ticket.asunto} - {ticket.descripcion}"
    )
    db.add(disputa)
    db.commit()
    db.refresh(disputa)

    ticket.escalado_a_disputa = True
    ticket.disputa_id = disputa.id
    db.commit()
    db.refresh(ticket)
    return ticket
