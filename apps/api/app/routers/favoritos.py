from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import AutoOut
from app.models.entities import Auto, Favorito, Usuario
from app.services.auth import get_current_user
from app.routers.cars import _adjuntar_calificaciones

router = APIRouter(prefix="/favoritos", tags=["Favoritos"])


@router.get("", response_model=List[AutoOut], summary="Autos marcados como favoritos por el usuario autenticado")
def listar_favoritos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    autos = (
        db.query(Auto)
        .join(Favorito, Favorito.auto_id == Auto.id)
        .filter(Favorito.usuario_id == current_user.id)
        .order_by(Favorito.timestamp.desc())
        .all()
    )
    return _adjuntar_calificaciones(db, autos)


@router.get(
    "/ids",
    response_model=List[str],
    summary="IDs de autos favoritos del usuario (para marcar el corazón en el marketplace sin traer todo el auto)",
)
def listar_ids_favoritos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    filas = db.query(Favorito.auto_id).filter(Favorito.usuario_id == current_user.id).all()
    return [auto_id for (auto_id,) in filas]


@router.post("/{auto_id}", summary="Marcar un auto como favorito")
def agregar_favorito(
    auto_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    auto = db.query(Auto).filter(Auto.id == auto_id).first()
    if not auto:
        raise HTTPException(status_code=404, detail="Auto no encontrado")

    existente = (
        db.query(Favorito)
        .filter(Favorito.usuario_id == current_user.id, Favorito.auto_id == auto_id)
        .first()
    )
    if not existente:
        db.add(Favorito(usuario_id=current_user.id, auto_id=auto_id))
        try:
            db.commit()
        except IntegrityError:
            # Doble tap del corazón: dos requests casi simultáneas pueden
            # pasar el chequeo de arriba antes de que cualquiera confirme.
            # La segunda choca con el UniqueConstraint — es exactamente lo
            # mismo que ya estaba marcado, no un error real.
            db.rollback()
    return {"es_favorito": True}


@router.delete("/{auto_id}", summary="Quitar un auto de favoritos")
def quitar_favorito(
    auto_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    db.query(Favorito).filter(
        Favorito.usuario_id == current_user.id, Favorito.auto_id == auto_id
    ).delete()
    db.commit()
    return {"es_favorito": False}
