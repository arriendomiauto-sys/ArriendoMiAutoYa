"""
Instancia compartida del limiter (slowapi). Vive en su propio módulo para
que tanto app/main.py (donde se registra en la app) como los routers
individuales (donde se aplican límites más estrictos por endpoint) puedan
importarla sin generar un import circular.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.RATE_LIMIT_STORAGE_URI,
    default_limits=[settings.RATE_LIMIT_DEFAULT],
)
