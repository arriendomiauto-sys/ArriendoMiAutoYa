"""
Capturar y liberar una garantía cuando la primera llamada llegó a Mercado
Pago pero la respuesta se perdió (timeout).

Esas dos operaciones no aceptan clave de idempotencia: el reintento responde
error porque el pago ya cambió de estado. El servicio consulta el pago y, si
ya quedó como se quería, da la operación por hecha en vez de fallar para
siempre (el barrido terminaba avisando "garantía vencida sin cobrar" aunque
la plata ya estaba cobrada).
"""
import pytest

from app.core.config import settings
from app.features.payments.mercadopago_service import MercadoPagoService


@pytest.fixture(autouse=True)
def credenciales(monkeypatch):
    monkeypatch.setattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "TEST-token")


def _pasarela(monkeypatch, estado_actual, monto_actual=45000, put_ok=False):
    """PUT responde error (ya cambió de estado) o bien; GET devuelve el estado actual."""
    llamadas = []

    def pedir(cls, metodo, ruta, **kwargs):
        llamadas.append((metodo, ruta))
        if metodo == "PUT":
            if put_ok:
                return {"success": True, "data": {"id": 123, "status": kwargs["json"].get("status", "approved")}}
            return {"success": False, "status_code": 400, "error": "invalid payment status"}
        return {"success": True, "data": {"id": 123, "status": estado_actual, "transaction_amount": monto_actual}}

    monkeypatch.setattr(MercadoPagoService, "_pedir", classmethod(pedir))
    return llamadas


def test_capturar_una_garantia_ya_capturada_se_da_por_hecho(monkeypatch):
    _pasarela(monkeypatch, estado_actual="approved", monto_actual=45000)

    res = MercadoPagoService.capturar_pago("123", 45000)

    assert res["success"] and res["capturado"]


def test_capturar_ya_capturada_por_otro_monto_sigue_siendo_error(monkeypatch):
    # No se puede dar por cobrado un monto distinto del que se pidió: se revisa a mano.
    _pasarela(monkeypatch, estado_actual="approved", monto_actual=99000)

    res = MercadoPagoService.capturar_pago("123", 45000)

    assert not res["success"]


def test_capturar_una_garantia_que_se_solto_sigue_siendo_error(monkeypatch):
    _pasarela(monkeypatch, estado_actual="cancelled")

    assert not MercadoPagoService.capturar_pago("123", 45000)["success"]


def test_liberar_una_garantia_ya_liberada_se_da_por_hecho(monkeypatch):
    _pasarela(monkeypatch, estado_actual="cancelled")

    res = MercadoPagoService.liberar_hold("123")

    assert res["success"] and res["estado"] == "cancelled"


def test_liberar_una_garantia_ya_cobrada_sigue_siendo_error(monkeypatch):
    # Si ya se cobró, soltarla no es posible: hay que reembolsar, no darla por liberada.
    _pasarela(monkeypatch, estado_actual="approved")

    assert not MercadoPagoService.liberar_hold("123")["success"]


def test_si_la_consulta_tambien_falla_se_devuelve_el_error_original(monkeypatch):
    def pedir(cls, metodo, ruta, **kwargs):
        return {"success": False, "error": f"caída en {metodo}"}

    monkeypatch.setattr(MercadoPagoService, "_pedir", classmethod(pedir))

    res = MercadoPagoService.capturar_pago("123", 45000)

    assert res == {"success": False, "error": "caída en PUT"}


def test_si_la_operacion_funciona_no_se_consulta_de_nuevo(monkeypatch):
    llamadas = _pasarela(monkeypatch, estado_actual="approved", put_ok=True)

    assert MercadoPagoService.capturar_pago("123", 45000)["success"]
    assert llamadas == [("PUT", "/v1/payments/123")]
