"""
Flujo de licencia de conducir 100% por Didit: workflow separado del de
identidad (DIDIT_WORKFLOW_ID_LICENCIA — solo OCR, sin liveness ni face
match, documento "DL" habilitado para prácticamente todos los países).

Cubre:
  - POST /enrolamiento/verificacion-licencia/sesion (titular)
  - POST /reservas/{id}/segundo-conductor/verificacion-licencia/sesion
  - El webhook de Didit para ambas sesiones (vendor_data
    "licencia:{usuario_id}" / "licencia_conductor:{conductor_id}")
  - driver_kyc_service: no reprocesa con OCR casero una licencia que Didit
    ya aprobó.
"""
from datetime import datetime, timedelta, timezone

from app.main import app
from app.models.entities import Auto, ConductorAdicional, Reserva, Usuario
from app.services.auth import get_current_user


def _habilitar_didit_licencia(settings):
    previos = {
        "VERIFICACION_EXTERNA_HABILITADA": settings.VERIFICACION_EXTERNA_HABILITADA,
        "DIDIT_API_KEY": settings.DIDIT_API_KEY,
        "DIDIT_WORKFLOW_ID_LICENCIA": settings.DIDIT_WORKFLOW_ID_LICENCIA,
        "DIDIT_WEBHOOK_SECRET": settings.DIDIT_WEBHOOK_SECRET,
    }
    settings.VERIFICACION_EXTERNA_HABILITADA = True
    settings.DIDIT_API_KEY = "test-key"
    settings.DIDIT_WORKFLOW_ID_LICENCIA = "wf-licencia-test"
    settings.DIDIT_WEBHOOK_SECRET = "secret-test"
    return previos


def _restaurar(settings, previos):
    for k, v in previos.items():
        setattr(settings, k, v)


# ============================================================================
# POST /enrolamiento/verificacion-licencia/sesion (titular)
# ============================================================================
def test_crear_sesion_verificacion_licencia_titular(client, db_session, usuario_factory, monkeypatch):
    from app.core.config import settings
    from app.features.auth.onboarding import router as onboarding_router

    usuario = usuario_factory(estado_documentos="verificado")
    previos = _habilitar_didit_licencia(settings)
    app.dependency_overrides[get_current_user] = lambda: usuario
    try:
        monkeypatch.setattr(
            onboarding_router.verificacion_didit,
            "crear_sesion_licencia",
            lambda **kw: {"session_id": "sess-lic-1", "url": "https://verify.didit.me/sess-lic-1"},
        )
        resp = client.post("/api/v1/enrolamiento/verificacion-licencia/sesion")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["session_id"] == "sess-lic-1"
        assert data["url"] == "https://verify.didit.me/sess-lic-1"
    finally:
        app.dependency_overrides.clear()
        _restaurar(settings, previos)


def test_crear_sesion_verificacion_licencia_requiere_identidad_verificada(client, usuario_factory):
    from app.core.config import settings

    usuario = usuario_factory(estado_documentos="requiere_revision_manual")
    previos = _habilitar_didit_licencia(settings)
    app.dependency_overrides[get_current_user] = lambda: usuario
    try:
        resp = client.post("/api/v1/enrolamiento/verificacion-licencia/sesion")
        assert resp.status_code == 400
    finally:
        app.dependency_overrides.clear()
        _restaurar(settings, previos)


def test_crear_sesion_verificacion_licencia_falla_si_no_habilitado(client, usuario_factory):
    usuario = usuario_factory(estado_documentos="verificado")
    app.dependency_overrides[get_current_user] = lambda: usuario
    try:
        resp = client.post("/api/v1/enrolamiento/verificacion-licencia/sesion")
        assert resp.status_code == 503
    finally:
        app.dependency_overrides.clear()


def test_crear_sesion_verificacion_licencia_guarda_pais_emisor_extranjero(client, db_session, usuario_factory, monkeypatch):
    from app.core.config import settings
    from app.features.auth.onboarding import router as onboarding_router

    usuario = usuario_factory(estado_documentos="verificado")
    usuario.tipo_documento = "pasaporte"
    usuario.pais_documento = "AR"
    db_session.commit()
    previos = _habilitar_didit_licencia(settings)
    app.dependency_overrides[get_current_user] = lambda: usuario
    try:
        monkeypatch.setattr(
            onboarding_router.verificacion_didit,
            "crear_sesion_licencia",
            lambda **kw: {"session_id": "sess-lic-2", "url": "https://verify.didit.me/sess-lic-2"},
        )
        resp = client.post(
            "/api/v1/enrolamiento/verificacion-licencia/sesion",
            json={"licencia_pais_emisor": "ar", "es_residente_chile": False},
        )
        assert resp.status_code == 200, resp.text
        db_session.refresh(usuario)
        assert usuario.licencia_pais_emisor == "AR"
    finally:
        app.dependency_overrides.clear()
        _restaurar(settings, previos)


# ============================================================================
# Webhook de Didit: sesión de LICENCIA del titular
# ============================================================================
def test_webhook_licencia_titular_aprobada_verifica(client, db_session, usuario_factory, monkeypatch):
    from app.features.system.webhooks import router as webhooks

    usuario = usuario_factory(estado_documentos="verificado")
    usuario.licencia_verificacion_externa_ref = "sess-lic-3"
    usuario.licencia_verificacion_externa_estado = "pendiente"
    db_session.commit()

    monkeypatch.setattr(webhooks.verificacion_didit, "verificar_firma_webhook", lambda *a, **k: True)

    payload = {
        "webhook_type": "status.updated",
        "session_id": "sess-lic-3",
        "vendor_data": f"licencia:{usuario.id}",
        "status": "Approved",
        "decision": {
            "id_verifications": [
                {
                    "status": "Approved",
                    "document_number": "L-998877",
                    "expiration_date": "2031-03-15",
                    "front_image": "https://didit/licencia-frontal.jpg",
                    "back_image": "https://didit/licencia-trasera.jpg",
                },
            ],
        },
    }
    resp = client.post("/api/v1/webhooks/didit", json=payload)
    assert resp.status_code == 200, resp.text

    db_session.refresh(usuario)

    assert usuario.licencia_verificacion_externa_estado == "aprobada"
    assert usuario.licencia_estado == "verificada"
    assert usuario.licencia_numero == "L-998877"
    assert usuario.licencia_vencimiento == datetime(2031, 3, 15)
    assert usuario.licencia_url == "https://didit/licencia-frontal.jpg"
    assert usuario.licencia_pais_emisor == "CL"
    assert usuario.licencia_clase == "B"


def test_webhook_licencia_titular_va_a_revision_si_regla_de_negocio_lo_rechaza(
    client, db_session, usuario_factory, monkeypatch
):
    from app.features.system.webhooks import router as webhooks

    # País no catalogado frente al Convenio de Viena -> revisión manual
    # (ver license_service.evaluar_licencia), aunque Didit haya aprobado la
    # lectura del documento. `usuario_factory` no mapea tipo_documento/
    # pais_documento, así que se fijan a mano.
    usuario = usuario_factory(estado_documentos="verificado")
    usuario.tipo_documento = "pasaporte"
    usuario.pais_documento = "US"
    usuario.licencia_verificacion_externa_ref = "sess-lic-4"
    usuario.licencia_verificacion_externa_estado = "pendiente"
    db_session.commit()

    monkeypatch.setattr(webhooks.verificacion_didit, "verificar_firma_webhook", lambda *a, **k: True)

    payload = {
        "webhook_type": "status.updated",
        "session_id": "sess-lic-4",
        "vendor_data": f"licencia:{usuario.id}",
        "status": "Approved",
        "decision": {
            "id_verifications": [
                {"status": "Approved", "document_number": "US-12345", "expiration_date": "2030-01-01"},
            ],
        },
    }
    resp = client.post("/api/v1/webhooks/didit", json=payload)
    assert resp.status_code == 200, resp.text

    db_session.refresh(usuario)

    assert usuario.licencia_estado == "revision"


def test_webhook_licencia_titular_sesion_vieja_se_ignora(client, db_session, usuario_factory, monkeypatch):
    from app.features.system.webhooks import router as webhooks

    usuario = usuario_factory(estado_documentos="verificado")
    usuario.licencia_verificacion_externa_ref = "sess-vigente"
    usuario.licencia_verificacion_externa_estado = "pendiente"
    db_session.commit()

    monkeypatch.setattr(webhooks.verificacion_didit, "verificar_firma_webhook", lambda *a, **k: True)

    payload = {
        "webhook_type": "status.updated",
        "session_id": "sess-vieja",
        "vendor_data": f"licencia:{usuario.id}",
        "status": "Approved",
        "decision": {"id_verifications": [{"status": "Approved", "document_number": "X"}]},
    }
    resp = client.post("/api/v1/webhooks/didit", json=payload)
    assert resp.status_code == 200

    db_session.refresh(usuario)
    assert usuario.licencia_estado is None
    assert usuario.licencia_verificacion_externa_estado == "pendiente"


# ============================================================================
# Segundo conductor: sesión y webhook de LICENCIA
# ============================================================================
def _crear_reserva_con_conductor(db):
    dueno = Usuario(
        id="dueno-lic", nombre="Dueño", rut="20.111.222-3", email="dueno.lic@test.cl",
        estado_documentos="verificado", roles_activos=["dueno"],
    )
    cliente = Usuario(
        id="cliente-lic", nombre="Cliente Titular", rut="20.333.444-5", email="cliente.lic@test.cl",
        estado_documentos="verificado", roles_activos=["cliente"],
    )
    db.add_all([dueno, cliente])
    db.commit()

    auto = Auto(
        id="auto-lic-01", dueno_id=dueno.id, marca="Toyota", modelo="Yaris", anio=2023,
        patente="LIC-001", tarifa_dia=30000, estado="activo", ubicacion_base="Los Ángeles",
        documentos_verificados=True,
    )
    db.add(auto)
    db.commit()

    reserva = Reserva(
        id="res-lic-01", auto_id=auto.id, cliente_id=cliente.id,
        fecha_inicio=datetime.now(timezone.utc) + timedelta(days=1),
        fecha_fin=datetime.now(timezone.utc) + timedelta(days=4),
        estado="confirmada", monto_hold=90000, lugar_entrega_acordado="Terminal Los Ángeles",
    )
    db.add(reserva)
    db.commit()

    conductor = ConductorAdicional(
        reserva_id=reserva.id, nombre="Segundo Conductor", rut="16.789.012-1",
        email="segundo.lic@test.cl", fecha_nacimiento=datetime(1990, 1, 1, tzinfo=timezone.utc),
    )
    db.add(conductor)
    db.commit()
    return cliente, reserva, conductor


def test_crear_sesion_verificacion_licencia_segundo_conductor(client, db_session, monkeypatch):
    from app.core.config import settings
    from app.features.bookings.reservations import router as reservations_router

    cliente, reserva, conductor = _crear_reserva_con_conductor(db_session)
    previos = _habilitar_didit_licencia(settings)
    app.dependency_overrides[get_current_user] = lambda: cliente
    try:
        monkeypatch.setattr(
            reservations_router.verificacion_didit,
            "crear_sesion_licencia",
            lambda **kw: {"session_id": "sess-lic-cond-1", "url": "https://verify.didit.me/sess-lic-cond-1"},
        )
        resp = client.post(f"/api/v1/reservas/{reserva.id}/segundo-conductor/verificacion-licencia/sesion")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["session_id"] == "sess-lic-cond-1"

        db_session.refresh(conductor)
        assert conductor.licencia_verificacion_externa_ref == "sess-lic-cond-1"
        assert conductor.licencia_verificacion_externa_estado == "pendiente"
    finally:
        app.dependency_overrides.clear()
        _restaurar(settings, previos)


def test_webhook_licencia_conductor_aprobada_recalcula_kyc(client, db_session, monkeypatch):
    from app.features.system.webhooks import router as webhooks

    cliente, reserva, conductor = _crear_reserva_con_conductor(db_session)
    conductor.verificacion_externa_estado = "aprobada"  # identidad ya validada por Didit
    conductor.licencia_verificacion_externa_ref = "sess-lic-cond-2"
    conductor.licencia_verificacion_externa_estado = "pendiente"
    db_session.commit()

    monkeypatch.setattr(webhooks.verificacion_didit, "verificar_firma_webhook", lambda *a, **k: True)

    payload = {
        "webhook_type": "status.updated",
        "session_id": "sess-lic-cond-2",
        "vendor_data": f"licencia_conductor:{conductor.id}",
        "status": "Approved",
        "decision": {
            "id_verifications": [
                {
                    "status": "Approved",
                    "document_number": "L-CONDUCTOR-1",
                    "expiration_date": "2030-06-01",
                    "front_image": "https://didit/licencia-conductor.jpg",
                },
            ],
        },
    }
    resp = client.post("/api/v1/webhooks/didit", json=payload)
    assert resp.status_code == 200, resp.text

    db_session.refresh(conductor)
    assert conductor.licencia_verificacion_externa_estado == "aprobada"
    assert conductor.licencia_numero == "L-CONDUCTOR-1"
    assert conductor.licencia_vencimiento == datetime(2030, 6, 1)
    assert conductor.licencia_url == "https://didit/licencia-conductor.jpg"
    # Identidad + licencia ambas por Didit -> KYC del conductor queda verificado.
    assert conductor.estado_kyc == "verificado"


# ============================================================================
# driver_kyc_service: no reprocesa con Vision una licencia ya aprobada por Didit
# ============================================================================
def test_procesar_kyc_conductor_con_licencia_por_didit_no_reprocesa_ocr(db_session, monkeypatch):
    from app.features.auth.onboarding.driver_kyc_service import ConductorKycService
    from app.features.auth.ocr.ocr_engine import OCRService

    cliente, reserva, conductor = _crear_reserva_con_conductor(db_session)
    conductor.carnet_frontal_url = "https://ejemplo.com/carnet.jpg"
    conductor.licencia_verificacion_externa_estado = "aprobada"
    conductor.licencia_pais_emisor = "CL"
    conductor.licencia_clase = "B"
    conductor.licencia_vencimiento = datetime.now(timezone.utc) + timedelta(days=200)
    conductor.licencia_url = "https://didit/licencia-conductor.jpg"
    db_session.commit()

    llamadas = []

    def _fake_ocr(**kw):
        llamadas.append(kw)
        return {"estado_recomendado": "verificado", "licencia_a_soporte": True}  # a propósito: debe ser ignorado

    monkeypatch.setattr(OCRService, "procesar_documentos_enrolamiento", staticmethod(_fake_ocr))

    resultado = ConductorKycService.procesar_kyc_conductor(conductor, reserva, db_session, crear_ticket_si_falla=False)

    assert len(llamadas) == 1
    # La licencia ya aprobada por Didit no se le pasa al OCR casero.
    assert llamadas[0]["licencia_url"] is None
    # Aunque el OCR (falso, con datos viejos) diga que hay que revisar la
    # licencia, se ignora: Didit ya la aprobó.
    assert resultado["estado_kyc"] == "verificado"
