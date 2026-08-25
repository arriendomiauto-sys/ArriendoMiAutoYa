from fastapi import APIRouter, Depends
from app.models.entities import Usuario
from app.schemas.schemas import UserOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])

@router.get("/me", response_model=UserOut, summary="Obtener el perfil del usuario autenticado")
async def get_me(current_user: Usuario = Depends(get_current_user)):
    return current_user
