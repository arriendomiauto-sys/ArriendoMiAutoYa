"""Bucle de fondo que purga los PDF de certificados vencidos. Patrón de cancelacion_loop."""
import asyncio
import logging

from app.core.config import settings
from app.features.auth.background_checks import certificados_service

logger = logging.getLogger(__name__)


async def _bucle(session_factory) -> None:
    while True:
        try:
            await asyncio.sleep(max(1, settings.ANTECEDENTES_PURGA_INTERVALO_HORAS) * 3600)
            db = session_factory()
            try:
                purgados = certificados_service.purgar_certificados(db)
            finally:
                db.close()
            if purgados:
                logger.info("[antecedentes] Certificados purgados: %s", purgados)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception("[antecedentes] Falló una pasada de la purga; se reintenta")


def iniciar_bucle_purga_certificados(session_factory) -> asyncio.Task:
    return asyncio.create_task(_bucle(session_factory))
