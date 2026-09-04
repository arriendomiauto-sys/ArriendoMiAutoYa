"""
Reacción del backend al resultado del OCR.

Aquí no se prueba el pipeline de OCR en sí — eso está en test_ocr_engine.py —
sino lo que el endpoint /enrolamiento/completar hace con la respuesta:
- `licencia_a_soporte: True`  -> abre un TicketSoporte y deja el KYC en revisión.
- `estado_recomendado: rechazado` -> 400, no otorga rol ni cobra el hold.
"""
import pytest

from app.features.verificacion_identidad import ocr_engine as ocr_module


@pytest.fixture
def ocr_stub(monkeypatch):
    """Reemplaza el cliente de OCR por una respuesta fija."""
    def _set(resultado):
        monkeypatch.setattr(
            ocr_module.OCRService,
            "procesar_documentos_enrolamiento",
            classmethod(lambda cls, **kwargs: dict(resultado)),
        )
    return _set


def test_licencia_no_reconocida_abre_ticket_de_soporte(
    ocr_stub, usuario_factory, auth_as, db_session
):
    from app.models.entities import TicketSoporte

    ocr_stub({
        "rut_extraido": "17.123.456-5",
        "nombre_extraido": "Cliente Con Licencia Mala",
        "confianza_ocr": 0.9,
        "documentos_legibles": True,
        "coincide_rut_declarado": True,
        "estado_recomendado": "requiere_revision_manual",
        "motivo": "No pudimos reconocer tu licencia; la derivamos a un ejecutivo.",
        "licencia_valida": False,
        "licencia_a_soporte": True,
        "es_mock": False,
    })

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
            "tarjeta_token": "tok-test-visa",

            "tarjeta_ultimos4": "4242",

            "tarjeta_marca": "visa",

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
    # Los problemas del enrolamiento se consolidan en un solo ticket: el
    # ejecutivo ve el caso completo y el usuario recibe una sola respuesta.
    assert tickets[0].asunto == "Revisión manual de enrolamiento"
    assert "licencia" in tickets[0].descripcion.lower()


def test_ocr_rechazado_no_otorga_rol_ni_cobra_hold(
    ocr_stub, usuario_factory, auth_as, db_session
):
    from app.models.entities import Pago

    ocr_stub({
        "documentos_legibles": False,
        "confianza_ocr": 0.0,
        "estado_recomendado": "rechazado",
        "motivo": "La primera foto no corresponde a una cédula de identidad chilena.",
        "es_mock": False,
    })

    usuario = usuario_factory(
        roles_activos=[], rut=None, nombre=None, estado_documentos="pendiente"
    )
    resp = auth_as(usuario).post(
        "/api/v1/enrolamiento/completar",
        json={
            "nombre": "Cliente Foto Mala",
            "rut": "17.123.456-5",
            "email": "foto.mala.unica@test.cl",
            "telefono": "+56912345678",
            "tarjeta_token": "tok-test-visa",

            "tarjeta_ultimos4": "4242",

            "tarjeta_marca": "visa",

            "carnet_frontal_url": "https://ejemplo.com/no-es-carnet.jpg",
            "foto_perfil_verificada_url": "https://ejemplo.com/selfie.jpg",
        },
    )
    assert resp.status_code == 400
    assert "cédula" in resp.json()["detail"].lower()

    db_session.expire_all()
    holds = (
        db_session.query(Pago)
        .filter(Pago.usuario_id == usuario.id, Pago.tipo == "hold_enrolamiento")
        .all()
    )
    assert holds == []
