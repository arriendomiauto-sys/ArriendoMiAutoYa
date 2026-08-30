"""
Cliente del microservicio de OCR (apps/ocr).

El procesamiento real de documentos de identidad — Google Cloud Vision,
clasificación cédula/licencia, extracción de RUT, control facial — vive
ahora en su propio servicio. Este módulo es sólo el puente:

- Si `settings.OCR_SERVICE_URL` está configurada, se hace POST al servicio.
- Si no lo está (dev / tests / servicio caído), se usa un mock local
  determinista con validación de RUT Módulo 11, suficiente para desarrollo.

La clase mantiene el nombre `OCRService` y la firma de
`procesar_documentos_enrolamiento` para no tocar los routers.
"""
import logging
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings
from app.core.validators import validar_rut_chileno

logger = logging.getLogger(__name__)

_EXTENSIONES_VALIDAS = (".jpg", ".jpeg", ".png", ".webp")


def _formato_imagen_ok(url_o_path: Optional[str]) -> bool:
    if not url_o_path:
        return True
    u = url_o_path.lower()
    return (
        u.endswith(_EXTENSIONES_VALIDAS)
        or u.startswith("http://")
        or u.startswith("https://")
        or u.startswith("data:image/")
    )


class OCRService:
    @classmethod
    def procesar_documentos_enrolamiento(
        cls,
        carnet_frontal_url: Optional[str] = None,
        carnet_trasero_url: Optional[str] = None,
        licencia_url: Optional[str] = None,
        rut_usuario: Optional[str] = None,
        selfie_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload = {
            "carnet_frontal_url": carnet_frontal_url,
            "carnet_trasero_url": carnet_trasero_url,
            "licencia_url": licencia_url,
            "rut_usuario": rut_usuario,
            "selfie_url": selfie_url,
        }

        if settings.OCR_SERVICE_URL:
            return cls._llamar_servicio(payload)

        return cls._mock_local(**payload)

    # ------------------------------------------------------------------ #
    # Llamada HTTP al microservicio
    # ------------------------------------------------------------------ #
    @classmethod
    def _llamar_servicio(cls, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = settings.OCR_SERVICE_URL.rstrip("/") + "/v1/procesar-documentos"
        headers = {}
        if settings.OCR_SERVICE_KEY:
            headers["X-OCR-Key"] = settings.OCR_SERVICE_KEY
        try:
            with httpx.Client(timeout=settings.OCR_HTTP_TIMEOUT) as client:
                resp = client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                return resp.json()
            logger.error(
                "Microservicio OCR respondió %s: %s", resp.status_code, resp.text[:300]
            )
        except Exception as e:  # noqa: BLE001 — cualquier fallo de red no debe reventar el enrolamiento
            logger.error("No se pudo contactar al microservicio OCR (%s): %s", url, e)

        # Servicio caído / error: no se auto-verifica ni se rechaza. Queda en
        # revisión manual para que un ejecutivo lo resuelva.
        return {
            "rut_extraido": payload.get("rut_usuario"),
            "nombre_extraido": None,
            "confianza_ocr": 0.0,
            "confianza_facial": None,
            "verificacion_facial": "no_evaluado",
            "documentos_legibles": False,
            "coincide_rut_declarado": False,
            "estado_recomendado": "requiere_revision_manual",
            "motivo": (
                "No pudimos verificar tus documentos automáticamente en este momento. "
                "Un ejecutivo los revisará a la brevedad."
            ),
            "es_mock": False,
            "servicio_ocr_no_disponible": True,
        }

    # ------------------------------------------------------------------ #
    # Mock local determinista (sin OCR_SERVICE_URL)
    # ------------------------------------------------------------------ #
    @staticmethod
    def _mock_local(
        carnet_frontal_url: Optional[str] = None,
        carnet_trasero_url: Optional[str] = None,
        licencia_url: Optional[str] = None,
        rut_usuario: Optional[str] = None,
        selfie_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        # 0. Cédula frontal obligatoria.
        if not carnet_frontal_url:
            return {
                "documentos_legibles": False,
                "confianza_ocr": 0.0,
                "estado_recomendado": "rechazado",
                "motivo": (
                    "Falta la foto de la cédula de identidad (frente). "
                    "Debes tomarla con la cámara para continuar."
                ),
                "es_mock": True,
            }

        # 1. Formato de imágenes.
        for url in (carnet_frontal_url, carnet_trasero_url, licencia_url):
            if url and not _formato_imagen_ok(url):
                return {
                    "documentos_legibles": False,
                    "confianza_ocr": 0.0,
                    "estado_recomendado": "rechazado",
                    "motivo": "Formato de imagen no soportado. Debe ser JPG, PNG o WebP.",
                    "es_mock": True,
                }

        # 2. Mock determinista con validación de RUT Módulo 11.
        import re

        rut_demo = rut_usuario if (rut_usuario and validar_rut_chileno(rut_usuario)) else "18.456.789-K"
        confianza_mock = 0.96
        coincide_rut = True
        if rut_usuario:
            limpio_in = re.sub(r"[\.\-\s]", "", rut_usuario).upper()
            limpio_ocr = re.sub(r"[\.\-\s]", "", rut_demo).upper()
            coincide_rut = limpio_in == limpio_ocr

        estado = "verificado" if (confianza_mock >= 0.80 and coincide_rut) else "requiere_revision_manual"

        return {
            "rut_extraido": rut_demo,
            "nombre_extraido": "Juan Carlos Pérez Soto",
            "fecha_nacimiento": "1992-05-14",
            "fecha_vencimiento_carnet": "2029-05-14",
            "licencia_clase": "B",
            "fecha_vencimiento_licencia": "2028-11-20",
            "confianza_ocr": confianza_mock,
            "documentos_legibles": True,
            "coincide_rut_declarado": coincide_rut,
            "estado_recomendado": estado,
            "es_mock": True,
        }
