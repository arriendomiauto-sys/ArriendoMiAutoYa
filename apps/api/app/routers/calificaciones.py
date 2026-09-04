# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import RatingCreate, RatingOut
from app.models.entities import Auto, Calificacion, Reserva, Usuario
from app.services.auth import get_current_user

router = APIRouter(prefix="/calificaciones", tags=["Calificaciones (Sistema Bidireccional)"])

@router.post("", response_model=RatingOut, summary="Calificar contraparte al finalizar reserva (Dueño o Cliente)")
def crear_calificacion(
    payload: RatingCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    reserva = db.query(Reserva).filter(Reserva.id == payload.reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reserva.estado != "finalizada":
        raise HTTPException(status_code=400, detail="Solo se pueden emitir calificaciones para arriendos finalizados.")

    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    dueno_id = auto.dueno_id if auto else None

    # Sin esto, cualquier usuario autenticado podía calificar CUALQUIER
    # reserva ajena con un destinatario_id arbitrario — ni el rol declarado
    # ni el destinatario venían verificados contra los participantes reales
    # de la reserva. Se deriva el destinatario del lado servidor (nunca del
    # payload) y se exige que quien califica sea de verdad esa parte.
    if payload.autor_rol == "cliente":
        if current_user.id != reserva.cliente_id:
            raise HTTPException(status_code=403, detail="No eres el arrendatario de esta reserva.")
        destinatario_id = dueno_id
    else:
        if not dueno_id or current_user.id != dueno_id:
            raise HTTPException(status_code=403, detail="No eres el dueño del vehículo de esta reserva.")
        destinatario_id = reserva.cliente_id

    if not destinatario_id:
        raise HTTPException(status_code=400, detail="No se pudo determinar a quién calificar en esta reserva.")

    ya_calificada = (
        db.query(Calificacion)
        .filter(Calificacion.reserva_id == payload.reserva_id, Calificacion.autor_id == current_user.id)
        .first()
    )
    if ya_calificada:
        raise HTTPException(status_code=400, detail="Ya calificaste esta reserva.")

    # autor_id siempre es el usuario autenticado: no se confía en el valor
    # del payload (evita que alguien firme una calificación como si fuera
    # otro usuario).
    calificacion = Calificacion(
        reserva_id=payload.reserva_id,
        autor_id=current_user.id,
        autor_rol=payload.autor_rol,
        destinatario_id=destinatario_id,
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
    calificaciones = query.order_by(Calificacion.timestamp.desc()).all()

    # El nombre del autor no es columna de Calificacion: se resuelve acá con
    # un solo query en vez de N+1 (uno por reseña) desde el cliente.
    autor_ids = {c.autor_id for c in calificaciones}
    nombres = {}
    if autor_ids:
        nombres = dict(
            db.query(Usuario.id, Usuario.nombre).filter(Usuario.id.in_(autor_ids)).all()
        )
    for c in calificaciones:
        c.autor_nombre = nombres.get(c.autor_id)

    return calificaciones
