"""
Pruebas contra el SANDBOX REAL de Mercado Pago (no usan dobles).

Solo corren con `RUN_MP_SANDBOX=1`:

    RUN_MP_SANDBOX=1 python -m pytest tests/test_mp_sandbox.py -v

Usan la BD SQLite en memoria de siempre (nunca Supabase) y llaman a la API de
MP con `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_PUBLIC_KEY` del entorno.

Guardas de seguridad (se evalúan una sola vez, antes de mover "plata"):
  1. El access token debe pertenecer a un usuario con la etiqueta `test_user`.
     Si no, la suite se NIEGA a correr: podría crear cobros reales.
  2. La public key debe ser del mismo entorno que el access token. Si no, MP
     responde 401 "Unauthorized use of live credentials" y se falla con un
     mensaje que dice exactamente eso, en vez de 5 errores crípticos.

Tarjetas de prueba de Mercado Pago Chile (MLC). El TITULAR de la tarjeta decide
el resultado: APRO aprueba, FUND = fondos insuficientes, SECU = código de
seguridad inválido.

NOTA: estos tests se escribieron sin poder ejecutarlos completos (las llaves del
`.env` no coinciden, ver guarda 2). Validar y ajustar en la primera corrida real.
"""
import os
import uuid

import httpx
import pytest

from app.core.config import settings
from app.features.payments.mercadopago_service import MercadoPagoService as MP

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_MP_SANDBOX") != "1",
    reason="pruebas contra el sandbox real de Mercado Pago: activar con RUN_MP_SANDBOX=1",
)

API = "https://api.mercadopago.com"
VISA_CREDITO = "4168818844447115"
MC_CREDITO = "5416752602582580"


def _tokenizar(numero: str = VISA_CREDITO, titular: str = "APRO") -> str:
    r = httpx.post(
        f"{API}/v1/card_tokens?public_key={settings.MERCADOPAGO_PUBLIC_KEY}",
        json={
            "card_number": numero, "security_code": "123",
            "expiration_month": 11, "expiration_year": 2030,
            "cardholder": {"name": titular, "identification": {"type": "RUT", "number": "12345678-5"}},
        },
        timeout=20,
    )
    assert r.status_code in (200, 201), f"no se pudo tokenizar: {r.status_code} {r.text}"
    return r.json()["id"]


def _ref(prefijo: str) -> str:
    return f"QA-{prefijo}-{uuid.uuid4().hex[:10]}"


@pytest.fixture(scope="module")
def sandbox():
    if not settings.MERCADOPAGO_ACCESS_TOKEN or not settings.MERCADOPAGO_PUBLIC_KEY:
        pytest.skip("faltan MERCADOPAGO_ACCESS_TOKEN y/o MERCADOPAGO_PUBLIC_KEY")

    # Guarda 1: solo usuarios de prueba.
    me = httpx.get(f"{API}/users/me", headers={"Authorization": f"Bearer {settings.MERCADOPAGO_ACCESS_TOKEN}"}, timeout=20)
    assert me.status_code == 200, f"el access token no autentica: {me.status_code}"
    if "test_user" not in (me.json().get("tags") or []):
        pytest.exit(
            "ABORTADO: el access token NO es de un usuario de prueba de Mercado Pago "
            "(falta la etiqueta `test_user`). Esta suite no corre contra credenciales reales.",
            returncode=2,
        )

    # Guarda 2: la public key debe ser del mismo entorno que el access token.
    sonda = MP.crear_pago_con_tarjeta(_tokenizar(), 1000, "sonda", "x@y.cl", _ref("SONDA"), capturar=False)
    if not sonda.get("success") and "live credentials" in str(sonda.get("error")):
        pytest.fail(
            "MERCADOPAGO_PUBLIC_KEY y MERCADOPAGO_ACCESS_TOKEN son de entornos distintos: la key genera tokens "
            "`live_mode` y MP los rechaza con el access token de prueba (401 'Unauthorized use of live "
            "credentials'). Usa la PUBLIC KEY de prueba del MISMO usuario de prueba (panel de MP > Credenciales "
            "de prueba), tanto en el backend como en EXPO_PUBLIC_MP_PUBLIC_KEY de las apps.",
            pytrace=False,
        )
    if sonda.get("payment_id"):
        MP.liberar_hold(sonda["payment_id"])
    return True


def test_el_hold_se_autoriza_y_se_libera(sandbox):
    res = MP.crear_pago_con_tarjeta(_tokenizar(), 250000, "Garantía QA", "x@y.cl", _ref("HOLD"), capturar=False)
    assert res["success"], res
    assert res["estado"] == "authorized" and res["retenido"] is True

    liberado = MP.liberar_hold(res["payment_id"])
    assert liberado["success"], liberado
    assert MP.obtener_pago(res["payment_id"])["estado"] == "cancelled"


def test_el_cobro_se_aprueba_y_se_reembolsa(sandbox):
    res = MP.crear_pago_con_tarjeta(_tokenizar(MC_CREDITO), 60000, "Arriendo QA", "x@y.cl", _ref("COBRO"), capturar=True)
    assert res["success"], res
    assert res["estado"] == "approved" and res["capturado"] is True

    reembolso = MP.reembolsar(res["payment_id"])
    assert reembolso["success"], reembolso
    assert MP.obtener_pago(res["payment_id"])["estado"] == "refunded"


def test_fondos_insuficientes_se_rechaza(sandbox):
    res = MP.crear_pago_con_tarjeta(_tokenizar(titular="FUND"), 60000, "Arriendo QA", "x@y.cl", _ref("FUND"))
    assert res["success"], res
    assert res["autorizada"] is False
    assert res["detalle_estado"] == "cc_rejected_insufficient_amount"


def test_codigo_de_seguridad_invalido_se_rechaza(sandbox):
    res = MP.crear_pago_con_tarjeta(_tokenizar(titular="SECU"), 60000, "Arriendo QA", "x@y.cl", _ref("SECU"))
    assert res["success"], res
    assert res["autorizada"] is False
    assert res["detalle_estado"] == "cc_rejected_bad_filled_security_code"


def test_se_puede_capturar_solo_una_parte_de_la_garantia(sandbox):
    """
    Es el mecanismo que necesitaría cobrar cargos de devolución sin cobrar toda
    la garantía (ver test_cobros_posteriores_a_la_devolucion.py). Aquí se
    verifica que Mercado Pago lo permite.
    """
    hold = MP.crear_pago_con_tarjeta(_tokenizar(), 250000, "Garantía QA", "x@y.cl", _ref("PARC"), capturar=False)
    assert hold["success"] and hold["retenido"], hold

    capturado = MP.capturar_pago(hold["payment_id"], 30000)
    assert capturado["success"], capturado
    assert capturado["estado"] == "approved"
    assert capturado["monto"] == 30000


def test_reintentar_con_la_misma_referencia_no_cobra_dos_veces(sandbox):
    ref = _ref("IDEM")
    token = _tokenizar()
    primero = MP.crear_pago_con_tarjeta(token, 60000, "Arriendo QA", "x@y.cl", ref)
    segundo = MP.crear_pago_con_tarjeta(token, 60000, "Arriendo QA", "x@y.cl", ref)

    assert primero["success"] and segundo["success"], (primero, segundo)
    assert primero["payment_id"] == segundo["payment_id"]
