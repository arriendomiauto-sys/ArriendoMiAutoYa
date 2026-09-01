"""
Motor de validación de documentos legales de vehículos (padrón, permiso, SOAP, revisión técnica).

Utiliza Google Cloud Vision / OCR para extraer texto, verificar coincidencia de patente
y extraer números de folio o códigos de verificación oficiales.
Si algún documento no es legible o no coincide, deriva automáticamente a revisión
por soporte sin bloquear la experiencia del usuario.
"""
import re
import logging
from typing import Dict, Any, Optional, List, Tuple
from concurrent.futures import ThreadPoolExecutor

from app.core.config import settings
from app.features.verificacion_identidad.ocr_engine import OCRService, _normalizar_texto

logger = logging.getLogger(__name__)

# Marcadores típicos de documentos vehiculares chilenos
_MARCADORES_PADRON = (
    "CERTIFICADO DE INSCRIPCION",
    "REGISTRO DE VEHICULOS MOTORIZADOS",
    "SERVICIO DE REGISTRO CIVIL",
    "PADRON",
    "R.V.M",
    "RVM",
    "PLACA PATENTE",
    "DATOS DEL VEHICULO",
)

_MARCADORES_PERMISO = (
    "PERMISO DE CIRCULACION",
    "MUNICIPALIDAD",
    "DIRECCION DE TRANSITO",
    "TESORERIA MUNICIPAL",
    "PAGO PERMISO",
    "VALOR PERMISO",
)

_MARCADORES_SOAP = (
    "SEGURO OBLIGATORIO",
    "SOAP",
    "ACCIDENTES PERSONALES",
    "POLIZA",
    "COMPANIA DE SEGUROS",
    "COBERTURA",
)

_MARCADORES_REVISION = (
    "REVISION TECNICA",
    "PLANTA DE REVISION",
    "CERTIFICADO DE REVISION",
    "GASES",
    "HOMOLOGACION",
    "MINISTERIO DE TRANSPORTES",
    "INSPECCION TECNICA",
)

# Patrones para extracción de folios o códigos de verificación
_PATRONES_FOLIO = [
    r"(?:FOLIO|N[°O]\s*FOLIO|NRO\s*FOLIO|NUMERO\s*FOLIO)[\s:]*([A-Z0-9\-]+)",
    r"(?:CODIGO\s*VERIFICACION|CODIGO\s*DE\s*VERIFICACION|VERIFICACION)[\s:]*([A-Z0-9\-]+)",
    r"(?:CERTIFICADO\s*N[°O]|CERTIFICADO\s*NUMERO|N[°O]\s*CERTIFICADO)[\s:]*([A-Z0-9\-]+)",
    r"(?:POLIZA\s*N[°O]|N[°O]\s*POLIZA)[\s:]*([A-Z0-9\-]+)",
]


def _extraer_folio(texto: str) -> Optional[str]:
    """Busca números de folio o código de verificación en el texto del documento."""
    if not texto:
        return None
    for patron in _PATRONES_FOLIO:
        m = re.search(patron, texto, re.IGNORECASE)
        if m:
            folio = m.group(1).strip()
            if len(folio) >= 4:
                return folio
    return None


def _contiene_patente(texto: str, patente: str) -> bool:
    """Verifica si la patente (con o sin guiones/espacios) aparece en el texto."""
    if not texto or not patente:
        return False
    patente_limpia = re.sub(r"[^A-Z0-9]", "", patente.upper())
    if len(patente_limpia) < 4:
        return False
    texto_limpio = re.sub(r"[^A-Z0-9]", "", texto.upper())
    return patente_limpia in texto_limpio


class CarDocValidator:
    """Validador de documentación legal vehicular."""

    @classmethod
    def validar_documentos_vehiculo(
        cls,
        patente: str,
        doc_inscripcion_url: Optional[str] = None,
        doc_permiso_circulacion_url: Optional[str] = None,
        doc_soap_url: Optional[str] = None,
        doc_revision_tecnica_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Descarga y analiza los documentos legales del auto.
        Retorna dict con:
          - verificado: bool (True si se validó automáticamente, False si va a soporte)
          - folios_detectados: Dict[str, Optional[str]]
          - motivo_soporte: Optional[str] (detalles si requiere revisión humana)
          - detalles: Dict[str, Any]
        """
        patente_norm = (patente or "").upper().replace("-", "").strip()

        # En modo mock (tests o dev sin Vision), validar según presencia de URLs
        if settings.USE_OCR_MOCK:
            todos_presentes = bool(
                doc_inscripcion_url
                and doc_permiso_circulacion_url
                and doc_soap_url
                and doc_revision_tecnica_url
            )
            return {
                "verificado": todos_presentes,
                "motivo_soporte": None if todos_presentes else "Faltan documentos por adjuntar",
                "folios_detectados": {
                    "padron": "FOLIO-MOCK-1234" if doc_inscripcion_url else None,
                    "permiso": "FOLIO-MOCK-5678" if doc_permiso_circulacion_url else None,
                    "soap": "SOAP-MOCK-9012" if doc_soap_url else None,
                    "revision": "PRT-MOCK-3456" if doc_revision_tecnica_url else None,
                },
                "es_mock": True,
            }

        docs_a_procesar = [
            ("padron", doc_inscripcion_url, _MARCADORES_PADRON),
            ("permiso", doc_permiso_circulacion_url, _MARCADORES_PERMISO),
            ("soap", doc_soap_url, _MARCADORES_SOAP),
            ("revision", doc_revision_tecnica_url, _MARCADORES_REVISION),
        ]

        def _analizar_un_doc(tipo: str, url: Optional[str], marcadores: tuple) -> Tuple[str, Optional[str], Optional[str], bool]:
            if not url:
                return tipo, None, None, False
            raw_bytes = OCRService.descargar_imagen_bytes(url)
            if not raw_bytes:
                return tipo, None, None, False
            texto, _ = OCRService.llamar_google_vision_api(raw_bytes)
            if not texto:
                return tipo, None, None, False

            norm = _normalizar_texto(texto)
            folio = _extraer_folio(texto)
            tiene_patente = _contiene_patente(texto, patente_norm)
            hits_marcadores = sum(1 for m in marcadores if m in norm)
            valido = tiene_patente or hits_marcadores >= 1 or folio is not None
            return tipo, texto, folio, valido

        resultados = {}
        folios = {}
        conteo_validos = 0

        with ThreadPoolExecutor(max_workers=4) as ex:
            futuros = [
                ex.submit(_analizar_un_doc, tipo, url, marcadores)
                for tipo, url, marcadores in docs_a_procesar
            ]
            for f in futuros:
                try:
                    tipo, texto, folio, es_valido = f.result()
                    folios[tipo] = folio
                    resultados[tipo] = {
                        "tiene_texto": bool(texto),
                        "folio": folio,
                        "valido": es_valido,
                    }
                    if es_valido:
                        conteo_validos += 1
                except Exception as e:
                    logger.error(f"Error procesando documento {tipo}: {e}")

        # Se considera verificado automáticamente si al menos 2 documentos clave
        # fueron reconocidos con éxito (padrón / permiso / soap / revisión).
        # Si no, se deriva a revisión manual por soporte.
        aprobado_auto = conteo_validos >= 2

        motivo_soporte = None
        if not aprobado_auto:
            motivo_soporte = (
                f"El OCR automático no pudo validar con certeza todos los documentos del vehículo {patente}. "
                "Requiere revisión visual manual por un ejecutivo de soporte."
            )

        return {
            "verificado": aprobado_auto,
            "motivo_soporte": motivo_soporte,
            "folios_detectados": folios,
            "conteo_validos": conteo_validos,
            "detalles": resultados,
            "es_mock": False,
        }
