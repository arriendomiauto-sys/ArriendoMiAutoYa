"""
Dependencias de rol para el panel de administración.

El panel manda `Authorization: Bearer <access_token>`; acá solo se comprueba
que el usuario ya autenticado tenga el rol necesario.
"""
from fastapi import Depends, HTTPException, status

from app.models.entities import Usuario
from app.features.auth.login.service import get_current_user


def exigir_admin(current_user: Usuario = Depends(get_current_user)) -> Usuario:
    if "admin" not in (current_user.roles_activos or []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido al Administrador.",
        )
    return current_user


def exigir_admin_o_manager(current_user: Usuario = Depends(get_current_user)) -> Usuario:
    roles = current_user.roles_activos or []
    if "admin" not in roles and "manager" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido a Administrador o Manager.",
        )
    return current_user
