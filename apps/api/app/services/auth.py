from typing import List, Optional
from fastapi import HTTPException, status, Header, Depends
from sqlalchemy.orm import Session
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

def get_current_user_placeholder(
    x_user_id: Optional[str] = Header(None, description="ID del usuario autenticado (placeholder)"),
    db: Session = Depends(get_db)
) -> Usuario:
    """
    Dependency para obtener el usuario actual. En producción valida el JWT de Supabase Auth.
    En modo desarrollo permite pasar el header X-User-Id o usa el primer usuario disponible.
    """
    if x_user_id:
        user = db.query(Usuario).filter(Usuario.id == x_user_id).first()
        if user:
            return user
    
    # Fallback para pruebas si no se envía header
    first_user = db.query(Usuario).first()
    if first_user:
        return first_user

    # Crear usuario demo si la BD está vacía
    demo_user = Usuario(
        nombre="Usuario Demo",
        rut="12.345.678-9",
        email="demo@arriendatuauto.cl",
        roles_activos=["dueno", "cliente", "manager", "admin"]
    )
    db.add(demo_user)
    db.commit()
    db.refresh(demo_user)
    return demo_user
