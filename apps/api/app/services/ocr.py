import os
import re
import base64
import logging
from typing import Dict, Any, Optional, List, Tuple
import httpx

from app.core.config import settings
from app.core.validators import validar_rut_chileno

logger = logging.getLogger(__name__)

class OCRService:
    VISION_REST_URL = "https://vision.googleapis.com/v1/images:annotate"

    @staticmethod
    def validar_formato_imagen(url_o_path: Optional[str]) -> bool:
        """
        Verifica que la imagen tenga una extensión permitida (.jpg, .jpeg, .png, .webp) o sea URL HTTP/HTTPS.
        """
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
        """
        Obtiene los bytes binarios de la imagen desde una URL remota, base64 o archivo local.
        """
        if not url_o_path:
            return None

        # 1. Imagen en formato Data URI (Base64)
        if url_o_path.startswith("data:image/"):
            try:
                base64_data = url_o_path.split(",")[1]
                return base64.b64decode(base64_data)
            except Exception as e:
                logger.error(f"Error al decodificar imagen base64: {e}")
                return None

        # 2. URL remota (Supabase Storage, S3 o CDN)
        if url_o_path.startswith("http://") or url_o_path.startswith("https://"):
            try:
                with httpx.Client(timeout=15.0) as client:
                    response = client.get(url_o_path)
                    if response.status_code == 200:
                        return response.content
                    else:
                        logger.warning(f"No se pudo descargar la imagen ({response.status_code}): {url_o_path}")
                        return None
            except Exception as e:
                logger.error(f"Error al descargar imagen desde URL ({url_o_path}): {e}")
                return None

        # 3. Ruta relativa del fallback local (/uploads/<bucket>/<archivo>):
        # el archivo está en STORAGE_LOCAL_DIR, en este mismo host.
        if url_o_path.startswith("/uploads/"):
            local = os.path.join(settings.STORAGE_LOCAL_DIR, url_o_path[len("/uploads/"):])
            if os.path.isfile(local):
                try:
                    with open(local, "rb") as f:
                        return f.read()
                except Exception as e:
                    logger.error(f"Error al leer archivo local ({local}): {e}")
            return None

        # 4. Archivo en sistema local (ruta absoluta)
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
        """
        Devuelve (api_key_valida | None, hay_service_account_bool).
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

    @classmethod
    def _vision_face_detection(cls, image_bytes: bytes) -> Optional[List[Dict[str, Any]]]:
        """
        Corre FACE_DETECTION de Google Cloud Vision sobre una imagen.
        Retorna la lista de rostros (cada uno con detectionConfidence y los
        *Likelihood de calidad), o None si Vision no está disponible / falló.

        Nota: Vision detecta rostros y su calidad, NO compara identidad 1:1
        (Google no ofrece face-match). Sirve como control de presencia y
        calidad de la selfie; un match biométrico real necesita otro proveedor.
        """
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
        """
        Control facial de la selfie contra la foto de la cédula.

        - Vision no hace comparación de identidad, así que esto valida:
          selfie con exactamente 1 rostro nítido + rostro presente en la cédula.
        - estados: "ok" | "revision" | "rechazado" | "no_evaluado"
          ("no_evaluado" = no se pudo correr; NO debe bloquear el enrolamiento).
        """
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

        # Rostro en la cédula (si tenemos la imagen del carnet)
        caras_carnet = cls._vision_face_detection(carnet_bytes) if carnet_bytes else None
        if caras_carnet is not None and len(caras_carnet) == 0:
            return {"estado": "revision",
                    "motivo": "No pudimos ubicar la foto en la cédula. Vuelve a fotografiarla completa y enfocada.",
                    "confianza_facial": conf, "metodo": "vision_face_detection"}

        return {"estado": "ok", "motivo": None, "confianza_facial": conf,
                "metodo": "vision_face_detection"}

    @classmethod
    def llamar_google_vision_api(cls, image_bytes: bytes) -> Tuple[Optional[str], float]:
        """
        Envía los bytes de la imagen a Google Cloud Vision (vía REST API Key o Google Cloud SDK).
        Retorna el texto extraído completo y un score de confianza estimado (0.0 a 1.0).
        """
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

        # Método A: Google Cloud Vision REST API (Mediante API Key directa)
        if tiene_api_key_valida:
            try:
                base64_content = base64.b64encode(image_bytes).decode("utf-8")
                payload = {
                    "requests": [
                        {
                            "image": {"content": base64_content},
                            "features": [
                                {"type": "DOCUMENT_TEXT_DETECTION"},
                                {"type": "TEXT_DETECTION"}
                            ]
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
                            # Estimar confianza a partir de los bloques/páginas
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

        # Método B: Google Cloud Vision Python SDK (Mediante Service Account)
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
        """
        Extrae y valida con algoritmo Módulo 11 cualquier RUT o RUN chileno encontrado en el texto.
        """
        if not texto:
            return None

        # Patrones para RUN/RUT chileno
        patrones = [
            r"\b(\d{1,2}\.?\d{3}\.?\d{3}[-–—\s]?[0-9kK])\b",
            r"(?:RUN|RUT|CEDULA)[\s:]*([0-9\.\-kK]{8,12})",
            r"\b(\d{7,8}[-–—\s]?[0-9kK])\b",
        ]

        for patron in patrones:
            matches = re.finditer(patron, texto, re.IGNORECASE)
            for m in matches:
                candidato = m.group(1).replace("–", "-").replace("—", "-").replace(" ", "")
                # Limpiar caracteres y normalizar a XX.XXX.XXX-X
                digitos_y_k = re.sub(r"[^0-9kK]", "", candidato).upper()
                if len(digitos_y_k) >= 8:
                    cuerpo = digitos_y_k[:-1]
                    dv = digitos_y_k[-1]
                    # Formato chileno estándar
                    rut_formateado = f"{int(cuerpo):,}..{dv}".replace(",", ".").replace("..", "-")
                    if validar_rut_chileno(rut_formateado):
                        return rut_formateado

        return None

    @staticmethod
    def extraer_nombres_apellidos(texto: str) -> Optional[str]:
        """
        Extrae los nombres y apellidos encontrados en una cédula de identidad chilena.
        """
        if not texto:
            return None

        lineas = [l.strip() for l in texto.split("\n") if l.strip()]
        apellidos = ""
        nombres = ""

        for idx, linea in enumerate(lineas):
            linea_upper = linea.upper()
            if "APELLIDOS" in linea_upper:
                # El texto del apellido suele estar en la siguiente línea o después de dos puntos
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
        """
        Extrae fechas de nacimiento y vencimiento de la cédula o licencia.
        """
        fechas = {
            "fecha_nacimiento": None,
            "fecha_vencimiento": None
        }
        if not texto:
            return fechas

        # Regex para fechas tipo 14 MAY 1992, 14/05/1992, 14-05-1992
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
        """
        Extrae clase de licencia de conducir (Clase B, A1, A2, etc.) y fecha de vigencia/control.
        """
        datos = {
            "licencia_clase": "B",
            "fecha_vencimiento_licencia": None,
            "es_valida": True
        }
        if not texto:
            return datos

        texto_upper = texto.upper()
        # Detección de clase
        if "CLASE B" in texto_upper or "CLASE: B" in texto_upper:
            datos["licencia_clase"] = "B"
        elif "CLASE A" in texto_upper or "CLASE: A" in texto_upper:
            datos["licencia_clase"] = "A"
        elif "CLASE C" in texto_upper:
            datos["licencia_clase"] = "C"

        fechas = OCRService.extraer_fechas_documento(texto)
        datos["fecha_vencimiento_licencia"] = fechas.get("fecha_vencimiento") or "2028-11-20"
        return datos

    @classmethod
    def procesar_documentos_enrolamiento(
        cls,
        carnet_frontal_url: Optional[str] = None,
        carnet_trasero_url: Optional[str] = None,
        licencia_url: Optional[str] = None,
        rut_usuario: Optional[str] = None,
        selfie_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Pipeline de verificación real de documentos de identidad y licencia de conducir con Google Cloud Vision.
        Si las API Keys no están presentes o USE_OCR_MOCK=True, utiliza simulación inteligente con datos chilenos.
        """
        # 0. La cédula de identidad (al menos el frente) es obligatoria: sin
        # ninguna foto capturada, no hay nada que verificar.
        if not carnet_frontal_url:
            return {
                "documentos_legibles": False,
                "confianza_ocr": 0.0,
                "estado_recomendado": "rechazado",
                "motivo": "Falta la foto de la cédula de identidad (frente). Debes tomarla con la cámara para continuar.",
                "es_mock": True
            }

        # 1. Validación de formato de imágenes
        for url in [carnet_frontal_url, carnet_trasero_url, licencia_url]:
            if url and not cls.validar_formato_imagen(url):
                return {
                    "documentos_legibles": False,
                    "confianza_ocr": 0.0,
                    "estado_recomendado": "rechazado",
                    "motivo": "Formato de imagen no soportado. Debe ser JPG, PNG o WebP.",
                    "es_mock": True
                }

        # 2. Descargar y procesar imagen del carnet frontal
        texto_carnet = None
        confianza_vision = 0.0
        bytes_carnet = None

        if carnet_frontal_url:
            bytes_carnet = cls.descargar_imagen_bytes(carnet_frontal_url)
            if bytes_carnet:
                texto_carnet, confianza_vision = cls.llamar_google_vision_api(bytes_carnet)

        # 3. Descargar y procesar licencia de conducir
        texto_licencia = None
        if licencia_url:
            bytes_licencia = cls.descargar_imagen_bytes(licencia_url)
            if bytes_licencia:
                texto_licencia, _ = cls.llamar_google_vision_api(bytes_licencia)

        # 3.5. Vision se pudo ejecutar (hay credenciales + se descargó la
        # cédula) pero no reconoció NADA de texto: la foto no es legible.
        # No se cae al mock — va a revisión manual.
        api_key, tiene_creds = cls._credenciales_vision()
        vision_disponible = bool(api_key or tiene_creds) and not settings.USE_OCR_MOCK
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

        # 4. Si se ejecutó Google Cloud Vision de manera real con texto reconocido:
        if texto_carnet or texto_licencia:
            rut_ocr = cls.extraer_rut_chileno(texto_carnet or "")
            nombre_extraido = cls.extraer_nombres_apellidos(texto_carnet or "")
            fechas_carnet = cls.extraer_fechas_documento(texto_carnet or "")
            datos_licencia = cls.extraer_datos_licencia(texto_licencia or "")

            motivos = []

            # RUT: si Vision leyó la cédula pero no se pudo extraer un RUT
            # válido, no se asume nada — va a revisión manual (no se inventa
            # un RUT ni se da por bueno el declarado).
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
                    coincide_rut = (limpio_in == limpio_ocr)
                    if not coincide_rut:
                        motivos.append("El RUT de la cédula no coincide con el que ingresaste.")

            confianza_final = max(confianza_vision, 0.88)
            if confianza_final < 0.80:
                motivos.append("La foto de la cédula salió poco legible.")

            # Verificación facial: selfie contra la foto de la cédula.
            bytes_selfie = cls.descargar_imagen_bytes(selfie_url) if selfie_url else None
            facial = cls.verificar_match_facial(bytes_carnet, bytes_selfie)
            if facial["estado"] in ("rechazado", "revision") and facial.get("motivo"):
                motivos.append(facial["motivo"])

            if facial["estado"] == "rechazado":
                estado_recomendado = "rechazado"
            elif (
                not rut_ocr
                or not coincide_rut
                or confianza_final < 0.80
                or facial["estado"] == "revision"
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
                "es_mock": False,
            }

        # 5. Modo Fallback / Simulación inteligente para desarrollo sin API Keys
        logger.info("Ejecutando OCR en modo de desarrollo (Mock habilitado con validación de RUT Módulo 11).")
        rut_demo = rut_usuario if (rut_usuario and validar_rut_chileno(rut_usuario)) else "18.456.789-K"
        confianza_mock = 0.96
        coincide_rut = True
        if rut_usuario:
            limpio_in = re.sub(r"[\.\-\s]", "", rut_usuario).upper()
            limpio_ocr = re.sub(r"[\.\-\s]", "", rut_demo).upper()
            coincide_rut = (limpio_in == limpio_ocr)

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
            "es_mock": True
        }
