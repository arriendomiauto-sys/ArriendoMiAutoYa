"""
Bóveda de tarjetas · modo prueba.

Con `MERCADOPAGO_TEST_MODE` encendido, el alta de tarjeta contra Mercado Pago
(camino real, token `TEST-`) debe crear el customer con el correo ficticio
`test@test.com`, no con el correo real del usuario: MP en sandbox rechaza /
ensucia el entorno con correos de producción.
"""
import pytest

from app.core.config import settings
from app.features.payments import card_vault


@pytest.fixture
def mp_real(monkeypatch):
    """Fuerza el camino real de MP (no simulado) con credenciales TEST-."""
    monkeypatch.setattr(settings, "PAGOS_SIMULADOS", False)
    monkeypatch.setattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "TEST-abc123")
    monkeypatch.setattr(settings, "MERCADOPAGO_TEST_MODE", True)


def _stub_pedir(llamadas):
    def _fake(metodo, ruta, **kwargs):
        llamadas.append((metodo, ruta, kwargs.get("json")))
        if ruta.startswith("/v1/customers/search"):
            return {"success": True, "data": {"results": []}}
        if ruta == "/v1/customers":
            return {"success": True, "data": {"id": "CUST-TEST-1"}}
        if ruta.endswith("/cards"):
            return {
                "success": True,
                "data": {
                    "id": "CARD-TEST-1",
                    "last_four_digits": "4242",
                    "expiration_month": 12,
                    "expiration_year": 2030,
                    "cardholder": {"name": "Juan Pérez"},
                    "payment_method": {"id": "visa", "payment_type_id": "credit_card"},
                },
            }
        return {"success": False, "error": "ruta inesperada"}

    return _fake


def test_modo_prueba_usa_correo_ficticio(mp_real, monkeypatch):
    llamadas = []
    monkeypatch.setattr(card_vault, "_pedir", _stub_pedir(llamadas))

    card_vault.registrar_tarjeta(
        email="cliente.real@gmail.com",
        nombre="Juan Pérez",
        card_token="TEST-token-real-sin-prefijo-simulado",
        payment_method_id="visa",
        tipo_hint="credito",
    )

    creacion = next((c for c in llamadas if c[1] == "/v1/customers"), None)
    assert creacion is not None, "no se llamó a POST /v1/customers"
    assert creacion[2]["email"] == "test@test.com"
    # y nunca se filtró el correo real
    assert all("cliente.real@gmail.com" not in str(c) for c in llamadas)


def test_sin_modo_prueba_usa_correo_real(mp_real, monkeypatch):
    monkeypatch.setattr(settings, "MERCADOPAGO_TEST_MODE", False)
    llamadas = []
    monkeypatch.setattr(card_vault, "_pedir", _stub_pedir(llamadas))

    card_vault.registrar_tarjeta(
        email="cliente.real@gmail.com",
        nombre="Juan Pérez",
        card_token="TEST-token-real",
        payment_method_id="visa",
        tipo_hint="credito",
    )

    creacion = next((c for c in llamadas if c[1] == "/v1/customers"), None)
    assert creacion is not None
    assert creacion[2]["email"] == "cliente.real@gmail.com"
