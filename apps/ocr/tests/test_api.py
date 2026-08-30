"""HTTP del microservicio: health, auth por X-OCR-Key y el endpoint principal."""
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def test_health_ok():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["ocr_mock"] is True


def test_procesar_documentos_sin_clave_cuando_no_se_exige():
    settings.OCR_SERVICE_KEY = ""
    resp = client.post(
        "/v1/procesar-documentos",
        json={
            "carnet_frontal_url": "https://ejemplo.com/carnet.jpg",
            "rut_usuario": "17.123.456-5",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["estado_recomendado"] == "verificado"


def test_procesar_documentos_exige_clave_si_esta_configurada(monkeypatch):
    monkeypatch.setattr(settings, "OCR_SERVICE_KEY", "clave-secreta")

    sin_clave = client.post(
        "/v1/procesar-documentos",
        json={"carnet_frontal_url": "https://ejemplo.com/carnet.jpg"},
    )
    assert sin_clave.status_code == 401

    con_clave = client.post(
        "/v1/procesar-documentos",
        headers={"X-OCR-Key": "clave-secreta"},
        json={
            "carnet_frontal_url": "https://ejemplo.com/carnet.jpg",
            "rut_usuario": "17.123.456-5",
        },
    )
    assert con_clave.status_code == 200


def test_procesar_documentos_sin_carnet_es_rechazado():
    settings.OCR_SERVICE_KEY = ""
    resp = client.post("/v1/procesar-documentos", json={"rut_usuario": "17.123.456-5"})
    assert resp.status_code == 200
    assert resp.json()["estado_recomendado"] == "rechazado"
