import pytest
from app.core.config import settings
from app.features.payments import bci_payouts

CUENTA = {"banco": "BancoEstado", "tipo_cuenta": "CuentaRUT",
          "numero": "12345678", "titular": "Juan", "rut": "11.111.111-1"}


@pytest.fixture
def mock_on(monkeypatch):
    monkeypatch.setattr(settings, "BCI_PAYOUTS_HABILITADO", True)
    monkeypatch.setattr(settings, "BCI_PAYOUTS_MOCK", True)


def test_mock_transfiere_ok(mock_on):
    r = bci_payouts.transferir(CUENTA, 85000, "LIQ-abc")
    assert r["ok"] is True
    assert r["transfer_id"].startswith("BCI-MOCK-")
    assert r["estado"] == "acreditada"


def test_mock_rechaza_numero_0000(mock_on):
    r = bci_payouts.transferir({**CUENTA, "numero": "99990000"}, 85000, "LIQ-x")
    assert r["ok"] is False
    assert r["estado"] == "rechazada"


def test_consultar_transferencia_mock(mock_on):
    tid = bci_payouts.transferir(CUENTA, 1000, "LIQ-y")["transfer_id"]
    assert bci_payouts.consultar_transferencia(tid)["estado"] == "acreditada"


def test_real_sin_credenciales_explota(monkeypatch):
    monkeypatch.setattr(settings, "BCI_PAYOUTS_HABILITADO", True)
    monkeypatch.setattr(settings, "BCI_PAYOUTS_MOCK", False)
    monkeypatch.setattr(settings, "BCI_API_URL", None)
    with pytest.raises(NotImplementedError):
        bci_payouts.transferir(CUENTA, 1000, "LIQ-z")
