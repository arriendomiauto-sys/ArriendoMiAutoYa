from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import TicketCreate, TicketOut
from app.models.entities import TicketSoporte, Disputa, Usuario
from app.services.auth import get_current_user_placeholder

router = APIRouter(prefix="/soporte", tags=["Soporte"])

@router.post("/tickets", response_model=TicketOut, summary="Crear ticket de soporte")
def crear_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user_placeholder)
):
    ticket = TicketSoporte(
        usuario_id=payload.usuario_id or current_user.id,
        sucursal_id=payload.sucursal_id or current_user.sucursal_id,
        asunto=payload.asunto,
        descripcion=payload.descripcion
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket

@router.get("/tickets", response_model=List[TicketOut], summary="Listar tickets (con filtro por sucursal)")
def listar_tickets(
    sucursal_id: Optional[str] = Query(None, description="Filtrar por sucursal"),
    db: Session = Depends(get_db)
):
    query = db.query(TicketSoporte)
    if sucursal_id:
        query = query.filter(TicketSoporte.sucursal_id == sucursal_id)
    return query.all()

@router.post("/tickets/{ticket_id}/escalar", response_model=TicketOut, summary="Escalar ticket a disputa formal (Manager)")
def escalar_ticket(
    ticket_id: str,
    reserva_id: str = Query(..., description="ID de la reserva asociada"),
    db: Session = Depends(get_db)
):
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
