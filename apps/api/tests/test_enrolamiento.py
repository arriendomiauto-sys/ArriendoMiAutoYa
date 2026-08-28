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

def test_completar_enrolamiento_hold_800k(usuario_factory, auth_as):
    nuevo_usuario = usuario_factory(roles_activos=["cliente"], rut=None, nombre=None, estado_documentos="pendiente")
    c = auth_as(nuevo_usuario)
    resp = c.post(
        "/api/v1/enrolamiento/completar",
        json={
            "nombre": "Cliente Nuevo",
            "rut": "17.123.456-5", # RUT chileno único y válido
            "email": "cliente.nuevo.unico@test.cl",
            "telefono": "+56912345678",
            "carnet_frontal_url": "https://ejemplo.com/carnet_front.jpg",
            "foto_perfil_verificada_url": "https://ejemplo.com/selfie.jpg"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["estado_documentos"] == "verificado"
    assert "cliente" in data["roles_activos"]
    assert data["foto_perfil_verificada_url"] == "https://ejemplo.com/selfie.jpg"


def test_completar_enrolamiento_sin_foto_carnet_es_rechazado(usuario_factory, auth_as):
    """
    La cédula de identidad capturada con la cámara es obligatoria: sin ella,
    el OCR rechaza el enrolamiento y no se otorga el rol ni se cobra el hold.
    """
    nuevo_usuario = usuario_factory(roles_activos=["cliente"], rut=None, nombre=None, estado_documentos="pendiente")
    c = auth_as(nuevo_usuario)
    resp = c.post(
        "/api/v1/enrolamiento/completar",
        json={
            "nombre": "Cliente Sin Fotos",
            "rut": "17.123.456-5",
            "email": "sin.fotos.unico@test.cl",
            "telefono": "+56912345678"
        }
    )
    assert resp.status_code == 400
    assert "cámara" in resp.json()["detail"] or "cedula" in resp.json()["detail"].lower() or "cédula" in resp.json()["detail"]

def test_enrolamiento_rut_invalido_rechazado(usuario_factory, auth_as):
    nuevo_usuario = usuario_factory(roles_activos=["cliente"], rut=None, nombre=None, estado_documentos="pendiente")
    c = auth_as(nuevo_usuario)
    resp = c.post(
        "/api/v1/enrolamiento/completar",
        json={
            "nombre": "Cliente Invalido",
            "rut": "18.456.789-0", # DV incorrecto
            "email": "invalido@test.cl",
            "telefono": "+56912345678"
        }
    )
    assert resp.status_code == 422 # Pydantic validation error


def test_enrolamiento_rut_duplicado_da_400_no_500(usuario_factory, auth_as):
    """
    Sin chequeo previo, un RUT que ya usa otra cuenta revienta recién en el
    commit() con un IntegrityError crudo (mensaje técnico, no algo que se
    le pueda mostrar a un usuario) — esto verifica que se detecta antes.
    """
    ya_registrado = usuario_factory(roles_activos=["cliente"], rut="17.123.456-5", estado_documentos="verificado")
    nuevo_usuario = usuario_factory(roles_activos=["cliente"], rut=None, nombre=None, estado_documentos="pendiente")
    c = auth_as(nuevo_usuario)
    resp = c.post(
        "/api/v1/enrolamiento/completar",
        json={
            "nombre": "Otro Cliente",
            "rut": "17.123.456-5", # mismo RUT que ya_registrado
            "email": "otro.cliente@test.cl",
            "telefono": "+56912345679",
            "carnet_frontal_url": "https://ejemplo.com/carnet_front.jpg",
        }
    )
    assert resp.status_code == 400
    assert "ya está registrado" in resp.json()["detail"].lower()
