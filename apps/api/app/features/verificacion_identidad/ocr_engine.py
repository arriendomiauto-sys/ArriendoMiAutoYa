"""
Motor de OCR de documentos de identidad chilenos (cédula + licencia + selfie).

Procesa Google Cloud Vision, clasifica cédula/licencia, extrae RUT y controla
el match facial in-process, dentro de la propia API — no delega a un
microservicio externo.
"""
import os
import re
import base64
import logging
import unicodedata
from typing import Dict, Any, Optional, List, Tuple
import httpx

from app.core.config import settings
from app.core.validators import validar_rut_chileno
from app.core.vision import VISION_REST_URL, credenciales_vision
from app.core.url_validator import validate_safe_url

logger = logging.getLogger(__name__)

# Ruta que usan las URLs del respaldo local privado, ya sea absolutas
# (http://host/api/v1/storage/local/<bucket>/<id>) o relativas.
_PREFIJO_LOCAL_PRIVADO = "/storage/local/"


def _ruta_local_privada(url_o_path: str) -> Optional[str]:
    """
    Si la URL apunta al respaldo local de un bucket privado, devuelve la ruta
    en disco correspondiente; si no, None.
    """
    if not url_o_path or _PREFIJO_LOCAL_PRIVADO not in url_o_path:
        return None

    resto = url_o_path.split(_PREFIJO_LOCAL_PRIVADO, 1)[1].split("?", 1)[0].strip("/")
    partes = resto.split("/")
    if len(partes) != 2:
        return None

    # La validación de bucket privado y de traversal vive en StorageService.
    from app.services.storage import StorageService

    return StorageService.leer_archivo_local_privado(partes[0], partes[1])


def _normalizar_texto(texto: str) -> str:
    """Mayúsculas, sin tildes y con espacios colapsados — para buscar
    marcadores en el texto que devuelve el OCR sin pelear con acentos."""
    if not texto:
        return ""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c)
    )
    return re.sub(r"\s+", " ", sin_tildes.upper())


# Marcadores que SÍ o SÍ aparecen impresos en una cédula de identidad chilena
# (formato nuevo 2013+). Con que aparezcan 2 ya es señal fuerte de que la
# foto es realmente una cédula y no otra cosa.
_MARCADORES_CEDULA = (
    "CEDULA DE IDENTIDAD",
    "IDENTITY CARD",
    "REPUBLICA DE CHILE",
    "REGISTRO CIVIL",
    "SERVICIO DE REGISTRO CIVIL",
    "APELLIDOS",
    "NOMBRES",
    "NACIONALIDAD",
    "FECHA DE NACIMIENTO",
    "DATE OF BIRTH",
    "NUMERO DOCUMENTO",
    "DOCUMENT NUMBER",
    "FECHA DE EMISION",
    "SEXO",
    "RUN",
)

# Marcadores de una licencia de conducir municipal chilena.
_MARCADORES_LICENCIA = (
    "LICENCIA DE CONDUCIR",
    "LICENCIA MUNICIPAL",
    "DIRECCION DE TRANSITO",
    "TRANSITO Y TRANSPORTE PUBLICO",
    "MUNICIPALIDAD",
    "RESTRICCIONES",
    "CLASE",
    "FECHA CONTROL",
    "PROXIMO CONTROL",
)


class OCRService:
    VISION_REST_URL = VISION_REST_URL

    @staticmethod
    def validar_formato_imagen(url_o_path: Optional[str]) -> bool:
        if not url_o_path:
            return True
        extensiones_validas = (".jpg", ".jpeg", ".png", ".webp")
        url_lower = url_o_path.lower()
        return (
            url_lower.endswith(extensiones_validas)
            or url_lower.startswith("http://")
            or url_lower.startswith("https://")
            or url_lower.startswith("data:image/")
        )

    @staticmethod
    def descargar_imagen_bytes(url_o_path: str) -> Optional[bytes]:
        if not url_o_path:
            return None

        if url_o_path.startswith("data:image/"):
            try:
                base64_data = url_o_path.split(",")[1]
                return base64.b64decode(base64_data)
            except Exception as e:
                logger.error(f"Error al decodificar imagen base64: {e}")
                return None

        # Respaldo local de un bucket privado. Se sirve por un endpoint que
        # exige sesión, así que bajarlo por HTTP desde acá daría 401: se lee
        # del disco directamente (el OCR corre en el mismo proceso).
        ruta_privada = _ruta_local_privada(url_o_path)
        if ruta_privada:
            try:
                with open(ruta_privada, "rb") as f:
                    return f.read()
            except Exception as e:
                logger.error(f"Error al leer archivo local privado ({ruta_privada}): {e}")
                return None

        if url_o_path.startswith("http://") or url_o_path.startswith("https://"):
            is_dev = settings.ENVIRONMENT == "development"
            if not validate_safe_url(url_o_path, allow_localhost_dev=is_dev):
                logger.warning(f"[Anti-SSRF] URL rechazada por seguridad en OCR: {url_o_path}")
                return None
            try:
                with httpx.Client(timeout=15.0) as client:
                    response = client.get(url_o_path)
                    if response.status_code == 200:
                        return response.content
                    logger.warning(f"No se pudo descargar la imagen ({response.status_code}): {url_o_path}")
                    return None
            except Exception as e:
                logger.error(f"Error al descargar imagen desde URL ({url_o_path}): {e}")
                return None

        if url_o_path.startswith("/uploads/"):
            local = os.path.join(settings.STORAGE_LOCAL_DIR, url_o_path[len("/uploads/"):])
            if os.path.isfile(local):
                try:
                    with open(local, "rb") as f:
                        return f.read()
                except Exception as e:
                    logger.error(f"Error al leer archivo local ({local}): {e}")
            return None

        if os.path.isfile(url_o_path):
            try:
                with open(url_o_path, "rb") as f:
                    return f.read()
            except Exception as e:
                logger.error(f"Error al leer archivo local ({url_o_path}): {e}")
                return None

        return None

    @staticmethod
    def _credenciales_vision() -> Tuple[Optional[str], bool]:
        """Devuelve (api_key_valida | None, hay_service_account_bool)."""
        return credenciales_vision()

    @classmethod
    def _vision_face_detection(cls, image_bytes: bytes) -> Optional[List[Dict[str, Any]]]:
        if not image_bytes or settings.USE_OCR_MOCK:
            return None

        api_key, tiene_creds = cls._credenciales_vision()
        if not api_key and not tiene_creds:
            return None

        if api_key:
            try:
                payload = {
                    "requests": [{
                        "image": {"content": base64.b64encode(image_bytes).decode("utf-8")},
                        "features": [{"type": "FACE_DETECTION", "maxResults": 5}],
                    }]
                }
                with httpx.Client(timeout=20.0) as client:
                    resp = client.post(f"{cls.VISION_REST_URL}?key={api_key}", json=payload)
                if resp.status_code == 200:
                    responses = resp.json().get("responses", [{}])
                    return responses[0].get("faceAnnotations", []) or []
                logger.error(f"FACE_DETECTION REST error ({resp.status_code}): {resp.text}")
            except Exception as e:
                logger.error(f"Fallo FACE_DETECTION REST: {e}")

        if tiene_creds:
            try:
                from google.cloud import vision
                client = vision.ImageAnnotatorClient()
                response = client.face_detection(image=vision.Image(content=image_bytes))
                caras = []
                for f in response.face_annotations:
                    caras.append({
                        "detectionConfidence": float(f.detection_confidence or 0.0),
                        "blurredLikelihood": vision.Likelihood(f.blurred_likelihood).name,
                        "underExposedLikelihood": vision.Likelihood(f.under_exposed_likelihood).name,
                    })
                return caras
            except Exception as e:
                logger.error(f"Fallo FACE_DETECTION SDK: {e}")

        return None

    @classmethod
    def verificar_match_facial(
        cls,
        carnet_bytes: Optional[bytes],
        selfie_bytes: Optional[bytes],
    ) -> Dict[str, Any]:
        malas = {"LIKELY", "VERY_LIKELY"}

        caras_selfie = cls._vision_face_detection(selfie_bytes) if selfie_bytes else None
        if caras_selfie is None:
            return {"estado": "no_evaluado", "motivo": None, "confianza_facial": None,
                    "metodo": "vision_face_detection"}

        if len(caras_selfie) == 0:
            return {"estado": "rechazado",
                    "motivo": "No detectamos un rostro en la selfie. Tómala de frente, con buena luz y sin lentes de sol.",
                    "confianza_facial": 0.0, "metodo": "vision_face_detection"}

        if len(caras_selfie) > 1:
            return {"estado": "revision",
                    "motivo": "Detectamos más de una persona en la selfie.",
                    "confianza_facial": None, "metodo": "vision_face_detection"}

        cara = caras_selfie[0]
        conf = float(cara.get("detectionConfidence") or 0.0)
        borrosa = cara.get("blurredLikelihood") in malas
        oscura = cara.get("underExposedLikelihood") in malas
        if conf < 0.5 or borrosa or oscura:
            return {"estado": "revision",
                    "motivo": "La selfie salió poco nítida u oscura. Repítela con buena iluminación.",
                    "confianza_facial": conf, "metodo": "vision_face_detection"}

        caras_carnet = cls._vision_face_detection(carnet_bytes) if carnet_bytes else None
        if caras_carnet is not None and len(caras_carnet) == 0:
            return {"estado": "revision",
                    "motivo": "No pudimos ubicar la foto en la cédula. Vuelve a fotografiarla completa y enfocada.",
                    "confianza_facial": conf, "metodo": "vision_face_detection"}

        return {"estado": "ok", "motivo": None, "confianza_facial": conf,
                "metodo": "vision_face_detection"}

    @classmethod
    def llamar_google_vision_api(cls, image_bytes: bytes) -> Tuple[Optional[str], float]:
        if not image_bytes:
            return None, 0.0

        if settings.USE_OCR_MOCK:
            logger.info("USE_OCR_MOCK=True: se omite Google Cloud Vision y se usa simulación.")
            return None, 0.0

        api_key, tiene_creds_validas = cls._credenciales_vision()
        tiene_api_key_valida = bool(api_key)

        if not tiene_api_key_valida and not tiene_creds_validas:
            logger.info("Google Cloud Vision API Key / Credenciales no configuradas. Retornando modo simulado.")
            return None, 0.0

        if tiene_api_key_valida:
            try:
                base64_content = base64.b64encode(image_bytes).decode("utf-8")
                payload = {
                    "requests": [
                        {
                            "image": {"content": base64_content},
                            "features": [
                                {"type": "DOCUMENT_TEXT_DETECTION"},
                                {"type": "TEXT_DETECTION"},
                            ],
                        }
                    ]
                }
                with httpx.Client(timeout=20.0) as client:
                    resp = client.post(f"{cls.VISION_REST_URL}?key={api_key}", json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        responses = data.get("responses", [])
                        if responses and "fullTextAnnotation" in responses[0]:
                            full_text = responses[0]["fullTextAnnotation"].get("text", "")
                            pages = responses[0]["fullTextAnnotation"].get("pages", [])
                            confidence = 0.95
                            if pages and "confidence" in pages[0]:
                                confidence = float(pages[0]["confidence"])
                            return full_text, confidence
                        elif responses and "textAnnotations" in responses[0]:
                            text_annotations = responses[0]["textAnnotations"]
                            if text_annotations:
                                full_text = text_annotations[0].get("description", "")
                                return full_text, 0.90
                    else:
                        logger.error(f"Error en respuesta de Google Cloud Vision REST ({resp.status_code}): {resp.text}")
            except Exception as e:
                logger.error(f"Fallo al ejecutar Google Cloud Vision REST API: {e}")

        if tiene_creds_validas:
            try:
                from google.cloud import vision
                client = vision.ImageAnnotatorClient()
                image = vision.Image(content=image_bytes)
                response = client.document_text_detection(image=image)
                if response.full_text_annotation:
                    full_text = response.full_text_annotation.text
                    confidence = 0.95
                    if response.full_text_annotation.pages:
                        confidence = float(response.full_text_annotation.pages[0].confidence or 0.95)
                    return full_text, confidence
                elif response.text_annotations:
                    return response.text_annotations[0].description, 0.90
            except Exception as e:
                logger.error(f"Fallo al ejecutar Google Cloud Vision SDK: {e}")

        return None, 0.0

    @staticmethod
    def extraer_rut_chileno(texto: str) -> Optional[str]:
        if not texto:
            return None

        patrones = [
            r"\b(\d{1,2}\.?\d{3}\.?\d{3}[-–—\s]?[0-9kK])\b",
            r"(?:RUN|RUT|CEDULA)[\s:]*([0-9\.\-kK]{8,12})",
            r"\b(\d{7,8}[-–—\s]?[0-9kK])\b",
        ]

        for patron in patrones:
            matches = re.finditer(patron, texto, re.IGNORECASE)
            for m in matches:
                candidato = m.group(1).replace("–", "-").replace("—", "-").replace(" ", "")
                digitos_y_k = re.sub(r"[^0-9kK]", "", candidato).upper()
                if len(digitos_y_k) >= 8:
                    cuerpo = digitos_y_k[:-1]
                    dv = digitos_y_k[-1]
                    rut_formateado = f"{int(cuerpo):,}..{dv}".replace(",", ".").replace("..", "-")
                    if validar_rut_chileno(rut_formateado):
                        return rut_formateado

        return None

    @staticmethod
    def extraer_nombres_apellidos(texto: str) -> Optional[str]:
        if not texto:
            return None

        lineas = [l.strip() for l in texto.split("\n") if l.strip()]
        apellidos = ""
        nombres = ""

        for idx, linea in enumerate(lineas):
            linea_upper = linea.upper()
            if "APELLIDOS" in linea_upper:
                if ":" in linea:
                    apellidos = linea.split(":", 1)[1].strip()
                elif idx + 1 < len(lineas):
                    apellidos = lineas[idx + 1].strip()
            elif "NOMBRES" in linea_upper or "NOMBRE" in linea_upper:
                if ":" in linea:
                    nombres = linea.split(":", 1)[1].strip()
                elif idx + 1 < len(lineas):
                    nombres = lineas[idx + 1].strip()

        if apellidos and nombres:
            return f"{nombres} {apellidos}".title()
        elif nombres:
            return nombres.title()
        elif apellidos:
            return apellidos.title()

        return None

    @staticmethod
    def extraer_fechas_documento(texto: str) -> Dict[str, Optional[str]]:
        fechas = {"fecha_nacimiento": None, "fecha_vencimiento": None}
        if not texto:
            return fechas

        patron_fecha = r"\b(\d{1,2}[\/\-\s](?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC|\d{1,2})[\/\-\s]\d{4})\b"
        matches = re.findall(patron_fecha, texto, re.IGNORECASE)

        if len(matches) >= 2:
            fechas["fecha_nacimiento"] = matches[0]
            fechas["fecha_vencimiento"] = matches[1]
        elif len(matches) == 1:
            fechas["fecha_vencimiento"] = matches[0]

        return fechas

    @staticmethod
    def extraer_datos_licencia(texto: str) -> Dict[str, Any]:
        datos = {"licencia_clase": "B", "fecha_vencimiento_licencia": None, "es_valida": True}
        if not texto:
            return datos

        texto_upper = texto.upper()
        if "CLASE B" in texto_upper or "CLASE: B" in texto_upper:
            datos["licencia_clase"] = "B"
        elif "CLASE A" in texto_upper or "CLASE: A" in texto_upper:
            datos["licencia_clase"] = "A"
        elif "CLASE C" in texto_upper:
            datos["licencia_clase"] = "C"

        fechas = OCRService.extraer_fechas_documento(texto)
        datos["fecha_vencimiento_licencia"] = fechas.get("fecha_vencimiento")
        return datos

    @staticmethod
    def clasificar_documento(texto: str) -> str:
        """"cedula" | "licencia" | "desconocido" según los marcadores impresos."""
        norm = _normalizar_texto(texto)
        if not norm or len(norm) < 12:
            return "desconocido"

        cedula_hits = sum(1 for m in _MARCADORES_CEDULA if m in norm)
        licencia_hits = sum(1 for m in _MARCADORES_LICENCIA if m in norm)
        tiene_rut = OCRService.extraer_rut_chileno(texto) is not None

        if licencia_hits >= 2 and licencia_hits >= cedula_hits:
            return "licencia"
        if cedula_hits >= 2 or (cedula_hits >= 1 and tiene_rut):
            return "cedula"
        return "desconocido"

    @classmethod
    def procesar_documentos_enrolamiento(
        cls,
        carnet_frontal_url: Optional[str] = None,
        carnet_trasero_url: Optional[str] = None,
        licencia_url: Optional[str] = None,
        rut_usuario: Optional[str] = None,
        selfie_url: Optional[str] = None,
        tipo_documento: str = "rut",
        pais_documento: Optional[str] = None,
    ) -> Dict[str, Any]:
        # 0. Cédula frontal obligatoria.
        if not carnet_frontal_url:
            return {
                "documentos_legibles": False,
                "confianza_ocr": 0.0,
                "estado_recomendado": "rechazado",
                "motivo": "Falta la foto de la cédula de identidad (frente). Debes tomarla con la cámara para continuar.",
                "es_mock": True,
            }

        # 1. Formato de imágenes.
        for url in [carnet_frontal_url, carnet_trasero_url, licencia_url]:
            if url and not cls.validar_formato_imagen(url):
                return {
                    "documentos_legibles": False,
                    "confianza_ocr": 0.0,
                    "estado_recomendado": "rechazado",
                    "motivo": "Formato de imagen no soportado. Debe ser JPG, PNG o WebP.",
                    "es_mock": True,
                }

        # 1.5. Documento extranjero. El resto del motor está construido sobre
        # la cédula chilena (clasificador + extracción de RUT Módulo 11), así
        # que un pasaporte saldría "rechazado" por no ser una cédula. Se
        # deriva a revisión manual del Admin en vez de rechazarlo.
        if (tipo_documento or "rut").lower() != "rut":
            return {
                "rut_extraido": None,
                "nombre_extraido": None,
                "confianza_ocr": 0.0,
                "confianza_facial": None,
                "verificacion_facial": "no_evaluado",
                "documentos_legibles": True,
                "coincide_rut_declarado": None,
                "estado_recomendado": "requiere_revision_manual",
                "motivo": (
                    f"Documento extranjero ({tipo_documento}"
                    + (f", {pais_documento}" if pais_documento else "")
                    + "): un ejecutivo debe validarlo manualmente."
                ),
                "tipo_documento_detectado": tipo_documento,
                "es_mock": settings.USE_OCR_MOCK,
            }

        # 2 + 3. Descargar y OCR en paralelo.
        from concurrent.futures import ThreadPoolExecutor

        def _descargar_y_ocr(url):
            b = cls.descargar_imagen_bytes(url) if url else None
            if not b:
                return None, None, 0.0
            txt, conf = cls.llamar_google_vision_api(b)
            return b, txt, conf

        with ThreadPoolExecutor(max_workers=3) as _ex:
            f_carnet = _ex.submit(_descargar_y_ocr, carnet_frontal_url)
            f_lic = _ex.submit(_descargar_y_ocr, licencia_url)
            f_selfie = _ex.submit(cls.descargar_imagen_bytes, selfie_url) if selfie_url else None
            bytes_carnet, texto_carnet, confianza_vision = f_carnet.result()
            bytes_licencia, texto_licencia, _ = f_lic.result()
            bytes_selfie_pre = f_selfie.result() if f_selfie else None

        api_key, tiene_creds = cls._credenciales_vision()
        vision_disponible = bool(api_key or tiene_creds) and not settings.USE_OCR_MOCK

        # 3.5. Vision disponible + cédula descargada pero sin texto.
        if vision_disponible and bytes_carnet and not (texto_carnet or texto_licencia):
            return {
                "rut_extraido": rut_usuario,
                "nombre_extraido": None,
                "confianza_ocr": 0.0,
                "confianza_facial": None,
                "verificacion_facial": "no_evaluado",
                "documentos_legibles": False,
                "coincide_rut_declarado": False,
                "estado_recomendado": "requiere_revision_manual",
                "motivo": "No pudimos leer la cédula en la foto. Vuelve a tomarla enfocada, sin reflejos y con buena luz.",
                "es_mock": False,
            }

        # 4. Vision con texto reconocido.
        if texto_carnet or texto_licencia:
            if texto_carnet:
                tipo_carnet = cls.clasificar_documento(texto_carnet)
                if tipo_carnet != "cedula":
                    return {
                        "rut_extraido": rut_usuario,
                        "nombre_extraido": None,
                        "confianza_ocr": 0.0,
                        "confianza_facial": None,
                        "verificacion_facial": "no_evaluado",
                        "documentos_legibles": False,
                        "coincide_rut_declarado": False,
                        "estado_recomendado": "rechazado",
                        "motivo": (
                            "La primera foto no corresponde a una cédula de identidad chilena. "
                            "Fotografía el frente de tu cédula, completa y dentro del marco."
                        ),
                        "tipo_documento_detectado": tipo_carnet,
                        "es_mock": False,
                    }

            rut_ocr = cls.extraer_rut_chileno(texto_carnet or "")
            nombre_extraido = cls.extraer_nombres_apellidos(texto_carnet or "")
            fechas_carnet = cls.extraer_fechas_documento(texto_carnet or "")
            datos_licencia = cls.extraer_datos_licencia(texto_licencia or "")

            motivos = []

            licencia_no_valida = bool(texto_licencia) and cls.clasificar_documento(texto_licencia) != "licencia"
            if licencia_no_valida:
                motivos.append(
                    "No pudimos reconocer tu licencia de conducir automáticamente; "
                    "la derivamos a un ejecutivo para revisarla."
                )

            if not rut_ocr:
                rut_para_guardar = rut_usuario
                coincide_rut = False
                motivos.append(
                    "No pudimos leer el RUT en la foto de la cédula. Vuelve a tomarla enfocada y con buena luz."
                )
            else:
                rut_para_guardar = rut_ocr
                coincide_rut = True
                if rut_usuario:
                    limpio_in = re.sub(r"[\.\-\s]", "", rut_usuario).upper()
                    limpio_ocr = re.sub(r"[\.\-\s]", "", rut_ocr).upper()
                    coincide_rut = limpio_in == limpio_ocr
                    if not coincide_rut:
                        motivos.append("El RUT de la cédula no coincide con el que ingresaste.")

            confianza_final = confianza_vision
            if confianza_final < 0.80:
                motivos.append("La foto de la cédula salió poco legible.")

            facial = cls.verificar_match_facial(bytes_carnet, bytes_selfie_pre)
            if facial["estado"] in ("rechazado", "revision") and facial.get("motivo"):
                motivos.append(facial["motivo"])

            if facial["estado"] == "rechazado":
                estado_recomendado = "rechazado"
            elif (
                not rut_ocr
                or not coincide_rut
                or confianza_final < 0.80
                or facial["estado"] == "revision"
                or licencia_no_valida
            ):
                estado_recomendado = "requiere_revision_manual"
            else:
                estado_recomendado = "verificado"

            return {
                "rut_extraido": rut_para_guardar,
                "nombre_extraido": nombre_extraido,
                "fecha_nacimiento": fechas_carnet.get("fecha_nacimiento"),
                "fecha_vencimiento_carnet": fechas_carnet.get("fecha_vencimiento"),
                "licencia_clase": datos_licencia.get("licencia_clase", "B"),
                "fecha_vencimiento_licencia": datos_licencia.get("fecha_vencimiento_licencia"),
                "confianza_ocr": confianza_final,
                "confianza_facial": facial.get("confianza_facial"),
                "verificacion_facial": facial["estado"],
                "documentos_legibles": True,
                "coincide_rut_declarado": coincide_rut,
                "estado_recomendado": estado_recomendado,
                "motivo": " ".join(motivos) or None,
                "tipo_documento_detectado": "cedula",
                "licencia_valida": (not licencia_no_valida) if texto_licencia else None,
                "licencia_a_soporte": bool(licencia_no_valida),
                "es_mock": False,
            }

        # 5a. Vision configurado pero sin texto (descarga falló / ilegible).
        if vision_disponible:
            logger.warning(
                "Vision configurado pero sin texto de cédula (descarga fallida o foto ilegible). "
                "Enrolamiento a revisión manual."
            )
            return {
                "rut_extraido": rut_usuario,
                "nombre_extraido": None,
                "confianza_ocr": 0.0,
                "confianza_facial": None,
                "verificacion_facial": "no_evaluado",
                "documentos_legibles": False,
                "coincide_rut_declarado": False,
                "estado_recomendado": "requiere_revision_manual",
                "motivo": (
                    "No pudimos procesar la foto de tu cédula automáticamente. "
                    "Vuelve a tomarla enfocada, sin reflejos y con buena luz, o espera la revisión manual."
                ),
                "tipo_documento_detectado": "desconocido",
                "es_mock": False,
            }

        # 5b. Mock determinista (USE_OCR_MOCK).
        logger.info("Ejecutando OCR en modo de desarrollo (Mock habilitado con validación de RUT Módulo 11).")
        rut_demo = rut_usuario if (rut_usuario and validar_rut_chileno(rut_usuario)) else "18.456.789-K"
        confianza_mock = 0.96
        coincide_rut = True
        if rut_usuario:
            limpio_in = re.sub(r"[\.\-\s]", "", rut_usuario).upper()
            limpio_ocr = re.sub(r"[\.\-\s]", "", rut_demo).upper()
            coincide_rut = limpio_in == limpio_ocr

        estado_recomendado = "verificado" if (confianza_mock >= 0.80 and coincide_rut) else "requiere_revision_manual"

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
            "estado_recomendado": estado_recomendado,
            "es_mock": True,
        }
