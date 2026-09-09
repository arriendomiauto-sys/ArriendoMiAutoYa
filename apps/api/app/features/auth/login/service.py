from typing import List, Optional
import hashlib
import time
import httpx
from jose import jwt, JWTError
from fastapi import HTTPException, status, Header, Depends
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.entities import Usuario, Sucursal

# ============================================================================
# Cache en proceso de validación de sesión
# ----------------------------------------------------------------------------
# Antes CADA request autenticado hacía una llamada de red a
# `{SUPABASE_URL}/auth/v1/user` para validar el token. Abrir una pantalla que
# dispara 5-8 requests pagaba 5-8 round-trips a Supabase; si Supabase estaba
# lento, la app entera se arrastraba. Ahora se valida una vez y se cachea el
# `user_id` por token durante `_TOKEN_CACHE_TTL_SEG`. TTL corto: una promoción
# de rol o una revocación de acceso se refleja al vencer la entrada.
# ============================================================================
_TOKEN_CACHE: dict = {}
_TOKEN_CACHE_TTL_SEG = 300
_TOKEN_CACHE_MAX = 4096


def _clave_cache(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _cache_leer(token: str) -> Optional[str]:
    entrada = _TOKEN_CACHE.get(_clave_cache(token))
    if not entrada:
        return None
    user_id, expira_en = entrada
    if time.time() >= expira_en:
        _TOKEN_CACHE.pop(_clave_cache(token), None)
        return None
    return user_id


def _cache_guardar(token: str, user_id: str) -> None:
    # Sin LRU real: al crecer demasiado se vacía entero (los tokens vivos se
    # recachean solos en el siguiente request).
    if len(_TOKEN_CACHE) >= _TOKEN_CACHE_MAX:
        _TOKEN_CACHE.clear()
    _TOKEN_CACHE[_clave_cache(token)] = (user_id, time.time() + _TOKEN_CACHE_TTL_SEG)


def limpiar_cache_tokens() -> None:
    """Vacía el cache de sesiones. Se usa desde los tests para aislarlos."""
    _TOKEN_CACHE.clear()


def _decodificar_jwt_local(token: str) -> Optional[dict]:
    """
    Verifica la firma del access token de Supabase sin salir a la red. Solo
    aplica si `SUPABASE_JWT_SECRET` está configurado y el proyecto firma con
    HS256 (el default histórico de Supabase). Si el proyecto usa llaves
    asimétricas (ES256/RS256) o falta el secret, devuelve `None` y el llamador
    cae al camino HTTP.
    """
    secret = getattr(settings, "SUPABASE_JWT_SECRET", None)
    if not secret:
        return None
    try:
        # `verify_aud=False`: Supabase pone `aud="authenticated"`, pero no vale
        # la pena arriesgar un mismatch de config por un check redundante — la
        # firma y el `exp` ya se validan.
        return jwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
    except JWTError:
        return None

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

    Estrategia (de más barato a más caro):
      1. Cache en proceso: si el token ya se validó hace poco, se relee la
         fila local y listo (sin red).
      2. Verificación local del JWT: si hay `SUPABASE_JWT_SECRET`, se valida
         la firma y el `exp` sin salir a la red.
      3. Fallback HTTP: se consulta `{SUPABASE_URL}/auth/v1/user` con timeout.

    Vive aparte de `get_current_user` porque los WebSockets/Socket.IO no pueden
    mandar cabeceras propias: el token les llega por query string.
    """
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")

    # 1. Bloque: cache en proceso
    cached_id = _cache_leer(token)
    if cached_id:
        user = db.query(Usuario).filter(Usuario.id == cached_id).first()
        if user:
            return user  # entrada de cache válida
        # la fila ya no existe (DB reiniciada en tests, borrado): revalidar

    # 2. Bloque: verificación local del JWT (sin red)
    claims = _decodificar_jwt_local(token)
    if claims and claims.get("sub"):
        user = _sincronizar_usuario_local(db, claims["sub"], claims.get("email"))
        _cache_guardar(token, user.id)
        return user

    # 3. Bloque: fallback HTTP contra Supabase Auth (con timeout acotado)
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"{settings.SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.SUPABASE_ANON_KEY,
                },
            )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo validar la sesión con el proveedor de identidad. Inténtalo de nuevo.",
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    data = resp.json()
    supa_id = data.get("id")
    supa_email = data.get("email")
    if not supa_id:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    user = _sincronizar_usuario_local(db, supa_id, supa_email)
    _cache_guardar(token, user.id)
    return user


def _sincronizar_usuario_local(db: Session, supa_id: str, supa_email: Optional[str]) -> Usuario:
    """
    Devuelve el Usuario local para un id/email de Supabase Auth, creándolo en
    el primer request y promoviendo roles de staff si el email lo indica.
    """
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
