"""
El OCR de KYC debe reconocer si la foto es realmente una cédula de identidad
chilena. Antes, con Vision sin configurar, cualquier imagen caía al mock y se
aprobaba ("le saco una foto a cualquier cosa y me la toma igual"). Estas
pruebas cubren la clasificación de documento y que una foto que NO es una
cédula se rechaza en vez de pasar.
"""
import pytest

from app.config import settings
from app.engine import OCREngine

TEXTO_CEDULA = """
REPUBLICA DE CHILE
SERVICIO DE REGISTRO CIVIL E IDENTIFICACION
CEDULA DE IDENTIDAD
APELLIDOS
PEREZ SOTO
NOMBRES
JUAN CARLOS
NACIONALIDAD  CHILENA
FECHA DE NACIMIENTO  14 MAY 1992
RUN 18.456.789-K
NUMERO DOCUMENTO 123456789
"""

TEXTO_LICENCIA = """
REPUBLICA DE CHILE
MUNICIPALIDAD DE SANTIAGO
DIRECCION DE TRANSITO Y TRANSPORTE PUBLICO
LICENCIA DE CONDUCIR
CLASE B
RUN 18.456.789-K
RESTRICCIONES NINGUNA
FECHA CONTROL 20 NOV 2028
"""

TEXTO_CUALQUIER_COSA = """
SUPERMERCADO LIDER
BOLETA ELECTRONICA N 4821
COCA COLA 1.5LT   1.990
PAN MOLDE         2.290
TOTAL            4.280
GRACIAS POR SU COMPRA
"""


def test_clasificar_cedula():
    assert OCREngine.clasificar_documento(TEXTO_CEDULA) == "cedula"


def test_clasificar_licencia():
    assert OCREngine.clasificar_documento(TEXTO_LICENCIA) == "licencia"


def test_clasificar_documento_no_identidad():
    assert OCREngine.clasificar_documento(TEXTO_CUALQUIER_COSA) == "desconocido"


def test_clasificar_texto_vacio_o_corto():
    assert OCREngine.clasificar_documento("") == "desconocido"
    assert OCREngine.clasificar_documento("hola") == "desconocido"


@pytest.fixture
def vision_configurado(monkeypatch):
    """Simula Vision configurado (API key válida) sin salir a la red."""
    monkeypatch.setattr(settings, "USE_OCR_MOCK", False)
    monkeypatch.setattr(
        OCREngine, "_credenciales_vision",
        staticmethod(lambda: ("fake-vision-key-0123456789", False)),
    )
    monkeypatch.setattr(
        OCREngine, "_vision_face_detection",
        classmethod(lambda cls, b: None),  # facial -> "no_evaluado", no bloquea
    )
    monkeypatch.setattr(
        OCREngine, "descargar_imagen_bytes",
        staticmethod(lambda url: b"\xff\xd8\xff\xe0fake-jpeg-bytes"),
    )


def _stub_vision_text(monkeypatch, texto):
    monkeypatch.setattr(
        OCREngine, "llamar_google_vision_api",
        classmethod(lambda cls, image_bytes: (texto, 0.94)),
    )


def test_enrolamiento_rechaza_foto_que_no_es_cedula(vision_configurado, monkeypatch):
    _stub_vision_text(monkeypatch, TEXTO_CUALQUIER_COSA)

    resultado = OCREngine.procesar_documentos_enrolamiento(
        carnet_frontal_url="https://ejemplo.com/no-es-carnet.jpg",
        rut_usuario="18.456.789-K",
        selfie_url="https://ejemplo.com/selfie.jpg",
    )

    assert resultado["estado_recomendado"] == "rechazado"
    assert resultado["documentos_legibles"] is False
    assert resultado["tipo_documento_detectado"] == "desconocido"
    assert "cédula" in resultado["motivo"].lower()


def test_enrolamiento_acepta_cedula_real(vision_configurado, monkeypatch):
    _stub_vision_text(monkeypatch, TEXTO_CEDULA)

    resultado = OCREngine.procesar_documentos_enrolamiento(
        carnet_frontal_url="https://ejemplo.com/carnet.jpg",
        rut_usuario="18.456.789-K",
        selfie_url="https://ejemplo.com/selfie.jpg",
    )

    assert resultado["estado_recomendado"] == "verificado"
    assert resultado["tipo_documento_detectado"] == "cedula"
    assert resultado["rut_extraido"] == "18.456.789-K"


def test_licencia_no_reconocida_marca_a_soporte(vision_configurado, monkeypatch):
    """La licencia que el OCR no reconoce se marca para derivar a soporte y
    el enrolamiento queda en revisión manual, sin bloquearse."""
    def fake_vision(cls, image_bytes):
        url = (image_bytes or b"").decode(errors="ignore")
        if "licencia" in url:
            return (TEXTO_CUALQUIER_COSA, 0.9)  # no es una licencia
        return (TEXTO_CEDULA, 0.94)

    monkeypatch.setattr(
        OCREngine, "descargar_imagen_bytes",
        staticmethod(lambda url: (url or "").encode()),
    )
    monkeypatch.setattr(OCREngine, "llamar_google_vision_api", classmethod(fake_vision))

    resultado = OCREngine.procesar_documentos_enrolamiento(
        carnet_frontal_url="https://ejemplo.com/carnet_front.jpg",
        licencia_url="https://ejemplo.com/licencia.jpg",
        rut_usuario="18.456.789-K",
        selfie_url="https://ejemplo.com/selfie.jpg",
    )

    assert resultado["estado_recomendado"] == "requiere_revision_manual"
    assert resultado["licencia_a_soporte"] is True
    assert resultado["licencia_valida"] is False


def test_enrolamiento_vision_sin_texto_no_auto_verifica(vision_configurado, monkeypatch):
    """Vision configurado + foto ilegible (o descarga fallida) -> revisión
    manual, nunca 'verificado' a ciegas."""
    monkeypatch.setattr(
        OCREngine, "llamar_google_vision_api",
        classmethod(lambda cls, image_bytes: (None, 0.0)),
    )

    resultado = OCREngine.procesar_documentos_enrolamiento(
        carnet_frontal_url="https://ejemplo.com/borrosa.jpg",
        rut_usuario="18.456.789-K",
    )

    assert resultado["estado_recomendado"] != "verificado"
    assert resultado["es_mock"] is False


def test_mock_sin_carnet_es_rechazado():
    resultado = OCREngine.procesar_documentos_enrolamiento(rut_usuario="18.456.789-K")
    assert resultado["estado_recomendado"] == "rechazado"


def test_mock_con_carnet_y_rut_valido_verifica():
    resultado = OCREngine.procesar_documentos_enrolamiento(
        carnet_frontal_url="https://ejemplo.com/carnet.jpg",
        rut_usuario="17.123.456-5",
    )
    assert resultado["estado_recomendado"] == "verificado"
    assert resultado["es_mock"] is True
