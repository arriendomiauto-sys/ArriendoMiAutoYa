"""
La verificación de antecedentes (ChapiAPI, BackgroundCheckService) existía
como servicio pero no estaba conectada al flujo de enrolamiento que la app
realmente usa (POST /enrolamiento/completar y /enrolamiento/completar-licencia,
los endpoints en español) -- solo corría en el pipeline en inglés
(/enrolment/*) que mobile no llama. Un usuario quedaba "verificado" sin que
nadie hubiera consultado nunca sus antecedentes.

BackgroundTasks corre después de que la sesión de BD del request ya se
cerró, con su propia SessionLocal -- por eso estos tests no verifican el
efecto en la fila del usuario (eso ya lo cubre run_and_flag_user en
test_verification_kyc.py, con una sesión de test inyectada directamente),
sino que el endpoint realmente programa la tarea para el usuario correcto,
solo cuando corresponde.
"""
from app.features.auth.background_checks.service import BackgroundCheckService


def test_completar_enrolamiento_programa_verificacion_de_antecedentes(usuario_factory, auth_as, monkeypatch):
    llamadas = []
    monkeypatch.setattr(
        BackgroundCheckService, "run_and_flag_user_in_background",
        staticmethod(lambda user_id: llamadas.append(user_id)),
    )

    nuevo_usuario = usuario_factory(roles_activos=["cliente"], rut=None, nombre=None, estado_documentos="pendiente")
    resp = auth_as(nuevo_usuario).post(
        "/api/v1/enrolamiento/completar",
        json={
            "nombre": "Cliente Nuevo",
            "rut": "16.789.012-1",
            "email": "programa.antecedentes@test.cl",
            "telefono": "+56912345678",
            "tarjeta_token": "tok-test-visa",
            "tarjeta_ultimos4": "4242",
            "tarjeta_marca": "visa",
            "carnet_frontal_url": "https://ejemplo.com/carnet_front.jpg",
            "foto_perfil_verificada_url": "https://ejemplo.com/selfie.jpg",
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["estado_documentos"] == "verificado"
    assert llamadas == [nuevo_usuario.id]


def test_completar_enrolamiento_no_programa_verificacion_si_queda_en_revision(usuario_factory, auth_as, monkeypatch):
    """Si la identidad misma no quedó verificada, no tiene sentido gastar la
    consulta de antecedentes todavía -- soporte revisa todo junto."""
    llamadas = []
    monkeypatch.setattr(
        BackgroundCheckService, "run_and_flag_user_in_background",
        staticmethod(lambda user_id: llamadas.append(user_id)),
    )

    # Fuerza el OCR a "requiere_revision_manual" simulando una foto ilegible.
    from app.features.auth.ocr import ocr_engine

    monkeypatch.setattr(
        ocr_engine.OCRService, "procesar_documentos_enrolamiento",
        staticmethod(lambda **kw: {
            "estado_recomendado": "requiere_revision_manual",
            "documentos_legibles": True,
            "confianza_ocr": 0.4,
            "rut_extraido": kw.get("rut_usuario"),
            "nombre_extraido": None,
            "verificacion_facial": "revision",
            "licencia_a_soporte": False,
            "motivo": "Control facial no concluyente.",
        }),
    )

    nuevo_usuario = usuario_factory(roles_activos=["cliente"], rut=None, nombre=None, estado_documentos="pendiente")
    resp = auth_as(nuevo_usuario).post(
        "/api/v1/enrolamiento/completar",
        json={
            "nombre": "Cliente En Revision",
            "rut": "17.654.321-3",
            "email": "en.revision@test.cl",
            "telefono": "+56912345678",
            "tarjeta_token": "tok-test-visa",
            "tarjeta_ultimos4": "4242",
            "tarjeta_marca": "visa",
            "carnet_frontal_url": "https://ejemplo.com/carnet_front.jpg",
            "foto_perfil_verificada_url": "https://ejemplo.com/selfie.jpg",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["estado_documentos"] == "requiere_revision_manual"
    assert llamadas == []


def test_completar_licencia_programa_verificacion_de_antecedentes(usuario_factory, auth_as, monkeypatch):
    """
    El dueño que solo publicaba autos y ahora agrega su licencia para poder
    arrendar también dispara la verificación -- hasta ese momento nunca
    había corrido, porque en el enrolamiento inicial no subió licencia.
    """
    llamadas = []
    monkeypatch.setattr(
        BackgroundCheckService, "run_and_flag_user_in_background",
        staticmethod(lambda user_id: llamadas.append(user_id)),
    )

    dueno = usuario_factory(
        roles_activos=["dueno"], rut="15.111.222-3", nombre="Dueño Que Arrienda",
        estado_documentos="verificado",
    )
    resp = auth_as(dueno).post(
        "/api/v1/enrolamiento/completar-licencia",
        json={"licencia_url": "https://ejemplo.com/licencia.jpg"},
    )
    assert resp.status_code == 200
    assert llamadas == [dueno.id]
