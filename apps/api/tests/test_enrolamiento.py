from app.core.config import settings

def test_ocr_procesar_documentos(client):
    resp = client.post(
        "/api/v1/enrolamiento/procesar-documentos",
        json={
            "nombre": "Juan Pérez",
            "rut": "18.456.789-K",
            "email": "juan@test.cl",
            "carnet_frontal_url": "https://ejemplo.com/carnet_front.jpg"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "datos_extraidos" in data
    assert data["datos_extraidos"]["rut_extraido"] == "18.456.789-K"
    assert data["datos_extraidos"]["confianza_ocr"] > 0.8

def test_completar_enrolamiento_hold_800k(client):
    resp = client.post(
        "/api/v1/enrolamiento/completar",
        json={
            "nombre": "Cliente Nuevo",
            "rut": "17.123.456-5", # RUT chileno único y válido
            "email": "cliente.nuevo.unico@test.cl",
            "telefono": "+56912345678"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["estado_documentos"] == "verificado"
    assert "cliente" in data["roles_activos"]

def test_enrolamiento_rut_invalido_rechazado(client):
    resp = client.post(
        "/api/v1/enrolamiento/completar",
        json={
            "nombre": "Cliente Invalido",
            "rut": "18.456.789-0", # DV incorrecto
            "email": "invalido@test.cl",
            "telefono": "+56912345678"
        }
    )
    assert resp.status_code == 422 # Pydantic validation error
