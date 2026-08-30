from fastapi import APIRouter, Depends, Body
from typing import Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import Usuario
from app.schemas.schemas import UserOut, CuentaBancariaUpdate, PerfilBasicoUpdate
from app.services.auth import get_current_user

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])

@router.get("/me", response_model=UserOut, summary="Obtener el perfil del usuario autenticado")
async def get_me(current_user: Usuario = Depends(get_current_user)):
    return current_user

@router.put(
    "/me/perfil-basico",
    response_model=UserOut,
    summary="Actualizar nombre/teléfono de una cuenta simple (sin pasar por KYC)",
)
def actualizar_perfil_basico(
    payload: PerfilBasicoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    current_user.nombre = payload.nombre
    if payload.telefono is not None:
        current_user.telefono = payload.telefono
    db.commit()
    db.refresh(current_user)
    return current_user

@router.put(
    "/me/cuenta-bancaria",
    response_model=UserOut,
    summary="Registrar/actualizar la cuenta bancaria de depósito del dueño",
)
def actualizar_cuenta_bancaria(
    payload: CuentaBancariaUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    current_user.cuenta_bancaria = payload.model_dump()
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put(
    "/me/push-token",
    summary="Registrar el token de notificaciones push (expo-notifications) del dispositivo",
)
def registrar_push_token(
    expo_push_token: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    current_user.expo_push_token = (expo_push_token or "").strip() or None
    db.commit()
    return {"ok": True}
