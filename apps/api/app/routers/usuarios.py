from fastapi import APIRouter, Depends, Body, HTTPException
from typing import Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import Usuario
from app.schemas.schemas import UserOut, CuentaBancariaUpdate, PerfilBasicoUpdate, TarjetaUpdate, TarjetaOut
from app.services.auth import get_current_user
from app.services import tarjetas

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])

@router.get("/me", response_model=UserOut, summary="Obtener el perfil del usuario autenticado")
async def get_me(current_user: Usuario = Depends(get_current_user)):
    return current_user

@router.put(
    "/me/tarjeta",
    response_model=TarjetaOut,
    summary="Registrar o reemplazar la tarjeta de crédito fuera del enrolamiento inicial",
)
def actualizar_tarjeta(
    payload: TarjetaUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    # Sin identidad verificada no hay con qué comparar el nombre del
    # titular — la tarjeta se pide junto al KYC la primera vez para que no
    # exista ninguna ventana donde se acepte una tarjeta sin ese cruce.
    if current_user.estado_documentos != "verificado":
        raise HTTPException(
            status_code=403,
            detail="Verifica tu identidad antes de registrar una tarjeta.",
        )

    resultado = tarjetas.validar_tarjeta(
        payload.tarjeta_token,
        payload.tarjeta_ultimos4,
        payload.tarjeta_marca,
        titular=payload.tarjeta_titular,
        nombre_cuenta=current_user.nombre,
    )

    current_user.tarjeta_token = payload.tarjeta_token
    current_user.tarjeta_ultimos4 = payload.tarjeta_ultimos4
    current_user.tarjeta_marca = resultado["marca"]
    current_user.tarjeta_estado = resultado["estado"]
    current_user.tarjeta_titular = payload.tarjeta_titular
    db.commit()
    db.refresh(current_user)

    return TarjetaOut(
        tarjeta_estado=current_user.tarjeta_estado,
        tarjeta_ultimos4=current_user.tarjeta_ultimos4,
        tarjeta_marca=current_user.tarjeta_marca,
        motivo=resultado["motivo"],
    )

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
