import os
import uuid
import logging
from typing import Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    BUCKETS_PERMITIDOS = ["autos", "documentos-kyc", "checklists", "evidencias", "general"]

    # Buckets con datos sensibles (documentos de identidad, checklists de
    # entrega con fotos del cliente, evidencia de disputas): se sirven vía
    # URL firmada de corta duración en vez de URL pública permanente.
    BUCKETS_PRIVADOS = {"documentos-kyc", "checklists", "evidencias"}
    URL_FIRMADA_EXPIRA_SEGUNDOS = 60 * 60 * 24 * 7  # 7 días

    MIME_PERMITIDOS = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
    TAMANO_MAXIMO_BYTES = 8 * 1024 * 1024  # 8 MB

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
        Retorna la URL (pública o firmada, según el bucket) y metadatos del archivo.
        """
        if bucket not in cls.BUCKETS_PERMITIDOS:
            bucket = "general"

        if content_type not in cls.MIME_PERMITIDOS:
            return {
                "success": False,
                "validation_error": True,
                "error": f"Tipo de archivo no permitido ({content_type}). Solo se aceptan JPG, PNG o WebP.",
            }

        if len(contenido_bytes) > cls.TAMANO_MAXIMO_BYTES:
            return {
                "success": False,
                "validation_error": True,
                "error": f"El archivo excede el tamaño máximo permitido ({cls.TAMANO_MAXIMO_BYTES // (1024*1024)} MB).",
            }

        # Generar nombre único seguro (ignora por completo el nombre original
        # salvo por su extensión, para evitar path traversal / inyección de rutas)
        extension = os.path.splitext(nombre_original)[1].lower()
        if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
            extension = ".jpg"
        archivo_id = f"{uuid.uuid4().hex}{extension}"

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
                        if bucket in cls.BUCKETS_PRIVADOS:
                            file_url = cls._generar_url_firmada(client, supabase_url, service_key, bucket, archivo_id)
                        else:
                            file_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{archivo_id}"
                        logger.info(f"Archivo subido exitosamente a Supabase Storage: {bucket}/{archivo_id}")
                        return {
                            "success": True,
                            "url": file_url,
                            "filename": archivo_id,
                            "bucket": bucket,
                            "provider": "supabase"
                        }
                    else:
                        logger.warning(f"Respuesta inesperada de Supabase Storage ({resp.status_code}): {resp.text}")
            except Exception as e:
                logger.error(f"Fallo al subir a Supabase Storage: {e}")

        # 2. Fallback a Almacenamiento Local en Servidor
        # NOTA: este fallback se sirve vía StaticFiles (/uploads) sin control
        # de acceso — a diferencia de los buckets privados en Supabase, aquí
        # no hay forma de restringir la lectura por archivo. Solo debería
        # activarse si Supabase Storage está mal configurado o caído.
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

    @classmethod
    def _generar_url_firmada(
        cls,
        client: httpx.Client,
        supabase_url: str,
        service_key: str,
        bucket: str,
        archivo_id: str,
    ) -> str:
        """
        Genera una URL firmada de corta duración para un archivo en un bucket
        privado. Si la firma falla por algún motivo, retorna igualmente una
        URL (mejor un enlace potencialmente inválido que tumbar la subida).
        """
        try:
            resp = client.post(
                f"{supabase_url}/storage/v1/object/sign/{bucket}/{archivo_id}",
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "Content-Type": "application/json",
                },
                json={"expiresIn": cls.URL_FIRMADA_EXPIRA_SEGUNDOS},
            )
            if resp.status_code == 200:
                signed_path = resp.json().get("signedURL")
                if signed_path:
                    return f"{supabase_url}/storage/v1{signed_path}"
            logger.warning(f"No se pudo firmar URL para {bucket}/{archivo_id}: {resp.status_code} {resp.text}")
        except Exception as e:
            logger.error(f"Error generando URL firmada para {bucket}/{archivo_id}: {e}")

        # Fallback: URL directa (no firmada) — el bucket privado igual la
        # rechazará sin token, pero evita romper la respuesta de la subida.
        return f"{supabase_url}/storage/v1/object/{bucket}/{archivo_id}"

    @classmethod
    def renovar_url_firmada(cls, bucket: str, archivo_id: str) -> Optional[str]:
        """
        Regenera una URL firmada vigente para un archivo ya existente en un
        bucket privado (las firmadas expiran a los 7 días). Usado por
        GET /storage/{bucket}/{archivo_id} para no depender de que la URL
        guardada en base de datos siga viva.
        """
        supabase_url = settings.SUPABASE_URL
        service_key = settings.SUPABASE_SERVICE_ROLE_KEY
        if bucket not in cls.BUCKETS_PRIVADOS:
            return None
        with httpx.Client(timeout=15.0) as client:
            return cls._generar_url_firmada(client, supabase_url, service_key, bucket, archivo_id)
