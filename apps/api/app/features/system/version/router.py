"""
Verificación de versión mínima soportada de la app móvil. Público (sin
auth): se consulta al arrancar, antes de cualquier login.
"""
from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(prefix="/system", tags=["Sistema"])


@router.get("/version", summary="Versión mínima soportada de la app móvil")
def obtener_version_minima():
    return {
        "version_minima": settings.MIN_APP_VERSION,
        "url_store_ios": settings.APP_STORE_URL_IOS,
        "url_store_android": settings.APP_STORE_URL_ANDROID,
    }
