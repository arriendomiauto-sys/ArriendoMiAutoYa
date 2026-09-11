"""
El KYC del segundo conductor solo pasaba por el OCR casero, nunca por
Didit — a diferencia del titular, que sí tiene Didit como camino primario.
Ahora el segundo conductor puede verificar su identidad con la misma sesión
hosted de Didit; la licencia de conducir NUNCA pasa por ahí (Didit no la
reconoce de forma confiable), siempre se valida aparte con OCR casero.
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.main import app
from app.models.entities import Usuario, Auto, Reserva, ConductorAdicional
from app.services.auth import get_current_user


def _crear_datos(db):
    db.query(ConductorAdicional).delete()
    db.query(Reserva).delete()
    db.query(Auto).delete()
    db.query(Usuario).delete()
    db.commit()

    dueno = Usuario(
        id="dueno-scd", nombre="Dueño", rut="15.892.341-6", email="dueno.scd@test.cl",
        estado_documentos="verificado", roles_activos=["dueno"],
    )
    cliente = Usuario(
        id="cliente-scd", nombre="Cliente Titular", rut="19.234.567-7", email="cliente.scd@test.cl",
        estado_documentos="verificado", roles_activos=["cliente"],
    )
    otro = Usuario(
        id="otro-scd", nombre="Otro", rut="18.765.432-1", email="otro.scd@test.cl",
        estado_documentos="verificado", roles_activos=["cliente"],
    )
    db.add_all([dueno, cliente, otro])
    db.commit()

    auto = Auto(
        id="auto-scd-01", dueno_id=dueno.id, marca="Toyota", modelo="RAV4", anio=2023,
        patente="SCD-001", tarifa_dia=40000, estado="activo", ubicacion_base="Los Ángeles",
        documentos_verificados=True,
    )
    db.add(auto)
    db.commit()

    reserva = Reserva(
        id="res-scd-01", auto_id=auto.id, cliente_id=cliente.id,
        fecha_inicio=datetime.now(timezone.utc) + timedelta(days=1),
        fecha_fin=datetime.now(timezone.utc) + timedelta(days=4),
        estado="confirmada", monto_hold=120000, lugar_entrega_acordado="Terminal Los Ángeles",
    )
    db.add(reserva)
    db.commit()

    conductor = ConductorAdicional(
        reserva_id=reserva.id, nombre="Segundo Conductor", rut="16.789.012-1",
        email="segundo@test.cl",
    )
    db.add(conductor)
    db.commit()

    return dueno, cliente, otro, auto, reserva, conductor


def _habilitar_didit(settings):
    previos = {
        "VERIFICACION_EXTERNA_HABILITADA": settings.VERIFICACION_EXTERNA_HABILITADA,
        "DIDIT_API_KEY": settings.DIDIT_API_KEY,
        "DIDIT_WORKFLOW_ID": settings.DIDIT_WORKFLOW_ID,
        "DIDIT_WEBHOOK_SECRET": settings.DIDIT_WEBHOOK_SECRET,
    }
    settings.VERIFICACION_EXTERNA_HABILITADA = True
    settings.DIDIT_API_KEY = "test-key"
    settings.DIDIT_WORKFLOW_ID = "wf-test"
    settings.DIDIT_WEBHOOK_SECRET = "secret-test"
    return previos


def _restaurar(settings, previos):
    for k, v in previos.items():
        setattr(settings, k, v)


def test_crear_sesion_verificacion_segundo_conductor(client, db_session):
    from app.core.config import settings

    dueno, cliente, otro, auto, reserva, conductor = _crear_datos(db_session)
    previos = _habilitar_didit(settings)
    app.dependency_overrides[get_current_user] = lambda: cliente
    try:
        with patch(
            "app.features.bookings.reservations.router.verificacion_didit.crear_sesion",
            return_value={"session_id": "sess-cond-1", "url": "https://verify.didit.me/sess-cond-1"},
        ) as mock_crear:
            resp = client.post(f"/api/v1/reservas/{reserva.id}/segundo-conductor/verificacion-externa/sesion")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["url"] == "https://verify.didit.me/sess-cond-1"
        assert data["session_id"] == "sess-cond-1"

        mock_crear.assert_called_once()
        assert mock_crear.call_args.kwargs["vendor_data"] == f"conductor:{conductor.id}"

        db_session.refresh(conductor)
        assert conductor.verificacion_externa_ref == "sess-cond-1"
        assert conductor.verificacion_externa_estado == "pendiente"
    finally:
        app.dependency_overrides.clear()
        _restaurar(settings, previos)


def test_crear_sesion_solo_titular_puede_iniciarla(client, db_session):
    from app.core.config import settings

    dueno, cliente, otro, auto, reserva, conductor = _crear_datos(db_session)
    previos = _habilitar_didit(settings)
    app.dependency_overrides[get_current_user] = lambda: otro
    try:
        resp = client.post(f"/api/v1/reservas/{reserva.id}/segundo-conductor/verificacion-externa/sesion")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.clear()
        _restaurar(settings, previos)


def test_crear_sesion_falla_si_didit_no_habilitado(client, db_session):
    dueno, cliente, otro, auto, reserva, conductor = _crear_datos(db_session)
    app.dependency_overrides[get_current_user] = lambda: cliente
    try:
        resp = client.post(f"/api/v1/reservas/{reserva.id}/segundo-conductor/verificacion-externa/sesion")
        assert resp.status_code == 503
    finally:
        app.dependency_overrides.clear()


def test_webhook_conductor_aprobado_actualiza_identidad_pero_no_la_licencia(client, db_session, monkeypatch):
    from app.routers import webhooks

    dueno, cliente, otro, auto, reserva, conductor = _crear_datos(db_session)
    conductor.verificacion_externa_ref = "sess-cond-2"
    conductor.verificacion_externa_estado = "pendiente"
    conductor.licencia_url = "https://ejemplo.com/licencia-segundo.jpg"
    db_session.commit()

    monkeypatch.setattr(webhooks.verificacion_didit, "verificar_firma_webhook", lambda *a, **k: True)
    monkeypatch.setattr(webhooks, "persist_verification_assets", lambda assets, user_id, bucket="documentos-kyc": {})

    payload = {
        "webhook_type": "status.updated",
        "session_id": "sess-cond-2",
        "vendor_data": f"conductor:{conductor.id}",
        "status": "Approved",
        "decision": {
            "id_verifications": [
                {
                    "status": "Approved",
                    "first_name": "Segundo",
                    "last_name": "Conductor Verificado",
                    "personal_number": "16.789.012-1",
                    "front_image": "https://didit/front.jpg",
                    "back_image": "https://didit/back.jpg",
                },
            ],
        },
    }
    resp = client.post("/api/v1/webhooks/didit", json=payload)
    assert resp.status_code == 200

    db_session.refresh(conductor)
    assert conductor.verificacion_externa_estado == "aprobada"
    assert conductor.carnet_frontal_url == "https://didit/front.jpg"
    # La licencia no se toca por el webhook -- sigue siendo la que subió antes.
    assert conductor.licencia_url == "https://ejemplo.com/licencia-segundo.jpg"
    assert conductor.licencia_clase is None


def test_procesar_kyc_conductor_con_identidad_por_didit_solo_revisa_la_licencia(db_session, monkeypatch):
    from app.features.auth.onboarding.driver_kyc_service import ConductorKycService
    from app.features.auth.ocr.ocr_engine import OCRService

    dueno, cliente, otro, auto, reserva, conductor = _crear_datos(db_session)
    conductor.verificacion_externa_estado = "aprobada"
    conductor.fecha_nacimiento = datetime(1990, 1, 1, tzinfo=timezone.utc)
    conductor.licencia_pais_emisor = "CL"
    conductor.licencia_clase = "B"
    conductor.licencia_vencimiento = datetime.now(timezone.utc) + timedelta(days=200)
    conductor.licencia_url = "https://ejemplo.com/licencia.jpg"
    db_session.commit()

    llamadas_ocr_completo = []
    monkeypatch.setattr(
        OCRService, "procesar_documentos_enrolamiento",
        staticmethod(lambda **kw: llamadas_ocr_completo.append(kw) or {"estado_recomendado": "verificado"}),
    )
    monkeypatch.setattr(OCRService, "descargar_imagen_bytes", staticmethod(lambda url: b"fake-bytes"))
    monkeypatch.setattr(OCRService, "llamar_google_vision_api", staticmethod(lambda b: ("LICENCIA DE CONDUCIR CLASE B", 0.9)))

    resultado = ConductorKycService.procesar_kyc_conductor(conductor, reserva, db_session, crear_ticket_si_falla=False)

    # La cédula ya la validó Didit: no se vuelve a llamar al OCR completo.
    assert llamadas_ocr_completo == []
    assert resultado["estado_kyc"] == "verificado"
