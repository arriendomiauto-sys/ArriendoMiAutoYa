"""
Pruebas del subsistema de verificación KYC: persistencia de assets,
antecedentes ChapiAPI y el webhook de Didit.
"""
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
# Webhook de Didit: veredicto Approved
# ===========================================================================
def test_webhook_didit_approved_persiste_identidad_pero_no_la_licencia(client, db_session, usuario_factory, monkeypatch):
    """
    Didit certifica identidad, nunca licencia de conducir (todavía no la
    reconoce de forma confiable). Aunque el payload traiga una entrada de
    tipo "Driver License", el webhook no debe darla por aprobada ni tocar
    licencia_url/licencia_clase/licencia_estado -- eso queda enteramente a
    cargo del pipeline casero de Google Vision (completar-licencia).
    """
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
    assert usuario.licencia_url is None
    assert usuario.licencia_clase is None
    assert usuario.licencia_estado is None
    assert usuario.licencia_vencimiento is None
