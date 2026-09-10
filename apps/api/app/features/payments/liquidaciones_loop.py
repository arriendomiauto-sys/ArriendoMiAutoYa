"""Bucle de fondo que barre las liquidaciones pendientes. Patrón de reminders_service."""
import asyncio
import logging

from app.core.config import settings
from app.features.payments import liquidaciones_service

logger = logging.getLogger(__name__)


async def _bucle(session_factory) -> None:
    intervalo = max(1, settings.LIQUIDACIONES_INTERVALO_MINUTOS) * 60
    while True:
        try:
            await asyncio.sleep(intervalo)
            db = session_factory()
            try:
                liquidaciones_service.ejecutar_liquidaciones_pendientes(db)
            finally:
                db.close()
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception("[liquidaciones] Falló una pasada del bucle; se reintenta")


def iniciar_bucle_liquidaciones(session_factory) -> asyncio.Task:
    return asyncio.create_task(_bucle(session_factory))
