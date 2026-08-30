from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.schemas import NotificacionOut
from app.models.entities import Notificacion, Usuario
from app.services.auth import get_current_user

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])


@router.get("", response_model=List[NotificacionOut], summary="Notificaciones del usuario autenticado")
def listar_notificaciones(
    solo_no_leidas: bool = Query(False),
    limite: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    q = db.query(Notificacion).filter(Notificacion.usuario_id == current_user.id)
    if solo_no_leidas:
        q = q.filter(Notificacion.leido.is_(False))
    return q.order_by(Notificacion.creado_en.desc()).limit(limite).all()


@router.get("/conteo-no-leidas", summary="Cantidad de notificaciones sin leer")
def conteo_no_leidas(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    n = (
        db.query(Notificacion)
        .filter(Notificacion.usuario_id == current_user.id, Notificacion.leido.is_(False))
        .count()
    )
    return {"no_leidas": n}


@router.post("/{notificacion_id}/leida", response_model=NotificacionOut, summary="Marcar una notificación como leída")
def marcar_leida(
    notificacion_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    n = (
        db.query(Notificacion)
        .filter(Notificacion.id == notificacion_id, Notificacion.usuario_id == current_user.id)
        .first()
    )
    if not n:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    n.leido = True
    db.commit()
    db.refresh(n)
    return n


@router.post("/marcar-todas-leidas", summary="Marcar todas las notificaciones como leídas")
def marcar_todas_leidas(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    actualizadas = (
        db.query(Notificacion)
        .filter(Notificacion.usuario_id == current_user.id, Notificacion.leido.is_(False))
        .update({Notificacion.leido: True}, synchronize_session=False)
    )
    db.commit()
    return {"marcadas": actualizadas}
