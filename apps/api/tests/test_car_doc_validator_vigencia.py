"""
Los documentos del auto (permiso, SOAP, revisión técnica, gases, padrón) deben ser DE ESE auto y estar
vigentes. Antes bastaba con que el texto trajera un marcador del tipo de documento: el permiso de otro
auto o un SOAP vencido pasaban (TC-NEG-010 de QA).
"""
from datetime import date, timedelta

import pytest

from app.core.config import settings
from app.features.auth.background_checks.certificados import fecha_de_vencimiento
from app.features.auth.ocr.ocr_engine import OCRService
from app.features.vehicles.verification.car_doc_validator import CarDocValidator

PATENTE = "KLPW-88"


def _f(dias):
    return (date.today() + timedelta(days=dias)).strftime("%d-%m-%Y")


# ---------------------------------------------------------------------------
# Fecha de vencimiento
# ---------------------------------------------------------------------------
def test_la_fecha_de_vencimiento_es_la_ultima_de_la_vigencia():
    assert fecha_de_vencimiento("SOAP VIGENCIA: 01-04-2026 AL 31-03-2027") == date(2027, 3, 31)


@pytest.mark.parametrize("texto,esperada", [
    ("Permiso de circulación. Vencimiento: 31 de marzo de 2027", date(2027, 3, 31)),
    ("Válido hasta 2027-03-31", date(2027, 3, 31)),
    ("VENCE 31/03/2027", date(2027, 3, 31)),
])
def test_formatos_de_fecha_de_vencimiento(texto, esperada):
    assert fecha_de_vencimiento(texto) == esperada


def test_sin_indicacion_de_vencimiento_no_hay_fecha():
    assert fecha_de_vencimiento("Fecha de emisión 12/09/2026. Patente KLPW88.") is None


# ---------------------------------------------------------------------------
# Validador
# ---------------------------------------------------------------------------
@pytest.fixture
def ocr(monkeypatch):
    monkeypatch.setattr(settings, "USE_OCR_MOCK", False)
    textos = {}
    monkeypatch.setattr(OCRService, "descargar_imagen_bytes", staticmethod(lambda url: url.encode()))
    monkeypatch.setattr(OCRService, "llamar_google_vision_api", staticmethod(lambda raw: (textos.get(raw.decode()), None)))
    return textos


def _documentos(ocr, **kw):
    """Los cuatro documentos obligatorios con su texto; `kw` reemplaza el de alguno."""
    base = {
        "permiso": f"PERMISO DE CIRCULACION MUNICIPALIDAD PPU {PATENTE} VENCIMIENTO {_f(200)}",
        "soap": f"SEGURO OBLIGATORIO SOAP PPU {PATENTE} VIGENCIA {_f(-60)} AL {_f(200)}",
        "revision": f"CERTIFICADO DE REVISION TECNICA PPU {PATENTE} VALIDO HASTA {_f(200)}",
        "gases": f"CERTIFICADO DE EMISION DE GASES PPU {PATENTE} VALIDO HASTA {_f(200)}",
    }
    base.update(kw)
    ocr.update({f"url-{k}": v for k, v in base.items()})


def _validar():
    return CarDocValidator.validar_documentos_vehiculo(
        PATENTE, doc_permiso_circulacion_url="url-permiso", doc_soap_url="url-soap",
        doc_revision_tecnica_url="url-revision", doc_certificado_gases_url="url-gases",
    )


def test_documentos_del_auto_y_vigentes_se_verifican(ocr):
    _documentos(ocr)

    r = _validar()

    assert r["verificado"] is True
    assert r["conteo_validos"] == 4
    assert r["vencidos"] == []


def test_el_permiso_de_otro_auto_no_cuenta(ocr):
    _documentos(ocr, permiso=f"PERMISO DE CIRCULACION MUNICIPALIDAD PPU ABCD12 VENCIMIENTO {_f(200)}")

    r = _validar()

    assert r["detalles"]["permiso"]["valido"] is False
    assert r["conteo_validos"] == 3


def test_un_solo_documento_del_auto_no_alcanza(ocr):
    ajeno = "SEGURO OBLIGATORIO PERMISO DE CIRCULACION PPU ABCD12"
    _documentos(ocr, permiso=ajeno, revision=ajeno, gases=ajeno)

    r = _validar()

    assert r["conteo_validos"] == 1
    assert r["verificado"] is False


def test_un_soap_vencido_impide_la_verificacion_aunque_los_demas_esten_bien(ocr):
    _documentos(ocr, soap=f"SEGURO OBLIGATORIO SOAP PPU {PATENTE} VIGENCIA {_f(-400)} AL {_f(-35)}")

    r = _validar()

    assert r["verificado"] is False
    assert r["vencidos"] == ["soap"]
    assert r["detalles"]["soap"]["vencido"] is True
    assert "soap" in r["motivo_soporte"].lower() and "vencido" in r["motivo_soporte"].lower()


def test_un_documento_sin_fecha_legible_no_se_da_por_vencido(ocr):
    _documentos(ocr, gases=f"CERTIFICADO DE EMISION DE GASES PPU {PATENTE}")

    r = _validar()

    assert r["detalles"]["gases"]["vencido"] is False
    assert r["verificado"] is True
