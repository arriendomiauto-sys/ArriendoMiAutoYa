"""
Pruebas del subsistema de verificación KYC: orquestador Didit/casero,
persistencia de assets, antecedentes ChapiAPI y el webhook de Didit.
"""
from app.features.auth.verification import VerificationOrchestrator
from app.features.auth.verification import storage_sync
from app.features.auth.background_checks import BackgroundCheckService


# ===========================================================================
# storage_sync.persist_external_asset
# ===========================================================================
def test_persist_external_asset_sin_url_devuelve_none():
    assert storage_sync.persist_external_asset(None, "id_card_front", "u1") is None


def test_persist_external_asset_url_propia_no_se_redescarga():
    url = "https://x.supabase.co/storage/v1/object/sign/documentos-kyc/abc.jpg"
    assert storage_sync.persist_external_asset(url, "id_card_front", "u1") == url


def test_persist_verification_assets_solo_devuelve_lo_persistido(monkeypatch):
    # Se simula que solo la cédula frontal se logra guardar.
    def fake_persist(asset_url, prefix, user_id, bucket="documentos-kyc"):
        return "https://storage/ok.jpg" if prefix == "id_card_front" else None

    monkeypatch.setattr(storage_sync, "persist_external_asset", fake_persist)
    out = storage_sync.persist_verification_assets(
        {"front_card_url": "https://didit/tmp1.jpg", "license_url": "https://didit/tmp2.jpg"},
        "u1",
    )
    assert out == {"front_card_url": "https://storage/ok.jpg"}


# ===========================================================================
# VerificationOrchestrator
# ===========================================================================
def test_orchestrator_camino_didit_aprobado(monkeypatch):
    monkeypatch.setattr(
        "app.features.auth.verification.orchestrator.persist_verification_assets",
        lambda assets, user_id, bucket="documentos-kyc": {},
    )
    result = VerificationOrchestrator.evaluate_user_verification(
        user_id="u1",
        external_state="aprobada",
        external_payload={"datos": {
            "nombre_completo": "Juan Pérez",
            "rut": "18.456.789-K",
            "fecha_nacimiento": "1990-01-01",
            "licencia_vencimiento": "2030-01-01",
        }},
        manual_documents=None,
        user_rut=None,
    )
    assert result.status == "approved"
    assert result.provider == "didit"
    assert result.is_identity_verified is True
    assert result.extracted_full_name == "Juan Pérez"
    assert result.extracted_license_category == "Clase B"


def test_orchestrator_camino_fallback_casero(client):
    # Documentos caseros completos -> corre el OCR (en mock por conftest).
    result = VerificationOrchestrator.evaluate_user_verification(
        user_id="u1",
        external_state=None,
        external_payload=None,
        manual_documents={
            "carnet_frontal_url": "https://ejemplo.com/front.jpg",
            "carnet_trasero_url": "https://ejemplo.com/back.jpg",
            "foto_perfil_verificada_url": "https://ejemplo.com/selfie.jpg",
        },
        user_rut="18.456.789-K",
    )
    assert result.provider == "inhouse_ocr"


def test_orchestrator_sin_datos_queda_pendiente():
    result = VerificationOrchestrator.evaluate_user_verification(
        user_id="u1",
        external_state=None,
        external_payload=None,
        manual_documents={"carnet_frontal_url": "https://ejemplo.com/front.jpg"},  # incompleto
        user_rut=None,
    )
    assert result.status == "pending"
    assert result.is_identity_verified is False


# ===========================================================================
# BackgroundCheckService (ChapiAPI en modo mock)
# ===========================================================================
def test_background_check_mock_limpio():
    result = BackgroundCheckService.verify_driver_eligibility("18.456.789-K")
    assert result.is_eligible is True
    assert result.has_suspended_license is False


def test_background_check_sin_rut_no_elegible():
    result = BackgroundCheckService.verify_driver_eligibility("")
    assert result.is_eligible is False


def test_background_check_marca_usuario_bloqueado(db_session, monkeypatch):
    from app.features.auth.background_checks import service as bg_service
    from app.features.auth.background_checks.models import BackgroundCheckResult
    from app.models.entities import Usuario

    user = Usuario(email="conductor.bg@test.cl", rut="7.654.321-8", estado_documentos="verificado")
    db_session.add(user)
    db_session.commit()

    monkeypatch.setattr(
        bg_service.BackgroundCheckService, "verify_driver_eligibility",
        classmethod(lambda cls, rut: BackgroundCheckResult(
            is_eligible=False, criminal_record_clean=False, driver_record_clean=True,
            rejection_reasons=["Presenta antecedentes penales."],
        )),
    )
    bg_service.BackgroundCheckService.run_and_flag_user(db_session, user.id)
    db_session.refresh(user)
    assert user.estado_documentos == "requiere_revision_manual"
    assert user.antecedentes_estado == "revision"


# ===========================================================================
# Webhook de Didit: veredicto Approved
# ===========================================================================
def test_webhook_didit_approved_persiste_licencia_y_metodo(client, db_session, usuario_factory, monkeypatch):
    from app.routers import webhooks

    usuario = usuario_factory(estado_documentos="pendiente", rut=None, nombre=None)
    usuario.verificacion_externa_ref = "sess-123"
    usuario.verificacion_externa_estado = "pendiente"
    db_session.commit()

    monkeypatch.setattr(webhooks.verificacion_didit, "verificar_firma_webhook", lambda *a, **k: True)
    monkeypatch.setattr(webhooks, "persist_verification_assets", lambda assets, user_id, bucket="documentos-kyc": {})
    monkeypatch.setattr(webhooks, "_run_background_check", lambda user_id: None)

    payload = {
        "webhook_type": "status.updated",
        "session_id": "sess-123",
        "vendor_data": usuario.id,
        "status": "Approved",
        "decision": {
            "id_verifications": [
                {
                    "status": "Approved",
                    "first_name": "Juan",
                    "last_name": "Pérez",
                    "personal_number": "18.456.789-K",
                    "date_of_birth": "1990-05-20",
                    "front_image": "https://didit/front.jpg",
                    "back_image": "https://didit/back.jpg",
                },
                {
                    "status": "Approved",
                    "document_type": "Driver License",
                    "front_image": "https://didit/license.jpg",
                    "date_of_expiration": "2031-03-15",
                },
            ],
        },
    }
    resp = client.post("/api/v1/webhooks/didit", json=payload)
    assert resp.status_code == 200

    db_session.refresh(usuario)
    assert usuario.verificacion_externa_estado == "aprobada"
    assert usuario.metodo_verificacion == "didit"
    assert usuario.carnet_frontal_url == "https://didit/front.jpg"
    assert usuario.licencia_url == "https://didit/license.jpg"
    assert usuario.licencia_clase == "Clase B"
    assert usuario.licencia_estado == "aprobada"
    assert usuario.licencia_vencimiento.year == 2031
