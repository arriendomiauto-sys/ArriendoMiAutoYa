# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import RatingCreate, RatingOut
from app.models.entities import Calificacion, Reserva, Usuario
from app.services.auth import get_current_user_placeholder

router = APIRouter(prefix="/calificaciones", tags=["Calificaciones (Sistema Bidireccional)"])

@router.post("", response_model=RatingOut, summary="Calificar contraparte al finalizar reserva (Dueño o Cliente)")
def crear_calificacion(
    payload: RatingCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user_placeholder)
):
    reserva = db.query(Reserva).filter(Reserva.id == payload.reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    
    if reserva.estado != "finalizada":
        raise HTTPException(status_code=400, detail="Solo se pueden emitir calificaciones para arriendos finalizados.")

    calificacion = Calificacion(
        reserva_id=payload.reserva_id,
        autor_id=payload.autor_id or current_user.id,
        autor_rol=payload.autor_rol,
        destinatario_id=payload.destinatario_id,
        puntaje=payload.puntaje,
        comentario=payload.comentario
    )
    db.add(calificacion)
    db.commit()
    db.refresh(calificacion)
    return calificacion

@router.get("", response_model=List[RatingOut], summary="Listar calificaciones (por usuario destinatario o reserva)")
def listar_calificaciones(
    destinatario_id: Optional[str] = Query(None, description="ID del usuario calificado"),
    reserva_id: Optional[str] = Query(None, description="ID de la reserva"),
    db: Session = Depends(get_db)
):
    query = db.query(Calificacion)
    if destinatario_id:
        query = query.filter(Calificacion.destinatario_id == destinatario_id)
    if reserva_id:
        query = query.filter(Calificacion.reserva_id == reserva_id)
    return query.all()
