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


def test_completar_enrolamiento_sin_email_usa_sesion(usuario_factory, auth_as):
    """
    Si el cliente no envía email (o envía null), el backend no debe fallar con 422
    sino mantener el email del usuario autenticado en la sesión.
    """
    nuevo_usuario = usuario_factory(roles_activos=["cliente"], rut=None, nombre=None, estado_documentos="pendiente", email="sesion@test.cl")
    c = auth_as(nuevo_usuario)
    resp = c.post(
        "/api/v1/enrolamiento/completar",
        json={
            "nombre": "Cliente Sin Email Payload",
            "rut": "17.123.456-5",
            "telefono": "+56912345678",
            "carnet_frontal_url": "https://ejemplo.com/carnet_front.jpg",
            "foto_perfil_verificada_url": "https://ejemplo.com/selfie.jpg"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "sesion@test.cl"
    assert data["estado_documentos"] == "verificado"


def test_completar_enrolamiento_usuario_ya_verificado_retorna_directo(usuario_factory, auth_as):
    """
    Si el usuario ya está verificado, completar enrolamiento retorna inmediatamente
    sin volver a cobrar ni ejecutar OCR.
    """
    ya_verificado = usuario_factory(roles_activos=["cliente"], rut="17.123.456-5", nombre="Cliente Aprobado", estado_documentos="verificado")
    c = auth_as(ya_verificado)
    resp = c.post(
        "/api/v1/enrolamiento/completar",
        json={
            "nombre": "Cualquier Nombre",
            "rut": "17.123.456-5",
            "telefono": "+56912345678",
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["estado_documentos"] == "verificado"
    assert data["nombre"] == "Cliente Aprobado"


def test_enrolamiento_con_pasaporte_extranjero_va_a_revision_manual(usuario_factory, auth_as, db_session):
    """
    ClaveÚnica no es integrable por una empresa privada, así que la identidad
    de un extranjero se resuelve con su pasaporte y el proveedor KYC. El motor
    de OCR está entrenado sobre la cédula chilena: un pasaporte no se rechaza,
    se deriva a la cola de revisión manual del Admin.
    """
    from app.models.entities import TicketSoporte

    nuevo_usuario = usuario_factory(roles_activos=["cliente"], rut=None, nombre=None, estado_documentos="pendiente")
    c = auth_as(nuevo_usuario)
    resp = c.post(
        "/api/v1/enrolamiento/completar",
        json={
            "nombre": "Marie Dupont",
            "email": "marie.dupont@test.cl",
            "telefono": "+56912345678",
            "tipo_documento": "pasaporte",
            "numero_documento": "FR9988776",
            "pais_documento": "FR",
            "licencia_pais_emisor": "FR",
            "carnet_frontal_url": "https://ejemplo.com/pasaporte.jpg",
            "foto_perfil_verificada_url": "https://ejemplo.com/selfie.jpg",
        },
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["estado_documentos"] == "requiere_revision_manual"
    assert data["rut"] is None
    assert data["numero_documento"] == "FR9988776"
    assert data["pais_documento"] == "FR"


def test_enrolamiento_extranjero_sin_pais_emisor_es_rechazado(usuario_factory, auth_as):
    nuevo_usuario = usuario_factory(roles_activos=["cliente"], rut=None, nombre=None, estado_documentos="pendiente")
    c = auth_as(nuevo_usuario)
    resp = c.post(
        "/api/v1/enrolamiento/completar",
        json={
            "nombre": "Sin País",
            "email": "sin.pais@test.cl",
            "tipo_documento": "pasaporte",
            "numero_documento": "XY123456",
            "carnet_frontal_url": "https://ejemplo.com/pasaporte.jpg",
        },
    )
    assert resp.status_code == 400
    assert "país emisor" in resp.json()["detail"]


def test_enrolamiento_chileno_mantiene_validacion_modulo_11(usuario_factory, auth_as):
    nuevo_usuario = usuario_factory(roles_activos=["cliente"], rut=None, nombre=None, estado_documentos="pendiente")
    c = auth_as(nuevo_usuario)
    resp = c.post(
        "/api/v1/enrolamiento/completar",
        json={
            "nombre": "RUT Malo",
            "rut": "12.345.678-0",  # dígito verificador incorrecto
            "email": "rut.malo@test.cl",
            "carnet_frontal_url": "https://ejemplo.com/carnet_front.jpg",
        },
    )
    # El validador de UserBase corta antes con un 422 de pydantic.
    assert resp.status_code in (400, 422)
