"""
Certificado de emisión de gases como documento propio y obligatorio (antes
era solo un marcador OCR ("GASES") dentro de la revisión técnica). Cubre:

- POST /autos exige doc_certificado_gases_url igual que permiso/SOAP/revisión.
- El motor OCR (car_doc_validator) reconoce el certificado de gases con sus
  propios marcadores, independientes de los de revisión técnica.
- POST /autos/validar-documentos expone el tipo "certificado_gases".
"""
import pytest

from app.core.config import settings
from app.features.verificacion_identidad.ocr_engine import OCRService
from app.features.verificacion_vehiculos.car_doc_validator import CarDocValidator
from app.models.entities import Auto

PAYLOAD_AUTO = {
    "marca": "Toyota",
    "modelo": "Yaris",
    "anio": 2021,
    "patente": "GASX-01",
    "tarifa_dia": 40000,
    "ubicacion_base": "Los Angeles, Biobio",
    "gps_consentimiento": True,
    "doc_inscripcion_url": "https://storage.test/padron.jpg",
    "doc_permiso_circulacion_url": "https://storage.test/permiso.jpg",
    "doc_soap_url": "https://storage.test/soap.jpg",
    "doc_revision_tecnica_url": "https://storage.test/revtec.jpg",
    "doc_certificado_gases_url": "https://storage.test/gases.jpg",
}


# --------------------------------------------------------------------------- #
# DOCS_REQUERIDOS: bloquea la publicación sin el certificado de gases
# --------------------------------------------------------------------------- #
def test_publicar_auto_sin_certificado_gases_se_rechaza(usuario_factory, auth_as):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    payload = {**PAYLOAD_AUTO, "doc_certificado_gases_url": None}
    resp = auth_as(dueno).post("/api/v1/autos", json=payload)
    assert resp.status_code == 400
    assert "gases" in resp.json()["detail"].lower()


def test_publicar_auto_con_certificado_gases_funciona(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    resp = auth_as(dueno).post("/api/v1/autos", json=PAYLOAD_AUTO)
    assert resp.status_code == 200, resp.text
    auto = db_session.query(Auto).filter(Auto.patente == "GASX-01").first()
    assert auto.doc_certificado_gases_url == "https://storage.test/gases.jpg"


# --------------------------------------------------------------------------- #
# Motor OCR: marcadores propios, independientes de revisión técnica
# --------------------------------------------------------------------------- #
@pytest.fixture
def ocr_controlado(monkeypatch):
    """OCR real activado, pero descarga/Vision devueltos según la URL."""
    monkeypatch.setattr(settings, "USE_OCR_MOCK", False)
    monkeypatch.setattr(OCRService, "descargar_imagen_bytes", lambda url: (url or "").encode())

    def fake_vision(image_bytes):
        url = image_bytes.decode()
        if "gases-real" in url:
            return "CERTIFICADO DE EMISIONES PATENTE GASX01 OPACIDAD DENTRO DE NORMA", 0.95
        if "revtec-sin-gases" in url:
            return "REVISION TECNICA PLANTA DE REVISION PATENTE GASX01 APROBADO", 0.95
        if "generica" in url:
            return "TOYOTA YARIS 2021 COLOR ROJO ESTACIONADO EN LA CALLE", 0.9
        return "", 0.0

    monkeypatch.setattr(OCRService, "llamar_google_vision_api", staticmethod(fake_vision))


def test_certificado_gases_real_se_reconoce_por_marcadores_propios(ocr_controlado):
    resultado = CarDocValidator.validar_documentos_vehiculo(
        patente="GASX-01",
        doc_certificado_gases_url="https://storage.test/gases-real.jpg",
    )
    assert resultado["detalles"]["gases"]["valido"] is True


def test_certificado_gases_generico_no_valida(ocr_controlado):
    resultado = CarDocValidator.validar_documentos_vehiculo(
        patente="GASX-01",
        doc_certificado_gases_url="https://storage.test/generica.jpg",
    )
    assert resultado["detalles"]["gases"]["valido"] is False


def test_validar_documentos_expone_tipo_certificado_gases(ocr_controlado, usuario_factory, auth_as):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    resp = auth_as(dueno).post(
        "/api/v1/autos/validar-documentos",
        json={"patente": "GASX-01", "doc_certificado_gases_url": "https://storage.test/gases-real.jpg"},
    )
    assert resp.status_code == 200, resp.text
    gases = next(d for d in resp.json()["documentos"] if d["tipo"] == "certificado_gases")
    assert gases["estado"] == "vigente"
