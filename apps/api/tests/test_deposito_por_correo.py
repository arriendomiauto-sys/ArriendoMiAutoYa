"""
Envío del correo de "depósito enviado" (Resend) al dueño, disparado desde
`liquidaciones_service._notificar_pagada` justo después de que la
transferencia BCI queda marcada como pagada. Apagado por defecto (sin
RESEND_API_KEY) para no salir a la red en dev/tests — mismo criterio que
el contrato (ver test_contrato_por_correo.py).
"""
from unittest.mock import MagicMock, patch

import pytest
from app.core.config import settings
from app.features.payments import liquidaciones_service as liq
from app.features.payments import cuentas_cobro_service as cc
from app.features.communications.email.service import (
    enviar_deposito_realizado,
    _post_deposito_realizado,
)
from app.models.entities import Pago, Usuario


@pytest.fixture
def bci_on(monkeypatch):
    monkeypatch.setattr(settings, "BCI_PAYOUTS_HABILITADO", True)
    monkeypatch.setattr(settings, "BCI_PAYOUTS_MOCK", True)


def _dueno_con_cuenta(db, numero="12345678"):
    u = db.query(Usuario).first()
    u.cuenta_bancaria = None
    db.commit()
    cc.agregar(db, u, banco="BancoEstado", tipo_cuenta="CuentaRUT",
               numero=numero, titular=u.nombre or "X", rut="11.111.111-1")
    return u


def _liquidacion(db, usuario, monto=85000, estado="pendiente"):
    p = Pago(usuario_id=usuario.id, tipo="liquidacion_dueno", monto=monto, estado=estado)
    db.add(p); db.commit(); db.refresh(p)
    return p


# --------------------------------------------------------------------------- #
# Disparo desde la liquidación (integración)
# --------------------------------------------------------------------------- #
def test_liquidacion_pagada_dispara_el_correo_de_deposito(db_session, bci_on):
    u = _dueno_con_cuenta(db_session, numero="12345678")
    _liquidacion(db_session, u, monto=85000)

    with patch(
        "app.features.payments.liquidaciones_service.enviar_deposito_realizado"
    ) as mock_enviar:
        resumen = liq.ejecutar_liquidaciones_pendientes(db_session)

    assert resumen["pagadas"] == 1
    mock_enviar.assert_called_once_with(
        email=u.email, monto=85000, banco="BancoEstado", numero_enmascarado="5678",
    )


def test_liquidacion_fallida_no_dispara_el_correo(db_session, bci_on):
    u = _dueno_con_cuenta(db_session, numero="99990000")  # rechazo simulado
    _liquidacion(db_session, u)

    with patch(
        "app.features.payments.liquidaciones_service.enviar_deposito_realizado"
    ) as mock_enviar:
        liq.ejecutar_liquidaciones_pendientes(db_session)

    mock_enviar.assert_not_called()


# --------------------------------------------------------------------------- #
# enviar_deposito_realizado / _post_deposito_realizado (unidad)
# --------------------------------------------------------------------------- #
def test_sin_api_key_no_encola_nada(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", None)
    with patch(
        "app.features.communications.email.service._email_executor"
    ) as mock_executor:
        enviar_deposito_realizado(
            email="dueno@test.cl", monto=85000, banco="BancoEstado", numero_enmascarado="5678",
        )
        mock_executor.submit.assert_not_called()


def test_sin_correo_no_encola_nada(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    with patch(
        "app.features.communications.email.service._email_executor"
    ) as mock_executor:
        enviar_deposito_realizado(
            email="", monto=85000, banco="BancoEstado", numero_enmascarado="5678",
        )
        mock_executor.submit.assert_not_called()


def test_con_api_key_encola_el_envio(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    with patch(
        "app.features.communications.email.service._email_executor"
    ) as mock_executor:
        enviar_deposito_realizado(
            email="dueno@test.cl", monto=85000, banco="BancoEstado", numero_enmascarado="5678",
        )
        mock_executor.submit.assert_called_once()
        args = mock_executor.submit.call_args[0]
        assert args[0] is _post_deposito_realizado
        assert args[1] == ["dueno@test.cl"]
        assert "85.000" in args[2]  # asunto trae el monto formateado


def test_post_deposito_realizado_arma_el_payload_correcto(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(settings, "RESEND_FROM_EMAIL", "contratos@arriendomiautoya.cl")

    with patch("httpx.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.post.return_value = MagicMock(status_code=200, text="")
        mock_client_cls.return_value.__enter__.return_value = mock_instance

        _post_deposito_realizado(
            ["dueno@test.cl"], "Depositamos $85.000 CLP en tu cuenta", "<p>hola</p>", "hola",
        )

        mock_instance.post.assert_called_once()
        _, kwargs = mock_instance.post.call_args
        body = kwargs["json"]
        assert body["from"] == "ArriendoMiAutoYa <contratos@arriendomiautoya.cl>"
        assert body["to"] == ["dueno@test.cl"]
        assert body["subject"] == "Depositamos $85.000 CLP en tu cuenta"
        assert body["html"] == "<p>hola</p>"
        assert body["text"] == "hola"
        assert "attachments" not in body
        assert kwargs["headers"]["Authorization"] == "Bearer re_test_key"


def test_post_deposito_realizado_tolerante_a_fallos_http(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    with patch("httpx.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.post.side_effect = Exception("Resend caído")
        mock_client_cls.return_value.__enter__.return_value = mock_instance

        # No debe lanzar excepción — best-effort.
        _post_deposito_realizado(["dueno@test.cl"], "asunto", "<p>x</p>", "x")
