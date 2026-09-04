from typing import List, Optional
import httpx
from fastapi import HTTPException, status, Header, Depends
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.entities import Usuario, Sucursal

class AuthService:
    @staticmethod
    def verificar_rol(usuario: Usuario, roles_permitidos: List[str]):
        """
        Verifica que el usuario tenga al menos uno de los roles permitidos.
        """
        roles_usuario = usuario.roles_activos or ["cliente"]
        if not any(rol in roles_permitidos for rol in roles_usuario):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado: se requiere uno de los roles {roles_permitidos}"
            )

    @staticmethod
    def verificar_acceso_sucursal_placeholder(
        usuario: Usuario,
        sucursal_id: Optional[str],
        ip_cliente: Optional[str] = None,
        lat_cliente: Optional[float] = None,
        lon_cliente: Optional[float] = None,
        db: Optional[Session] = None
    ) -> bool:
        """
        Placeholder para la restricción de acceso de Manager a su sucursal.
        (Mecanismo exacto IP/VPN/Geolocalización a definir con el negocio).
        """
        # Si es admin, tiene acceso global
        if "admin" in (usuario.roles_activos or []):
            return True

        # Si es manager, validar sucursal asignada
        if "manager" in (usuario.roles_activos or []):
            if sucursal_id and usuario.sucursal_id and usuario.sucursal_id != sucursal_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Acceso denegado: No está autorizado para operar fuera de su sucursal asignada."
                )
            return True

        return True

async def autenticar_token(token: str, db: Session) -> Usuario:
    """
    Valida un access token de Supabase Auth y devuelve el Usuario local,
    auto-provisionando la fila en el primer request.

    Vive aparte de `get_current_user` porque los WebSockets no pueden mandar
    cabeceras propias desde el navegador ni desde React Native: el token les
    llega por query string y necesitan la misma validación sin depender de
    `Header`.
    """
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.SUPABASE_ANON_KEY
            }
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    data = resp.json()
    supa_id = data.get("id")
    supa_email = data.get("email")

    user = db.query(Usuario).filter(Usuario.id == supa_id).first()
    if not user:
        user = Usuario(id=supa_id, email=supa_email, roles_activos=["cliente"])
        db.add(user)
        db.commit()
        db.refresh(user)

    return user


async def get_current_user(
    authorization: str = Header(None, description="Bearer <supabase_access_token>"),
    db: Session = Depends(get_db)
) -> Usuario:
    """
    Dependency real de autenticación: valida el access token de Supabase Auth
    (enviado como 'Authorization: Bearer <token>') contra el endpoint
    /auth/v1/user de Supabase, y auto-provisiona/sincroniza la fila local
    de Usuario (keyed por el mismo id de Supabase Auth) en el primer request.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autenticado")

    return await autenticar_token(authorization.split(" ", 1)[1], db)
