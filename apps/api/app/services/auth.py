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
    if not user and supa_email:
        user = db.query(Usuario).filter(Usuario.email == supa_email).first()
        if user:
            # Si el registro local tenía un id provisional, sincronizar con supa_id
            user.id = supa_id
            db.commit()
            db.refresh(user)

    def _inferir_roles_staff(email: Optional[str]) -> List[str]:
        e = (email or "").lower()
        if "admin" in e:
            return ["admin"]
        if "manager" in e:
            return ["manager"]
        if "soporte" in e:
            return ["soporte"]
        if "dueno" in e:
            return ["dueno", "cliente"]
        return ["cliente"]

    if not user:
        roles = _inferir_roles_staff(supa_email)
        user = Usuario(
            id=supa_id,
            email=supa_email,
            nombre="Usuario Staff" if any(r in ("admin", "manager", "soporte") for r in roles) else None,
            roles_activos=roles,
            estado_documentos="verificado" if any(r in ("admin", "manager", "soporte") for r in roles) else "pendiente",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Promover roles si es una cuenta staff reconocida
        email_str = (supa_email or user.email or "").lower()
        roles_actuales = list(user.roles_activos or [])
        cambio = False
        if ("admin" in email_str) and "admin" not in roles_actuales:
            roles_actuales.append("admin")
            cambio = True
        if ("manager" in email_str) and "manager" not in roles_actuales:
            roles_actuales.append("manager")
            cambio = True
        if ("soporte" in email_str) and "soporte" not in roles_actuales:
            roles_actuales.append("soporte")
            cambio = True
        if cambio:
            user.roles_activos = roles_actuales
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


async def get_optional_current_user(
    authorization: Optional[str] = Header(None, description="Bearer <supabase_access_token>"),
    db: Session = Depends(get_db)
) -> Optional[Usuario]:
    """
    Dependency opcional: devuelve el Usuario si el token es válido, o None si no hay token.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return await autenticar_token(authorization.split(" ", 1)[1], db)
    except Exception:
        return None
