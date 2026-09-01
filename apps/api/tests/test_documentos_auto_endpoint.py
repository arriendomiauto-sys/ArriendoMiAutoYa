"""
El motor de documentos del auto, ya conectado: endpoint de validación previa
y publicación bloqueada cuando un documento no sirve.

El OCR se sustituye por textos de ejemplo (no hay red en la suite), pero el
camino que se ejercita es el real: descarga -> texto -> reglas -> decisión.
"""
import pytest

from app.core.config import settings
from app.features.verificacion_identidad.ocr_engine import OCRService
from app.models.entities import Usuario

PATENTE = "XYZW-99"

PADRON = """
SERVICIO DE REGISTRO CIVIL E IDENTIFICACION
REGISTRO DE VEHICULOS MOTORIZADOS
CERTIFICADO DE INSCRIPCION
PLACA UNICA: XYZW-99
PROPIETARIO: JUAN CARLOS PEREZ SOTO
"""

PERMISO_VIGENTE = """
MUNICIPALIDAD DE LOS ANGELES
DIRECCION DE TRANSITO
PERMISO DE CIRCULACION
PLACA PATENTE: XYZW-99
VALOR PERMISO: $ 145.320
VALIDO HASTA 31-03-2099
"""

PERMISO_VENCIDO = PERMISO_VIGENTE.replace("31-03-2099", "31-03-2020")

SOAP = """
SEGURO OBLIGATORIO DE ACCIDENTES PERSONALES
LEY 18.490
POLIZA N° 987654321
PATENTE: XYZW-99
VIGENCIA DESDE 01-04-2024 HASTA 31-03-2099
"""

REVISION = """
MINISTERIO DE TRANSPORTES Y TELECOMUNICACIONES
CERTIFICADO DE REVISION TECNICA Y ANALISIS DE GASES
PLANTA DE REVISION TECNICA CLASE B
PLACA PATENTE XYZW-99
VALIDO HASTA 08/2099
"""


@pytest.fixture
def ocr_falso(monkeypatch):
    """
    Sustituye la descarga + Vision por textos fijos, indexados por la URL
    del documento. Devuelve un dict que cada test rellena.
    """
    textos = {}

    monkeypatch.setattr(settings, "USE_OCR_MOCK", False)
    monkeypatch.setattr(OCRService, "descargar_imagen_bytes", staticmethod(lambda url: url.encode()))
    monkeypatch.setattr(
        OCRService,
        "llamar_google_vision_api",
        classmethod(lambda cls, contenido: (textos.get(contenido.decode(), ""), 0.95)),
    )
    return textos


def _payload_docs(textos, permiso=PERMISO_VIGENTE):
    urls = {
        "doc_inscripcion_url": "https://cdn/padron.jpg",
        "doc_permiso_circulacion_url": "https://cdn/permiso.jpg",
        "doc_soap_url": "https://cdn/soap.jpg",
        "doc_revision_tecnica_url": "https://cdn/revision.jpg",
    }
    textos[urls["doc_inscripcion_url"]] = PADRON
    textos[urls["doc_permiso_circulacion_url"]] = permiso
    textos[urls["doc_soap_url"]] = SOAP
    textos[urls["doc_revision_tecnica_url"]] = REVISION
    return urls


def test_validar_documentos_exige_sesion(client):
    resp = client.post("/api/v1/autos/validar-documentos", json={"patente": PATENTE})
    assert resp.status_code == 401


def test_validar_documentos_responde_estado_por_documento(db_session, auth_as, ocr_falso):
    dueno = db_session.query(Usuario).first()
    urls = _payload_docs(ocr_falso)

    resp = auth_as(dueno).post("/api/v1/autos/validar-documentos", json={"patente": PATENTE, **urls})

    assert resp.status_code == 200
    data = resp.json()
    assert data["verificado"] is True
    assert data["bloqueantes"] == []

    estados = {d["tipo"]: d["estado"] for d in data["documentos"]}
    assert estados["padron"] == "sin_vencimiento"
    assert estados["permiso_circulacion"] == "vigente"
    assert estados["soap"] == "vigente"
    assert estados["revision_tecnica"] == "vigente"


def test_validar_documentos_detecta_el_permiso_vencido(db_session, auth_as, ocr_falso):
    dueno = db_session.query(Usuario).first()
    urls = _payload_docs(ocr_falso, permiso=PERMISO_VENCIDO)

    resp = auth_as(dueno).post("/api/v1/autos/validar-documentos", json={"patente": PATENTE, **urls})

    data = resp.json()
    assert data["verificado"] is False
    assert [b["tipo"] for b in data["bloqueantes"]] == ["permiso_circulacion"]
    assert "vencio" in data["bloqueantes"][0]["motivo"].lower().replace("ó", "o")


def test_no_se_publica_un_auto_con_un_documento_vencido(db_session, auth_as, ocr_falso):
    dueno = db_session.query(Usuario).first()
    dueno.estado_documentos = "verificado"
    db_session.commit()

    urls = _payload_docs(ocr_falso, permiso=PERMISO_VENCIDO)
    auto = {
        "marca": "Toyota",
        "modelo": "Yaris",
        "anio": 2023,
        "patente": PATENTE,
        "tarifa_dia": 35000,
        "ubicacion_base": "Los Ángeles",
        **urls,
    }

    resp = auth_as(dueno).post("/api/v1/autos", json=auto)

    assert resp.status_code == 400
    assert "permiso de circulación" in resp.json()["detail"].lower()


def test_un_auto_con_documentos_vigentes_se_publica_verificado(db_session, auth_as, ocr_falso):
    dueno = db_session.query(Usuario).first()
    dueno.estado_documentos = "verificado"
    db_session.commit()

    urls = _payload_docs(ocr_falso)
    auto = {
        "marca": "Toyota",
        "modelo": "Yaris",
        "anio": 2023,
        "patente": PATENTE,
        "tarifa_dia": 35000,
        "ubicacion_base": "Los Ángeles",
        **urls,
    }

    resp = auth_as(dueno).post("/api/v1/autos", json=auto)

    assert resp.status_code == 200
    assert resp.json()["documentos_verificados"] is True
