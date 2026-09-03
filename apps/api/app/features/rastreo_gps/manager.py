"""
Gestor modular de rastreo GPS (GPSManager).

Mismo patrón que `KYCManager`: el proveedor activo se resuelve por
configuración (`settings.GPS_PROVIDER`) y los tests pueden inyectar el suyo.
"""
import logging
from typing import Optional

from app.core.config import settings
from app.features.rastreo_gps.base_provider import BaseGPSProvider

logger = logging.getLogger(__name__)


class GPSManager:
    _current_provider: Optional[BaseGPSProvider] = None

    @classmethod
    def get_provider(cls) -> BaseGPSProvider:
        if cls._current_provider is not None:
            return cls._current_provider

        provider_name = (settings.GPS_PROVIDER or "mock").lower()

        # Mientras no haya vendor contratado, cualquier nombre desconocido cae
        # al mock en vez de reventar el arranque de la API.
        if provider_name != "mock":
            logger.warning(
                "[GPSManager] Proveedor '%s' no implementado; se usa el mock.", provider_name
            )

        from app.features.rastreo_gps.providers.mock_provider import MockGPSProvider
        cls._current_provider = MockGPSProvider()

        logger.info("[GPSManager] Proveedor activo: %s", cls._current_provider.nombre_proveedor)
        return cls._current_provider

    @classmethod
    def set_provider(cls, provider: BaseGPSProvider) -> None:
        cls._current_provider = provider

    @classmethod
    def reset_provider(cls) -> None:
        cls._current_provider = None
