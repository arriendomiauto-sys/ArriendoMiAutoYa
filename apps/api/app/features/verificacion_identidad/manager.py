"""
Gestor modular de Verificación de Identidad y Biometría (KYCManager).

Permite seleccionar dinámicamente el proveedor de verificación (Veridas, Google Vision, Mock)
y resuelve la carga segura de imágenes desde URLs, Storage local o base64 en el backend.
"""
import logging
from typing import Dict, Any, Optional
from app.core.config import settings
from app.features.verificacion_identidad.base_provider import BaseKYCProvider, KYCResult
from app.features.verificacion_identidad.providers.veridas_provider import VeridasProvider

logger = logging.getLogger(__name__)


class KYCManager:
    _current_provider: Optional[BaseKYCProvider] = None

    @classmethod
    def get_provider(cls) -> BaseKYCProvider:
        """
        Retorna la instancia del proveedor de verificación activo configurado.
        """
        if cls._current_provider is not None:
            return cls._current_provider

        provider_name = (settings.KYC_PROVIDER or "veridas").lower()

        if provider_name == "veridas":
            cls._current_provider = VeridasProvider(
                api_url=settings.VERIDAS_API_URL,
                api_key=settings.VERIDAS_API_KEY,
            )
        elif provider_name in ("google_vision", "google", "vision"):
            from app.features.verificacion_identidad.providers.google_provider import GoogleVisionProvider
            cls._current_provider = GoogleVisionProvider()
        else:
            cls._current_provider = VeridasProvider()

        logger.info(f"[KYCManager] Proveedor activo: {cls._current_provider.nombre_proveedor}")
        return cls._current_provider

    @classmethod
    def set_provider(cls, provider: BaseKYCProvider) -> None:
        """
        Permite fijar un proveedor explícito (útil para pruebas unitarias y mocks).
        """
        cls._current_provider = provider

    @classmethod
    def reset_provider(cls) -> None:
        cls._current_provider = None

    @classmethod
    def procesar_enrolamiento(
        cls,
        carnet_frontal_url: Optional[str] = None,
        carnet_trasero_url: Optional[str] = None,
        licencia_url: Optional[str] = None,
        rut_usuario: Optional[str] = None,
        selfie_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Descarga las imágenes desde sus fuentes seguras y ejecuta el KYC con el proveedor activo.
        """
        from app.features.verificacion_identidad.ocr_engine import OCRService

        img_frontal = OCRService.descargar_imagen_bytes(carnet_frontal_url) if carnet_frontal_url else None
        img_trasero = OCRService.descargar_imagen_bytes(carnet_trasero_url) if carnet_trasero_url else None
        img_licencia = OCRService.descargar_imagen_bytes(licencia_url) if licencia_url else None
        img_selfie = OCRService.descargar_imagen_bytes(selfie_url) if selfie_url else None

        provider = cls.get_provider()
        resultado: KYCResult = provider.procesar_kyc(
            carnet_frontal_bytes=img_frontal,
            carnet_trasero_bytes=img_trasero,
            licencia_bytes=img_licencia,
            selfie_bytes=img_selfie,
            rut_esperado=rut_usuario,
        )

        return resultado.to_dict()
