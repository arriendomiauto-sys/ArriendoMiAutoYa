"""
Helpers de Google Cloud Vision compartidos por el backend.

Dos features lo usan: censurar patentes en las fotos de autos
(app/services/image_privacy.py) y el OCR de documentos de identidad
(app/features/verificacion_identidad/ocr_engine.py). Este módulo concentra
la detección de credenciales y la URL REST para no duplicarla.
"""
import os
from typing import Optional, Tuple

from app.core.config import settings

VISION_REST_URL = "https://vision.googleapis.com/v1/images:annotate"


def credenciales_vision() -> Tuple[Optional[str], bool]:
    """Devuelve (api_key_valida | None, hay_service_account_bool).

    Una API key se considera válida si no es un placeholder evidente y tiene
    largo razonable. El service account se detecta por la existencia del
    archivo apuntado por GOOGLE_APPLICATION_CREDENTIALS.
    """
    api_key = settings.GOOGLE_CLOUD_VISION_API_KEY
    api_key_valida = (
        api_key
        and "your-" not in api_key.lower()
        and "placeholder" not in api_key.lower()
        and len(api_key.strip()) > 15
    )
    creds_path = settings.GOOGLE_APPLICATION_CREDENTIALS
    tiene_creds = bool(creds_path and os.path.exists(creds_path))
    return (api_key.strip() if api_key_valida else None), tiene_creds
