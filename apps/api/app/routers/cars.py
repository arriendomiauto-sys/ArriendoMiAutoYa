from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import AutoCreate, AutoUpdate, AutoOut
from app.models.entities import Auto, Usuario
from app.services.auth import get_current_user

router = APIRouter(prefix="/autos", tags=["Autos y Marketplace"])

@router.get("", response_model=List[AutoOut], summary="Buscar autos disponibles en el marketplace")
def listar_autos(
    ubicacion: Optional[str] = Query(None, description="Filtrar por ciudad/comuna"),
    estado: str = Query("activo", description="Estado de publicación"),
    tarifa_max: Optional[int] = Query(None, description="Tarifa máxima por día"),
    dueno_id: Optional[str] = Query(None, description="Filtrar por ID del dueño"),
    db: Session = Depends(get_db)
):
    query = db.query(Auto).filter(Auto.estado == estado)
    if ubicacion:
        query = query.filter(Auto.ubicacion_base.ilike(f"%{ubicacion}%"))
    if tarifa_max:
        query = query.filter(Auto.tarifa_dia <= tarifa_max)
    if dueno_id:
        query = query.filter(Auto.dueno_id == dueno_id)
    return query.all()

@router.get("/{auto_id}", response_model=AutoOut, summary="Obtener detalle de un auto")
def obtener_auto(auto_id: str, db: Session = Depends(get_db)):
    auto = db.query(Auto).filter(Auto.id == auto_id).first()
    if not auto:
        raise HTTPException(status_code=404, detail="Auto no encontrado")
    return auto

@router.post("", response_model=AutoOut, summary="Publicar un nuevo auto (Dueño)")
def crear_auto(
    payload: AutoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    # Verificar si la patente ya existe
    patente_existente = db.query(Auto).filter(Auto.patente == payload.patente.upper()).first()
    if patente_existente:
        raise HTTPException(status_code=400, detail="Ya existe un auto registrado con esta patente")

    # dueno_id siempre es el usuario autenticado: no se confía en el valor
    # que venga en el payload (evita que un cliente atribuya el auto a otro
    # usuario arbitrario).
    nuevo_auto = Auto(
        dueno_id=current_user.id,
        marca=payload.marca,
        modelo=payload.modelo,
        anio=payload.anio,
        patente=payload.patente.upper(),
        tarifa_dia=payload.tarifa_dia,
        ubicacion_base=payload.ubicacion_base,
        latitud=payload.latitud,
        longitud=payload.longitud,
        fotos=payload.fotos or []
    )
    # Asegurar que el usuario tenga el rol "dueno"
    roles = current_user.roles_activos or []
    if "dueno" not in roles:
        roles.append("dueno")
        current_user.roles_activos = roles

    db.add(nuevo_auto)
    db.commit()
    db.refresh(nuevo_auto)
    return nuevo_auto

@router.patch("/{auto_id}", response_model=AutoOut, summary="Editar o pausar auto publicado")
def actualizar_auto(
    auto_id: str,
    payload: AutoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    auto = db.query(Auto).filter(Auto.id == auto_id).first()
    if not auto:
        raise HTTPException(status_code=404, detail="Auto no encontrado")

    if auto.dueno_id != current_user.id and "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=403, detail="No tienes permiso para editar este auto.")

    if payload.tarifa_dia is not None:
        auto.tarifa_dia = payload.tarifa_dia
    if payload.estado is not None:
        auto.estado = payload.estado
    if payload.fotos is not None:
        auto.fotos = payload.fotos
    if payload.ubicacion_base is not None:
        auto.ubicacion_base = payload.ubicacion_base

    db.commit()
    db.refresh(auto)
    return auto
