"""Bucle de fondo que barre las liquidaciones pendientes. Patrón de reminders_service."""
import asyncio
import logging

from app.core.config import settings
from app.features.payments import liquidaciones_service

logger = logging.getLogger(__name__)


def _pasada(session_factory):
    db = session_factory()
    try:
        return liquidaciones_service.ejecutar_liquidaciones_pendientes(db)
    finally:
        db.close()


async def _bucle(session_factory) -> None:
    while True:
        try:
            await asyncio.sleep(max(1, settings.LIQUIDACIONES_INTERVALO_MINUTOS) * 60)
            # En un hilo aparte: las transferencias al BCI son HTTP bloqueante y en el
            # event loop dejaban a la API sin responder mientras duraban.
            await asyncio.to_thread(_pasada, session_factory)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception("[liquidaciones] Falló una pasada del bucle; se reintenta")


def iniciar_bucle_liquidaciones(session_factory) -> asyncio.Task:
    return asyncio.create_task(_bucle(session_factory))
