from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import MessageCreate, MessageOut
from app.models.entities import Usuario, Reserva, Auto, Mensaje
from app.services.auth import get_current_user
from app.core.limiter import limiter

router = APIRouter(prefix="/reservas", tags=["Mensajería (Chat por Reserva)"])


def _obtener_reserva_o_404(reserva_id: str, db: Session) -> Reserva:
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    return reserva


def _requerir_parte_de_la_reserva(reserva: Reserva, current_user: Usuario, db: Session):
    if "admin" in (current_user.roles_activos or []):
        return
    if reserva.cliente_id == current_user.id:
        return
    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    if auto and auto.dueno_id == current_user.id:
        return
    raise HTTPException(status_code=403, detail="No tienes permiso para acceder a esta conversación.")


@router.get(
    "/{reserva_id}/mensajes",
    response_model=List[MessageOut],
    summary="Listar los mensajes de coordinación de una reserva",
)
def listar_mensajes(
    reserva_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = _obtener_reserva_o_404(reserva_id, db)
    _requerir_parte_de_la_reserva(reserva, current_user, db)
    return (
        db.query(Mensaje)
        .filter(Mensaje.reserva_id == reserva_id)
        .order_by(Mensaje.timestamp.asc())
        .all()
    )


@router.post(
    "/{reserva_id}/mensajes",
    response_model=MessageOut,
    summary="Enviar un mensaje de coordinación en una reserva",
)
@limiter.limit("60/minute")
def enviar_mensaje(
    request: Request,
    reserva_id: str,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = _obtener_reserva_o_404(reserva_id, db)
    _requerir_parte_de_la_reserva(reserva, current_user, db)

    mensaje = Mensaje(reserva_id=reserva_id, autor_id=current_user.id, texto=payload.texto)
    db.add(mensaje)
    db.commit()
    db.refresh(mensaje)

    # Avisar a la otra parte de la reserva (dueño <-> cliente).
    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    destinatario_id = (
        auto.dueno_id if (auto and current_user.id == reserva.cliente_id) else reserva.cliente_id
    )
    if destinatario_id and destinatario_id != current_user.id:
        from app.services.notificaciones import crear_notificacion
        crear_notificacion(
            db,
            usuario_id=destinatario_id,
            tipo="mensaje",
            titulo="Nuevo mensaje",
            mensaje=(payload.texto[:120] + "…") if len(payload.texto) > 120 else payload.texto,
            entidad_tipo="reserva",
            entidad_id=reserva_id,
        )
    return mensaje
