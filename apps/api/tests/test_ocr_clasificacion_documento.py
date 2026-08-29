"""
El OCR de KYC debe reconocer si la foto es realmente una cédula de identidad
chilena. Antes, con Vision sin configurar, cualquier imagen caía al mock y se
aprobaba ("le saco una foto a cualquier cosa y me la toma igual"). Estas
pruebas cubren la clasificación de documento y que una foto que NO es una
cédula se rechaza en vez de pasar.
"""
import pytest

from app.core.config import settings
from app.services.ocr import OCRService

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
    assert OCRService.clasificar_documento(TEXTO_CEDULA) == "cedula"


def test_clasificar_licencia():
    assert OCRService.clasificar_documento(TEXTO_LICENCIA) == "licencia"


def test_clasificar_documento_no_identidad():
    assert OCRService.clasificar_documento(TEXTO_CUALQUIER_COSA) == "desconocido"


def test_clasificar_texto_vacio_o_corto():
    assert OCRService.clasificar_documento("") == "desconocido"
    assert OCRService.clasificar_documento("hola") == "desconocido"


@pytest.fixture
def vision_configurado(monkeypatch):
    """Simula Vision configurado (API key válida) sin salir a la red."""
    monkeypatch.setattr(settings, "USE_OCR_MOCK", False)
    monkeypatch.setattr(
        OCRService, "_credenciales_vision",
        classmethod(lambda cls: ("fake-vision-key-0123456789", False)),
    )
    monkeypatch.setattr(
        OCRService, "_vision_face_detection",
        classmethod(lambda cls, b: None),  # facial -> "no_evaluado", no bloquea
    )
    monkeypatch.setattr(
        OCRService, "descargar_imagen_bytes",
        staticmethod(lambda url: b"\xff\xd8\xff\xe0fake-jpeg-bytes"),
    )


def _stub_vision_text(monkeypatch, texto):
    monkeypatch.setattr(
        OCRService, "llamar_google_vision_api",
        classmethod(lambda cls, image_bytes: (texto, 0.94)),
    )


def test_enrolamiento_rechaza_foto_que_no_es_cedula(vision_configurado, monkeypatch):
    _stub_vision_text(monkeypatch, TEXTO_CUALQUIER_COSA)

    resultado = OCRService.procesar_documentos_enrolamiento(
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

    resultado = OCRService.procesar_documentos_enrolamiento(
        carnet_frontal_url="https://ejemplo.com/carnet.jpg",
        rut_usuario="18.456.789-K",
        selfie_url="https://ejemplo.com/selfie.jpg",
    )

    assert resultado["estado_recomendado"] == "verificado"
    assert resultado["tipo_documento_detectado"] == "cedula"
    assert resultado["rut_extraido"] == "18.456.789-K"


def test_licencia_no_reconocida_abre_ticket_de_soporte(
    vision_configurado, monkeypatch, usuario_factory, auth_as, db_session
):
    """La licencia que el OCR no reconoce se deriva a soporte (ticket
    automático) y el enrolamiento queda en revisión manual, sin bloquearse."""
    from app.models.entities import TicketSoporte

    # La imagen se "descarga" como la URL en bytes; Vision decide el texto
    # según qué documento sea.
    monkeypatch.setattr(
        OCRService, "descargar_imagen_bytes",
        staticmethod(lambda url: (url or "").encode()),
    )

    def fake_vision(cls, image_bytes):
        url = (image_bytes or b"").decode()
        if "licencia" in url:
            return (TEXTO_CUALQUIER_COSA, 0.9)  # no es una licencia
        if "carnet" in url or "cedula" in url:
            return (TEXTO_CEDULA, 0.94)
        return (None, 0.0)

    monkeypatch.setattr(OCRService, "llamar_google_vision_api", classmethod(fake_vision))

    usuario = usuario_factory(
        roles_activos=["cliente"], rut=None, nombre=None, estado_documentos="pendiente"
    )
    resp = auth_as(usuario).post(
        "/api/v1/enrolamiento/completar",
        json={
            "nombre": "Cliente Con Licencia Mala",
            "rut": "17.123.456-5",
            "email": "lic.mala.unica@test.cl",
            "telefono": "+56912345678",
            "carnet_frontal_url": "https://ejemplo.com/carnet_front.jpg",
            "licencia_url": "https://ejemplo.com/licencia.jpg",
            "foto_perfil_verificada_url": "https://ejemplo.com/selfie.jpg",
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["estado_documentos"] == "requiere_revision_manual"

    tickets = (
        db_session.query(TicketSoporte)
        .filter(TicketSoporte.usuario_id == usuario.id)
        .all()
    )
    assert len(tickets) == 1
    assert "licencia" in tickets[0].asunto.lower()


def test_enrolamiento_vision_sin_texto_no_auto_verifica(vision_configurado, monkeypatch):
    """Vision configurado + foto ilegible (o descarga fallida) -> revisión
    manual, nunca 'verificado' a ciegas."""
    monkeypatch.setattr(
        OCRService, "llamar_google_vision_api",
        classmethod(lambda cls, image_bytes: (None, 0.0)),
    )

    resultado = OCRService.procesar_documentos_enrolamiento(
        carnet_frontal_url="https://ejemplo.com/borrosa.jpg",
        rut_usuario="18.456.789-K",
    )

    assert resultado["estado_recomendado"] != "verificado"
    assert resultado["es_mock"] is False
