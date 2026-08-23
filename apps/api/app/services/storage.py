import os
import uuid
import logging
from typing import Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    BUCKETS_PERMITIDOS = ["autos", "documentos-kyc", "checklists", "evidencias", "general"]

    @classmethod
    def subir_archivo(
        cls,
        contenido_bytes: bytes,
        nombre_original: str,
        content_type: str = "image/jpeg",
        bucket: str = "general"
    ) -> Dict[str, Any]:
        """
        Sube un archivo binario a Supabase Storage (o al almacenamiento local de respaldo).
        Retorna la URL pública y metadatos del archivo.
        """
        if bucket not in cls.BUCKETS_PERMITIDOS:
            bucket = "general"

        # Generar nombre único seguro
        extension = os.path.splitext(nombre_original)[1].lower() or ".jpg"
        archivo_id = f"{uuid.uuid4().hex}{extension}"
        ruta_archivo = f"{bucket}/{archivo_id}"

        # 1. Intentar subir a Supabase Storage si está configurado
        supabase_url = settings.SUPABASE_URL
        service_key = settings.SUPABASE_SERVICE_ROLE_KEY

        tiene_supabase_real = (
            supabase_url
            and "your-project" not in supabase_url
            and service_key
            and "your-" not in service_key
            and len(service_key) > 20
        )

        if tiene_supabase_real:
            try:
                storage_endpoint = f"{supabase_url}/storage/v1/object/{bucket}/{archivo_id}"
                headers = {
                    "Authorization": f"Bearer {service_key}",
                    "Content-Type": content_type,
                    "x-upsert": "true"
                }

                with httpx.Client(timeout=20.0) as client:
                    resp = client.post(storage_endpoint, headers=headers, content=contenido_bytes)
                    if resp.status_code in [200, 201]:
                        public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{archivo_id}"
                        logger.info(f"Archivo subido exitosamente a Supabase Storage: {public_url}")
                        return {
                            "success": True,
                            "url": public_url,
                            "filename": archivo_id,
                            "bucket": bucket,
                            "provider": "supabase"
                        }
                    else:
                        logger.warning(f"Respuesta inesperada de Supabase Storage ({resp.status_code}): {resp.text}")
            except Exception as e:
                logger.error(f"Fallo al subir a Supabase Storage: {e}")

        # 2. Fallback a Almacenamiento Local en Servidor
        try:
            directorio_destino = os.path.join(settings.STORAGE_LOCAL_DIR, bucket)
            os.makedirs(directorio_destino, exist_ok=True)
            ruta_local_completa = os.path.join(directorio_destino, archivo_id)

            with open(ruta_local_completa, "wb") as f:
                f.write(contenido_bytes)

            url_local = f"/uploads/{bucket}/{archivo_id}"
            logger.info(f"Archivo guardado localmente: {url_local}")

            return {
                "success": True,
                "url": url_local,
                "filename": archivo_id,
                "bucket": bucket,
                "provider": "local"
            }
        except Exception as e:
            logger.error(f"Error al guardar archivo en almacenamiento local: {e}")
            return {
                "success": False,
                "error": str(e)
            }
