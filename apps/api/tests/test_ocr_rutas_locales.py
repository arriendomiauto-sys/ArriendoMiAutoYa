"""
El OCR recibe URLs/rutas que manda el cliente. Las `http(s)` ya pasaban por el
validador anti-SSRF, pero los caminos locales no tenían defensa:

  · `/uploads/<lo que mande el cliente>` se unía a la carpeta sin normalizar,
    así que `/uploads/../uploads_privados/...` salía de ella (y los documentos de
    identidad viven en la carpeta hermana `uploads_privados`).
  · cualquier ruta absoluta que existiera en disco se leía tal cual.
  · el endpoint `/enrolamiento/procesar-documentos` no pedía sesión.
"""
import pytest

from app.core.config import settings
from app.features.auth.ocr.ocr_engine import OCRService

CONTENIDO = b"\x89PNG-contenido-de-prueba"


@pytest.fixture
def carpetas(tmp_path, monkeypatch):
    publica = tmp_path / "uploads"
    publica.mkdir()
    (publica / "foto.png").write_bytes(CONTENIDO)
    privada = tmp_path / "uploads_privados"
    (privada / "documentos-kyc").mkdir(parents=True)
    (privada / "documentos-kyc" / "carnet.png").write_bytes(CONTENIDO)
    monkeypatch.setattr(settings, "STORAGE_LOCAL_DIR", str(publica))
    monkeypatch.setattr(settings, "STORAGE_LOCAL_PRIVATE_DIR", str(privada))
    return tmp_path


def test_una_imagen_dentro_de_uploads_se_lee(carpetas):
    assert OCRService.descargar_imagen_bytes("/uploads/foto.png") == CONTENIDO


def test_uploads_no_deja_salir_de_la_carpeta(carpetas):
    assert OCRService.descargar_imagen_bytes("/uploads/../uploads_privados/documentos-kyc/carnet.png") is None


def test_una_ruta_absoluta_del_servidor_no_se_lee(carpetas):
    assert OCRService.descargar_imagen_bytes(str(carpetas / "uploads_privados" / "documentos-kyc" / "carnet.png")) is None


def test_procesar_documentos_exige_sesion(client):
    client.app.dependency_overrides.clear()

    resp = client.post(
        "/api/v1/enrolamiento/procesar-documentos",
        json={"nombre": "Ana Prueba", "rut": "11.111.111-1", "carnet_frontal_url": "/uploads/foto.png"},
    )

    assert resp.status_code in (401, 403), resp.text
