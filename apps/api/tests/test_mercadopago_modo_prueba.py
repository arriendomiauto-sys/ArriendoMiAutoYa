"""
Pruebas de cobros y pagos en Mercado Pago en modo prueba.

Verifica que cuando `MERCADOPAGO_TEST_MODE` está activo:
- Todos los cobros (preferencias de Checkout Pro y pagos directos con tarjeta tokenizada)
  se envían a Mercado Pago con el correo `test@test.com`.
- Cuando está desactivado (producción), se envía el correo real del usuario.
"""
import pytest

from app.core.config import settings
from app.features.payments.mercadopago_service import MercadoPagoService


@pytest.fixture
def mp_config(monkeypatch):
    monkeypatch.setattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "TEST-token-prueba")
    monkeypatch.setattr(settings, "MERCADOPAGO_TEST_MODE", True)


def _stub_pedir(llamadas):
    def _fake(metodo, ruta, **kwargs):
        llamadas.append((metodo, ruta, kwargs.get("json")))
        if ruta == "/checkout/preferences":
            return {
                "success": True,
                "data": {"id": "PREF-TEST-123", "sandbox_init_point": "https://sandbox.mercadopago.com/checkout"},
            }
        if ruta == "/v1/payments":
            return {
                "success": True,
                "data": {
                    "id": 999888,
                    "status": "approved",
                    "status_detail": "accredited",
                    "transaction_amount": 25000,
                    "external_reference": "REF-TEST-1",
                    "payment_method_id": "visa",
                },
            }
        return {"success": False, "error": f"ruta inesperada {ruta}"}

    return _fake


def test_crear_preferencia_modo_prueba_usa_test_at_test(mp_config, monkeypatch):
    llamadas = []
    monkeypatch.setattr(MercadoPagoService, "_pedir", _stub_pedir(llamadas))

    resultado = MercadoPagoService.crear_preferencia(
        referencia_externa="REF-PAGO-001",
        titulo="Arriendo de vehículo",
        monto=25000,
        return_url="https://app.test/retorno",
        email_pagador="usuario.real@gmail.com",
    )

    assert resultado["success"] is True
    assert len(llamadas) == 1
    metodo, ruta, json_body = llamadas[0]
    assert metodo == "POST"
    assert ruta == "/checkout/preferences"
    assert json_body["payer"] == {"email": "test@test.com"}
    assert "usuario.real@gmail.com" not in str(json_body)


def test_crear_preferencia_modo_produccion_usa_correo_real(mp_config, monkeypatch):
    monkeypatch.setattr(settings, "MERCADOPAGO_TEST_MODE", False)
    llamadas = []
    monkeypatch.setattr(MercadoPagoService, "_pedir", _stub_pedir(llamadas))

    resultado = MercadoPagoService.crear_preferencia(
        referencia_externa="REF-PAGO-002",
        titulo="Arriendo de vehículo",
        monto=25000,
        return_url="https://app.test/retorno",
        email_pagador="usuario.real@gmail.com",
    )

    assert resultado["success"] is True
    assert len(llamadas) == 1
    metodo, ruta, json_body = llamadas[0]
    assert json_body["payer"] == {"email": "usuario.real@gmail.com"}


def test_crear_pago_con_tarjeta_modo_prueba_usa_test_at_test(mp_config, monkeypatch):
    llamadas = []
    monkeypatch.setattr(MercadoPagoService, "_pedir", _stub_pedir(llamadas))

    resultado = MercadoPagoService.crear_pago_con_tarjeta(
        token_tarjeta="TEST-card-token-123",
        monto=50000,
        descripcion="Garantía de arriendo",
        email_pagador="usuario.real@gmail.com",
        referencia_externa="REF-PAGO-003",
        payment_method_id="visa",
        capturar=False,
    )

    assert resultado["success"] is True
    assert len(llamadas) == 1
    metodo, ruta, json_body = llamadas[0]
    assert metodo == "POST"
    assert ruta == "/v1/payments"
    assert json_body["payer"] == {"email": "test@test.com"}
    assert "usuario.real@gmail.com" not in str(json_body)


def test_crear_pago_con_tarjeta_modo_produccion_usa_correo_real(mp_config, monkeypatch):
    monkeypatch.setattr(settings, "MERCADOPAGO_TEST_MODE", False)
    llamadas = []
    monkeypatch.setattr(MercadoPagoService, "_pedir", _stub_pedir(llamadas))

    resultado = MercadoPagoService.crear_pago_con_tarjeta(
        token_tarjeta="TEST-card-token-123",
        monto=50000,
        descripcion="Garantía de arriendo",
        email_pagador="usuario.real@gmail.com",
        referencia_externa="REF-PAGO-004",
        payment_method_id="visa",
        capturar=False,
    )

    assert resultado["success"] is True
    assert len(llamadas) == 1
    metodo, ruta, json_body = llamadas[0]
    assert json_body["payer"] == {"email": "usuario.real@gmail.com"}


def test_es_produccion_con_token_app_usr_en_modo_prueba(monkeypatch):
    """BUG-026: Si MERCADOPAGO_TEST_MODE es True, no debe ser producción aunque el token sea APP_USR-."""
    monkeypatch.setattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "APP_USR-test-user-credentials")
    monkeypatch.setattr(settings, "MERCADOPAGO_TEST_MODE", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    assert MercadoPagoService.es_produccion() is False


def test_es_produccion_con_token_app_usr_en_produccion_real(monkeypatch):
    """BUG-026: Solo es producción real cuando TEST_MODE es False y ENVIRONMENT es production."""
    monkeypatch.setattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "APP_USR-live-credentials")
    monkeypatch.setattr(settings, "MERCADOPAGO_TEST_MODE", False)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert MercadoPagoService.es_produccion() is True
