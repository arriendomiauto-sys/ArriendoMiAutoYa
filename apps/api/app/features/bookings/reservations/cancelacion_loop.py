"""Bucle de fondo del barrido de reservas (TTL y garantías colgadas). Patrón de liquidaciones_loop."""
import asyncio
import logging

from app.core.config import settings
from app.features.bookings.reservations import cancelacion_service

logger = logging.getLogger(__name__)


def _hubo_trabajo(resultado) -> bool:
    """Los resultados pueden anidar dicts (p. ej. no_presentaciones): un dict con ceros no es trabajo."""
    if isinstance(resultado, dict):
        return any(_hubo_trabajo(v) for v in resultado.values())
    return bool(resultado)


def _pasada(session_factory):
    db = session_factory()
    try:
        return cancelacion_service.barrido_reservas(db)
    finally:
        db.close()


async def _bucle(session_factory) -> None:
    while True:
        try:
            await asyncio.sleep(max(1, settings.RESERVAS_BARRIDO_INTERVALO_MINUTOS) * 60)
            # En un hilo aparte: la pasada llama a Mercado Pago (reembolsos, capturas,
            # conciliación) y en el event loop dejaba a la API sin responder mientras tanto.
            resultado = await asyncio.to_thread(_pasada, session_factory)
            if _hubo_trabajo(resultado):
                logger.info("[reservas] Barrido: %s", resultado)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception("[reservas] Falló una pasada del barrido; se reintenta")


def iniciar_bucle_barrido_reservas(session_factory) -> asyncio.Task:
    return asyncio.create_task(_bucle(session_factory))
