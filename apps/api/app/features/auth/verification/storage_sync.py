"""
Synchronization and persistence of verification assets to permanent Supabase Storage.
"""
from typing import Optional, Dict, Mapping, Any
import logging
import httpx

from app.features.system.storage.service import StorageService

logger = logging.getLogger(__name__)

# Tiempo máximo de descarga de un asset del proveedor externo.
_DOWNLOAD_TIMEOUT_SECONDS = 20.0

# Mapa: clave lógica del documento -> prefijo de nombre en el bucket.
_ASSET_KEYS = {
    "verified_avatar_url": "verified_avatar",
    "front_card_url": "id_card_front",
    "back_card_url": "id_card_back",
    "license_front_url": "driver_license_front",
    "license_back_url": "driver_license_back",
}


# ============================================================================
# Función: Descargar un asset externo (Didit) y almacenarlo en Supabase Storage
# ============================================================================
def persist_external_asset(
    asset_url: Optional[str],
    destination_prefix: str,
    user_id: str,
    bucket: str = "documentos-kyc",
) -> Optional[str]:
    """
    Descarga una imagen temporal del proveedor externo y la persiste de forma
    permanente en el storage privado de Supabase. Devuelve la URL definitiva
    (firmada) o `None` si la descarga o la subida fallan — el llamador nunca
    debe romperse por esto.
    """
    # Bloque: Guardas de entrada
    if not asset_url:
        return None
    # Si ya es una URL de nuestro propio storage, no se vuelve a descargar.
    if "/storage/v1/object/" in asset_url or "/storage/local/" in asset_url:
        return asset_url

    try:
        # Bloque: Descarga del archivo desde el proveedor externo
        with httpx.Client(timeout=_DOWNLOAD_TIMEOUT_SECONDS, follow_redirects=True) as client:
            response = client.get(asset_url)
        if response.status_code != 200 or not response.content:
            logger.warning(
                "No se pudo descargar el asset externo (%s): HTTP %s",
                destination_prefix, response.status_code,
            )
            return None

        # Bloque: Subida permanente al bucket privado mediante StorageService
        file_name = f"{destination_prefix}_{user_id}.jpg"
        result = StorageService.subir_archivo(
            response.content,
            nombre_original=file_name,
            content_type=response.headers.get("content-type") or "image/jpeg",
            bucket=bucket,
        )
        if result and result.get("success"):
            return result.get("url")
        logger.warning("StorageService rechazó el asset %s: %s", destination_prefix, result)
        return None
    except Exception as error:  # noqa: BLE001 — best-effort, nunca propaga
        logger.error("Error al persistir asset externo %s: %s", asset_url, error)
        return None


# ============================================================================
# Función: Persistir en lote todas las fotos de una verificación externa
# ============================================================================
def persist_verification_assets(
    assets: Mapping[str, Any],
    user_id: str,
    bucket: str = "documentos-kyc",
) -> Dict[str, str]:
    """
    Recibe un dict con las URLs temporales del proveedor (claves de
    `_ASSET_KEYS`: cédula frontal/reverso, selfie biométrica y licencia) y
    devuelve otro dict con solo las que se lograron persistir de forma
    permanente, con la URL definitiva de Supabase Storage.
    """
    # Bloque: Recorrido por cada tipo de documento conocido
    persisted: Dict[str, str] = {}
    for key, prefix in _ASSET_KEYS.items():
        saved = persist_external_asset(assets.get(key), prefix, user_id, bucket=bucket)
        if saved:
            persisted[key] = saved
    return persisted
