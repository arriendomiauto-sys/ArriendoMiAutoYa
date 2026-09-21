"""
Motor de validación de documentos legales de vehículos (padrón, permiso, SOAP, revisión técnica, certificado de gases).

Utiliza Google Cloud Vision / OCR para extraer texto, verificar coincidencia de patente
y extraer números de folio o códigos de verificación oficiales.
Si algún documento no es legible o no coincide, deriva automáticamente a revisión
por soporte sin bloquear la experiencia del usuario.
"""
import re
import logging
from typing import Dict, Any, Optional, List, Tuple
from concurrent.futures import ThreadPoolExecutor

from datetime import date

from app.core.config import settings
from app.features.auth.background_checks.certificados import fecha_de_vencimiento
from app.features.auth.ocr.ocr_engine import OCRService, _normalizar_texto

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
    "HOMOLOGACION",
    "MINISTERIO DE TRANSPORTES",
    "INSPECCION TECNICA",
)

# Certificado de emisión de gases: antes era un marcador más dentro de
# _MARCADORES_REVISION (compartía casilla con la revisión técnica); ahora es
# un documento propio y obligatorio, así que se le saca "GASES" a la tupla de
# arriba para no confundir un certificado de gases con una revisión técnica.
_MARCADORES_GASES = (
    "CERTIFICADO DE EMISIONES",
    "REVISION DE GASES",
    "HOMOLOGACION DE GASES",
    "EMISIONES CONTAMINANTES",
    "CONTROL DE EMISIONES",
    "GASES",
    "OPACIDAD",
    "PLANTA DE REVISION",
)

# Seguro COMERCIAL del auto (casilla opcional, distinta del SOAP obligatorio).
# El objetivo de estos marcadores es distinguir una póliza / contrato de
# cobertura real de una imagen genérica (una foto del auto, una selfie, un
# papel en blanco, el propio SOAP): esos no traen lenguaje contractual.
_MARCADORES_SEGURO_COMERCIAL = (
    "POLIZA",
    "CONDICIONES PARTICULARES",
    "CONDICIONES GENERALES",
    "COMPANIA DE SEGUROS",
    "ASEGURADORA",
    "ASEGURADO",
    "CONTRATANTE",
    "COBERTURA",
    "COBERTURAS",
    "RESPONSABILIDAD CIVIL",
    "DANOS PROPIOS",
    "PERDIDA TOTAL",
    "DEDUCIBLE",
    "PRIMA",
    "MATERIA ASEGURADA",
    "SUMA ASEGURADA",
    "MONTO ASEGURADO",
    "VIGENCIA",
    "CORREDORA DE SEGUROS",
    "CORREDOR DE SEGUROS",
    "SEGURO AUTOMOTRIZ",
    "SEGURO DE VEHICULOS",
    "RIESGOS CUBIERTOS",
    "CLAUSULA",
    "NUMERO DE POLIZA",
)

# Marcadores fuertes: uno solo ya basta para reconocer una póliza. No aparecen
# por casualidad en una foto que no sea un documento de seguro.
_MARCADORES_SEGURO_FUERTES = (
    "CONDICIONES PARTICULARES",
    "RESPONSABILIDAD CIVIL",
    "DANOS PROPIOS",
    "MATERIA ASEGURADA",
    "SUMA ASEGURADA",
    "PRIMA NETA",
    "DEDUCIBLE",
    "RIESGOS CUBIERTOS",
    "CORREDORA DE SEGUROS",
    "CORREDOR DE SEGUROS",
    "SEGURO AUTOMOTRIZ",
    "NUMERO DE POLIZA",
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


def evaluar_poliza_seguro(texto: str, patente: str = "") -> Dict[str, Any]:
    """
    ¿El texto OCR de una imagen corresponde a una póliza / contrato de seguro
    automotriz? Se usa para la casilla OPCIONAL "seguro del auto": si el dueño
    sube algo ahí, tiene que ser un documento contractual real, no una foto
    cualquiera.

    Devuelve: {es_poliza: bool, legible: bool, folio: Optional[str],
               hits: int, motivo: str}
    """
    if not texto or not texto.strip():
        return {
            "es_poliza": False,
            "legible": False,
            "folio": None,
            "hits": 0,
            "motivo": (
                "No pudimos leer texto en la imagen. Sube una foto nítida y "
                "completa de tu póliza de seguro."
            ),
        }

    norm = _normalizar_texto(texto)
    hits = [m for m in _MARCADORES_SEGURO_COMERCIAL if m in norm]
    fuertes = [m for m in _MARCADORES_SEGURO_FUERTES if m in norm]
    folio = _extraer_folio(texto)
    tiene_patente = _contiene_patente(texto, (patente or "").upper().replace("-", "").strip())
    menciona_seguro = "POLIZA" in norm or "SEGURO" in norm

    # Una póliza real trae lenguaje contractual: al menos un marcador fuerte, o
    # dos marcadores comunes, o la palabra "póliza/seguro" acompañada de un
    # folio o de la patente del auto. Una foto genérica no llega a nada de eso.
    es_poliza = bool(fuertes or len(hits) >= 2 or (menciona_seguro and (folio or tiene_patente)))

    if es_poliza:
        motivo = "Documento reconocido como póliza de seguro."
    else:
        motivo = (
            "Esto no parece una póliza de seguro. Sube el contrato o el "
            "certificado de cobertura de tu aseguradora — no una foto del auto "
            "ni el SOAP."
        )

    return {
        "es_poliza": es_poliza,
        "legible": True,
        "folio": folio,
        "hits": len(hits),
        "motivo": motivo,
    }


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
        doc_certificado_gases_url: Optional[str] = None,
        doc_seguro_url: Optional[str] = None,
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
            # El padrón (doc_inscripcion_url) es opcional: no se exige para
            # dar por verificados los documentos, igual que en el router de
            # creación de autos.
            todos_presentes = bool(
                doc_permiso_circulacion_url
                and doc_soap_url
                and doc_revision_tecnica_url
                and doc_certificado_gases_url
            )
            # El seguro comercial es opcional: en mock se acepta por presencia,
            # igual que el resto. La validación real de "¿es una póliza?" solo
            # corre con OCR de verdad (rama de abajo) o se prueba unitariamente
            # con `evaluar_poliza_seguro`.
            return {
                "verificado": todos_presentes,
                "motivo_soporte": None if todos_presentes else "Faltan documentos por adjuntar",
                "folios_detectados": {
                    "padron": "FOLIO-MOCK-1234" if doc_inscripcion_url else None,
                    "permiso": "FOLIO-MOCK-5678" if doc_permiso_circulacion_url else None,
                    "soap": "SOAP-MOCK-9012" if doc_soap_url else None,
                    "revision": "PRT-MOCK-3456" if doc_revision_tecnica_url else None,
                    "gases": "GASES-MOCK-9900" if doc_certificado_gases_url else None,
                    "seguro": "POLIZA-MOCK-7788" if doc_seguro_url else None,
                },
                "seguro_presente": bool(doc_seguro_url),
                "seguro_valido": bool(doc_seguro_url),
                "seguro_motivo": (
                    "Documento reconocido como póliza de seguro." if doc_seguro_url else None
                ),
                "detalles": {
                    "seguro": {
                        "es_poliza": bool(doc_seguro_url),
                        "legible": bool(doc_seguro_url),
                        "folio": "POLIZA-MOCK-7788" if doc_seguro_url else None,
                    }
                }
                if doc_seguro_url
                else {},
                "es_mock": True,
            }

        docs_a_procesar = [
            ("padron", doc_inscripcion_url, _MARCADORES_PADRON),
            ("permiso", doc_permiso_circulacion_url, _MARCADORES_PERMISO),
            ("soap", doc_soap_url, _MARCADORES_SOAP),
            ("revision", doc_revision_tecnica_url, _MARCADORES_REVISION),
            ("gases", doc_certificado_gases_url, _MARCADORES_GASES),
        ]

        def _analizar_un_doc(tipo: str, url: Optional[str], marcadores: tuple) -> Tuple[str, Optional[str], Optional[str], bool, bool]:
            if not url:
                return tipo, None, None, False, False
            raw_bytes = OCRService.descargar_imagen_bytes(url)
            if not raw_bytes:
                return tipo, None, None, False, False
            texto, _ = OCRService.llamar_google_vision_api(raw_bytes)
            if not texto:
                return tipo, None, None, False, False

            norm = _normalizar_texto(texto)
            folio = _extraer_folio(texto)
            tiene_patente = _contiene_patente(texto, patente_norm)
            hits_marcadores = sum(1 for m in marcadores if m in norm)
            # Tiene que ser DE ESTE auto (la patente aparece) y parecer el documento que dice ser.
            # Antes bastaba un marcador o un folio: el permiso de otro auto pasaba.
            valido = tiene_patente and (hits_marcadores >= 1 or folio is not None)
            # Un documento vencido no vale. Si el texto no dice la vigencia, no se da por vencido.
            vence = fecha_de_vencimiento(texto)
            vencido = vence is not None and vence < date.today()
            return tipo, texto, folio, valido and not vencido, vencido

        resultados = {}
        folios = {}
        conteo_validos = 0
        vencidos: List[str] = []

        with ThreadPoolExecutor(max_workers=4) as ex:
            futuros = [
                ex.submit(_analizar_un_doc, tipo, url, marcadores)
                for tipo, url, marcadores in docs_a_procesar
            ]
            for f in futuros:
                try:
                    tipo, texto, folio, es_valido, vencido = f.result()
                    folios[tipo] = folio
                    resultados[tipo] = {
                        "tiene_texto": bool(texto),
                        "folio": folio,
                        "valido": es_valido,
                        "vencido": vencido,
                    }
                    if es_valido:
                        conteo_validos += 1
                    if vencido:
                        vencidos.append(tipo)
                except Exception as e:
                    logger.error(f"Error procesando documento {tipo}: {e}")

        # Se considera verificado automáticamente si al menos 2 documentos clave
        # fueron reconocidos con éxito (padrón / permiso / soap / revisión).
        # Si no, se deriva a revisión manual por soporte.
        # Un documento vencido lo impide aunque los demás estén bien: el auto no debe circular así.
        aprobado_auto = conteo_validos >= 2 and not vencidos

        motivo_soporte = None
        if vencidos:
            motivo_soporte = (
                f"Documentos vencidos del vehículo {patente}: {', '.join(vencidos)}. "
                "El dueño debe subir la versión vigente."
            )
        elif not aprobado_auto:
            motivo_soporte = (
                f"El OCR automático no pudo validar con certeza todos los documentos del vehículo {patente}. "
                "Requiere revisión visual manual por un ejecutivo de soporte."
            )

        # Seguro comercial (casilla OPCIONAL): si el dueño subió algo, tiene que
        # leerse como una póliza / contrato de cobertura real. NO cuenta para
        # `aprobado_auto` — es independiente de los documentos obligatorios.
        seguro_presente = bool(doc_seguro_url)
        seguro_valido = False
        seguro_motivo = None
        if doc_seguro_url:
            texto_seguro = ""
            raw = OCRService.descargar_imagen_bytes(doc_seguro_url)
            if raw:
                texto_seguro, _ = OCRService.llamar_google_vision_api(raw)
            veredicto_seguro = evaluar_poliza_seguro(texto_seguro or "", patente_norm)
            seguro_valido = bool(veredicto_seguro["es_poliza"])
            seguro_motivo = veredicto_seguro["motivo"]
            folios["seguro"] = veredicto_seguro["folio"]
            resultados["seguro"] = {
                "tiene_texto": veredicto_seguro["legible"],
                "es_poliza": seguro_valido,
                "folio": veredicto_seguro["folio"],
                "valido": seguro_valido,
            }
            if not seguro_valido:
                logger.info(
                    "Auto %s: la imagen del seguro opcional no valida como póliza (%s marcadores).",
                    patente, veredicto_seguro["hits"],
                )

        return {
            "verificado": aprobado_auto,
            "motivo_soporte": motivo_soporte,
            "folios_detectados": folios,
            "conteo_validos": conteo_validos,
            "vencidos": vencidos,
            "detalles": resultados,
            "seguro_presente": seguro_presente,
            "seguro_valido": seguro_valido,
            "seguro_motivo": seguro_motivo,
            "es_mock": False,
        }
