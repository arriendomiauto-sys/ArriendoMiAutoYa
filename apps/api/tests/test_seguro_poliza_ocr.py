"""
Validación OCR de la póliza de seguro comercial (casilla OPCIONAL al publicar
un auto). El objetivo: que no se pueda "aprobar" una imagen genérica —una
foto del auto, una selfie, un papel— como si fuera una póliza.

- `evaluar_poliza_seguro` decide si un texto OCR corresponde a un contrato de
  seguro (se prueba directo, sin red).
- `POST /autos/validar-documentos` devuelve `bloquea=True` para el seguro si
  no es una póliza, así la app no deja publicar con ese archivo.
- `POST /autos` descarta el `doc_seguro_url` inválido (el auto se publica
  igual, pero la imagen genérica nunca queda guardada como póliza).
"""
import pytest

from app.core.config import settings
from app.features.verificacion_identidad.ocr_engine import OCRService
from app.features.verificacion_vehiculos.car_doc_validator import evaluar_poliza_seguro
from app.models.entities import Auto

TEXTO_POLIZA = (
    "POLIZA DE SEGURO AUTOMOTRIZ N° 44521-8\n"
    "COMPANIA DE SEGUROS GENERALES XYZ S.A.\n"
    "CONDICIONES PARTICULARES\n"
    "ASEGURADO: JUAN PEREZ SOTO\n"
    "MATERIA ASEGURADA: VEHICULO PATENTE KZZP-77\n"
    "COBERTURA: RESPONSABILIDAD CIVIL, DANOS PROPIOS, PERDIDA TOTAL\n"
    "PRIMA NETA: 180000\nDEDUCIBLE: 5 UF\n"
    "VIGENCIA: 01-01-2026 AL 01-01-2027\n"
)
TEXTO_GENERICO = "TOYOTA YARIS 2021 COLOR ROJO ESTACIONADO EN LA CALLE PRINCIPAL"

PAYLOAD_AUTO = {
    "marca": "Toyota",
    "modelo": "Yaris",
    "anio": 2021,
    "patente": "KZZP-77",
    "tarifa_dia": 40000,
    "ubicacion_base": "Los Angeles, Biobio",
    "gps_consentimiento": True,
    "doc_inscripcion_url": "https://storage.test/padron.jpg",
    "doc_permiso_circulacion_url": "https://storage.test/permiso.jpg",
    "doc_soap_url": "https://storage.test/soap.jpg",
    "doc_revision_tecnica_url": "https://storage.test/revtec.jpg",
}


# --------------------------------------------------------------------------- #
# evaluar_poliza_seguro (unidad, sin OCR real)
# --------------------------------------------------------------------------- #
def test_poliza_real_se_reconoce():
    r = evaluar_poliza_seguro(TEXTO_POLIZA, "KZZP-77")
    assert r["es_poliza"] is True
    assert r["legible"] is True


def test_imagen_generica_no_es_poliza():
    r = evaluar_poliza_seguro(TEXTO_GENERICO, "KZZP-77")
    assert r["es_poliza"] is False
    assert r["legible"] is True
    assert "póliza" in r["motivo"].lower()


def test_imagen_sin_texto_no_es_poliza():
    r = evaluar_poliza_seguro("", "KZZP-77")
    assert r["es_poliza"] is False
    assert r["legible"] is False


def test_poliza_por_folio_y_mencion():
    # "SEGURO" + un folio de póliza alcanza aunque falten marcadores fuertes.
    texto = "SEGURO VEHICULAR\nPOLIZA N° 998-12\nCLIENTE MARIA PEREZ\nCOBERTURA BASICA"
    assert evaluar_poliza_seguro(texto)["es_poliza"] is True


# --------------------------------------------------------------------------- #
# Endpoints, con OCR simulado de forma determinista (sin red)
# --------------------------------------------------------------------------- #
@pytest.fixture
def ocr_controlado(monkeypatch):
    """OCR real activado, pero descarga/Vision devueltos según la URL."""
    monkeypatch.setattr(settings, "USE_OCR_MOCK", False)
    monkeypatch.setattr(OCRService, "descargar_imagen_bytes", lambda url: (url or "").encode())

    def fake_vision(image_bytes):
        url = image_bytes.decode()
        if "seguro-poliza" in url:
            return TEXTO_POLIZA, 0.95
        if "seguro-generica" in url:
            return TEXTO_GENERICO, 0.95
        # Los 4 obligatorios: texto con marcadores + patente para que validen.
        return (
            "CERTIFICADO DE INSCRIPCION REGISTRO DE VEHICULOS MOTORIZADOS "
            "PLACA PATENTE KZZP77 FOLIO 12345",
            0.9,
        )

    monkeypatch.setattr(OCRService, "llamar_google_vision_api", staticmethod(fake_vision))


def test_validar_documentos_bloquea_seguro_generico(ocr_controlado, usuario_factory, auth_as):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    resp = auth_as(dueno).post(
        "/api/v1/autos/validar-documentos",
        json={"patente": "KZZP-77", "doc_seguro_url": "https://storage.test/seguro-generica.jpg"},
    )
    assert resp.status_code == 200, resp.text
    seguro = next(d for d in resp.json()["documentos"] if d["tipo"] == "seguro")
    assert seguro["bloquea"] is True
    assert seguro["estado"] == "tipo_incorrecto"


def test_validar_documentos_acepta_poliza_real(ocr_controlado, usuario_factory, auth_as):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    resp = auth_as(dueno).post(
        "/api/v1/autos/validar-documentos",
        json={"patente": "KZZP-77", "doc_seguro_url": "https://storage.test/seguro-poliza.jpg"},
    )
    assert resp.status_code == 200, resp.text
    seguro = next(d for d in resp.json()["documentos"] if d["tipo"] == "seguro")
    assert seguro["bloquea"] is False
    assert seguro["estado"] == "vigente"


def test_publicar_auto_descarta_seguro_generico(ocr_controlado, usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    resp = auth_as(dueno).post(
        "/api/v1/autos",
        json={**PAYLOAD_AUTO, "doc_seguro_url": "https://storage.test/seguro-generica.jpg"},
    )
    assert resp.status_code == 200, resp.text
    auto = db_session.query(Auto).filter(Auto.patente == "KZZP-77").first()
    assert auto is not None
    assert auto.doc_seguro_url is None  # la imagen genérica NO se guardó como póliza


def test_publicar_auto_guarda_poliza_valida(ocr_controlado, usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    url = "https://storage.test/seguro-poliza.jpg"
    resp = auth_as(dueno).post("/api/v1/autos", json={**PAYLOAD_AUTO, "doc_seguro_url": url})
    assert resp.status_code == 200, resp.text
    auto = db_session.query(Auto).filter(Auto.patente == "KZZP-77").first()
    assert auto.doc_seguro_url == url


def test_publicar_auto_sin_seguro_sigue_ok(ocr_controlado, usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    resp = auth_as(dueno).post("/api/v1/autos", json=PAYLOAD_AUTO)
    assert resp.status_code == 200, resp.text
    auto = db_session.query(Auto).filter(Auto.patente == "KZZP-77").first()
    assert auto.doc_seguro_url is None
