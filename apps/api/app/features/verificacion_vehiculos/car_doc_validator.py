"""
Validación de los documentos legales de un vehículo: padrón, permiso de
circulación, seguro obligatorio (SOAP), seguro del auto y revisión técnica.

Acá vive la parte con mundo exterior — descargar cada archivo y pasarlo por
Google Cloud Vision, en paralelo — mientras que las reglas que deciden si un
documento sirve están en `documentos_auto.py`, sin red, para poder probarlas
con texto de ejemplo.

La decisión que sale de acá tiene tres salidas, no dos:
  - bloqueantes: documento vencido, de otra patente o de otro tipo. Eso no se
    publica, y el dueño recibe el motivo exacto.
  - revisión manual: algo no se pudo leer con certeza. Se publica igual y lo
    mira un ejecutivo, como el resto del enrolamiento.
  - verificado: los documentos se leyeron y están vigentes.
"""
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.features.verificacion_identidad.ocr_engine import OCRService
from app.features.verificacion_vehiculos.documentos_auto import (
    CAMPO_POR_TIPO,
    ESPECIFICACIONES,
    analizar_documento,
    resumir,
)

logger = logging.getLogger(__name__)

# Orden en que se procesan y se muestran.
TIPOS_EN_ORDEN = ("padron", "permiso_circulacion", "soap", "seguro", "revision_tecnica")


class CarDocValidator:
    """Validador de la documentación legal de un vehículo."""

    @classmethod
    def _leer_documento(cls, tipo: str, url: str, patente: str, hoy: date) -> Dict[str, Any]:
        """Descarga, OCR y veredicto de un documento."""
        try:
            crudo = OCRService.descargar_imagen_bytes(url)
            texto, _confianza = OCRService.llamar_google_vision_api(crudo) if crudo else (None, 0.0)
        except Exception as e:  # una foto rota no puede tumbar la publicación
            logger.error("Error leyendo documento %s: %s", tipo, e)
            texto = None

        return analizar_documento(texto, tipo, patente, hoy=hoy)

    @classmethod
    def validar_documentos_vehiculo(
        cls,
        patente: str,
        doc_inscripcion_url: Optional[str] = None,
        doc_permiso_circulacion_url: Optional[str] = None,
        doc_soap_url: Optional[str] = None,
        doc_revision_tecnica_url: Optional[str] = None,
        doc_seguro_url: Optional[str] = None,
        hoy: Optional[date] = None,
    ) -> Dict[str, Any]:
        """
        Analiza los documentos adjuntos del auto.

        Devuelve:
          - verificado: bool — se leyeron todos y están vigentes.
          - bloqueantes: [{tipo, estado, motivo}] — impiden publicar.
          - avisos: [{...}] — vigentes pero por vencer.
          - documentos: veredicto completo de cada uno.
          - motivo_soporte: qué mirar a mano, si algo quedó dudoso.
          - folios_detectados / detalles: lo que ya consumía el resto del código.
        """
        hoy = hoy or date.today()
        urls: Dict[str, Optional[str]] = {
            "padron": doc_inscripcion_url,
            "permiso_circulacion": doc_permiso_circulacion_url,
            "soap": doc_soap_url,
            "seguro": doc_seguro_url,
            "revision_tecnica": doc_revision_tecnica_url,
        }
        adjuntos: List[Tuple[str, str]] = [
            (tipo, urls[tipo]) for tipo in TIPOS_EN_ORDEN if (urls.get(tipo) or "").strip()
        ]

        # Sin Vision configurado (tests, dev local) no hay texto que leer: se
        # valida la presencia de los obligatorios, como antes.
        if settings.USE_OCR_MOCK:
            obligatorios_presentes = all(
                (urls.get(tipo) or "").strip()
                for tipo, spec in ESPECIFICACIONES.items()
                if spec.obligatorio
            )
            return {
                "verificado": obligatorios_presentes,
                "bloqueantes": [],
                "avisos": [],
                "documentos": [],
                "motivo_soporte": None if obligatorios_presentes else "Faltan documentos por adjuntar",
                "folios_detectados": {tipo: None for tipo, _ in adjuntos},
                "detalles": {},
                "es_mock": True,
            }

        if not adjuntos:
            return {
                "verificado": False,
                "bloqueantes": [],
                "avisos": [],
                "documentos": [],
                "motivo_soporte": "No se adjuntó ningún documento del vehículo.",
                "folios_detectados": {},
                "detalles": {},
                "es_mock": False,
            }

        analisis: List[Dict[str, Any]] = []
        with ThreadPoolExecutor(max_workers=min(5, len(adjuntos))) as ex:
            futuros = {
                ex.submit(cls._leer_documento, tipo, url, patente, hoy): tipo
                for tipo, url in adjuntos
            }
            for futuro, tipo in futuros.items():
                try:
                    analisis.append(futuro.result())
                except Exception as e:
                    logger.error("Fallo el análisis de %s: %s", tipo, e)
                    analisis.append(analizar_documento(None, tipo, patente, hoy=hoy))

        analisis.sort(key=lambda a: TIPOS_EN_ORDEN.index(a["tipo"]))
        resultado = resumir(analisis)
        resultado["es_mock"] = False
        # Lo que ya consumía el resto del código.
        resultado["folios_detectados"] = {a["tipo"]: a.get("folio") for a in analisis}
        resultado["detalles"] = {
            a["tipo"]: {
                "campo": CAMPO_POR_TIPO.get(a["tipo"]),
                "estado": a["estado"],
                "valido": a["valido"],
                "vencimiento": a["vencimiento"],
            }
            for a in analisis
        }
        return resultado
