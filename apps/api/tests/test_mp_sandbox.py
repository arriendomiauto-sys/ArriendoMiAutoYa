"""
Pruebas contra el SANDBOX REAL de Mercado Pago (no usan dobles).

Solo corren con `RUN_MP_SANDBOX=1`:

    RUN_MP_SANDBOX=1 python -m pytest tests/test_mp_sandbox.py -v

Usan la BD SQLite en memoria de siempre (nunca Supabase) y llaman a la API de
MP con `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_PUBLIC_KEY` del entorno.

Guardas de seguridad (se evalúan una sola vez, antes de mover "plata"):
  1. `sandbox`: el access token debe pertenecer a un usuario con la etiqueta
     `test_user`. Si no, la suite se NIEGA a correr: podría crear cobros reales.
  2. `sandbox_cobros`: antes de los tests que cobran o guardan tarjetas se hace
     un hold de sonda de $1.000 (y se suelta). Si Mercado Pago lo rechaza por
     credenciales, esos tests fallan con la causa en vez de errores crípticos.
     El resto (preferencias, conciliación, errores) corre igual.

Tarjetas de prueba de Mercado Pago Chile (MLC). El TITULAR de la tarjeta decide
el resultado: APRO aprueba, FUND = fondos insuficientes, SECU = código de
seguridad inválido.
"""
import os
import uuid

import httpx
import pytest

from app.core.config import settings
from app.features.payments import card_vault
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


@pytest.fixture(autouse=True)
def pasarela_real(monkeypatch):
    # El `.env` de desarrollo trae PAGOS_SIMULADOS=True: acá se prueba la pasarela de verdad.
    monkeypatch.setattr(settings, "PAGOS_SIMULADOS", False)


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
    return True


@pytest.fixture(scope="module")
def sandbox_cobros(sandbox):
    # Guarda 2: la cuenta puede cobrar con tarjeta (Checkout API).
    sonda = MP.crear_pago_con_tarjeta(_tokenizar(), 1000, "sonda", "x@y.cl", _ref("SONDA"), capturar=False)
    if sonda.get("payment_id"):
        MP.liberar_hold(sonda["payment_id"])
    if not sonda.get("success") and "live credentials" in str(sonda.get("error")):
        pytest.fail(
            "Mercado Pago rechaza los cobros con tarjeta de esta cuenta (401 'Unauthorized use of live "
            "credentials'). El access token es de un vendedor de prueba y sí puede crear preferencias y "
            "leer pagos, pero cobrar (/v1/payments) y guardar tarjetas (/v1/customers) están bloqueados, "
            "también con tokens generados con el propio access token: no es la public key. Revisa, entrando al panel de Mercado Pago con el VENDEDOR de prueba, "
            "que la aplicación tenga el producto 'Checkout API / Pagos online' y las credenciales de "
            "producción ACTIVADAS (industria y sitio web).",
            pytrace=False,
        )
    assert sonda.get("success"), f"la sonda de cobro falló: {sonda}"
    return True


# ===========================================================================
# Sin cobros: corren con cualquier cuenta de prueba
# ===========================================================================
def test_la_preferencia_de_checkout_pro_se_crea(sandbox):
    res = MP.crear_preferencia(
        referencia_externa=_ref("PREF"), titulo="Garantía QA", monto=250000,
        return_url="https://arriendomiautoya.cl/pago/retorno",
    )

    assert res["success"], res
    assert res["preferencia_id"]
    # En modo prueba se usa la URL del sandbox, no la productiva.
    assert res["url"] and res["url"].startswith("https://")


def test_la_busqueda_de_la_conciliacion_responde(sandbox):
    res = MP.buscar_pagos_actualizados("NOW-3HOURS", "NOW")

    assert res["success"], res
    assert isinstance(res["pagos"], list)
    assert isinstance(res["total"], int)


def test_consultar_un_pago_que_no_existe_es_un_error_controlado(sandbox):
    res = MP.obtener_pago("1")

    assert res["success"] is False
    assert res.get("status_code") == 404


def test_la_boveda_guarda_la_tarjeta_y_genera_tokens_para_cobrar(sandbox_cobros):
    tarjeta = card_vault.registrar_tarjeta(
        email="qa@arriendomiautoya.cl", nombre="APRO", card_token=_tokenizar(), payment_method_id="visa",
    )
    try:
        assert tarjeta["mp_customer_id"] and tarjeta["mp_card_id"]
        assert tarjeta["ultimos4"] == VISA_CREDITO[-4:]
        assert tarjeta["tipo"] == "credito"

        # Con la tarjeta guardada se genera un token de un solo uso para cada movimiento.
        token = card_vault.token_para_movimiento(tarjeta["mp_customer_id"], tarjeta["mp_card_id"])
        assert token and not token.startswith("SIMTOK-")
    finally:
        card_vault.eliminar_tarjeta(tarjeta["mp_customer_id"], tarjeta["mp_card_id"])


def test_la_boveda_rechaza_un_token_inventado(sandbox):
    with pytest.raises(card_vault.VaultError):
        card_vault.registrar_tarjeta(
            email="qa@arriendomiautoya.cl", nombre="APRO", card_token="token-que-no-existe",
            payment_method_id="visa",
        )


# ===========================================================================
# Cobros con tarjeta (Checkout API)
# ===========================================================================
def test_el_hold_se_autoriza_y_se_libera(sandbox_cobros):
    res = MP.crear_pago_con_tarjeta(_tokenizar(), 250000, "Garantía QA", "x@y.cl", _ref("HOLD"), capturar=False)
    assert res["success"], res
    assert res["estado"] == "authorized" and res["retenido"] is True

    liberado = MP.liberar_hold(res["payment_id"])
    assert liberado["success"], liberado
    assert MP.obtener_pago(res["payment_id"])["estado"] == "cancelled"


def test_el_cobro_se_aprueba_y_se_reembolsa(sandbox_cobros):
    res = MP.crear_pago_con_tarjeta(_tokenizar(MC_CREDITO), 60000, "Arriendo QA", "x@y.cl", _ref("COBRO"), capturar=True)
    assert res["success"], res
    assert res["estado"] == "approved" and res["capturado"] is True

    reembolso = MP.reembolsar(res["payment_id"])
    assert reembolso["success"], reembolso
    assert MP.obtener_pago(res["payment_id"])["estado"] == "refunded"


def test_fondos_insuficientes_se_rechaza(sandbox_cobros):
    res = MP.crear_pago_con_tarjeta(_tokenizar(titular="FUND"), 60000, "Arriendo QA", "x@y.cl", _ref("FUND"))
    assert res["success"], res
    assert res["autorizada"] is False
    assert res["detalle_estado"] == "cc_rejected_insufficient_amount"


def test_codigo_de_seguridad_invalido_se_rechaza(sandbox_cobros):
    res = MP.crear_pago_con_tarjeta(_tokenizar(titular="SECU"), 60000, "Arriendo QA", "x@y.cl", _ref("SECU"))
    assert res["success"], res
    assert res["autorizada"] is False
    assert res["detalle_estado"] == "cc_rejected_bad_filled_security_code"


def test_se_puede_capturar_solo_una_parte_de_la_garantia(sandbox_cobros):
    """Es como se cobran los cargos de la devolución sin cobrar toda la garantía."""
    hold = MP.crear_pago_con_tarjeta(_tokenizar(), 250000, "Garantía QA", "x@y.cl", _ref("PARC"), capturar=False)
    assert hold["success"] and hold["retenido"], hold

    capturado = MP.capturar_pago(hold["payment_id"], 30000)
    assert capturado["success"], capturado
    assert capturado["estado"] == "approved"
    assert capturado["monto"] == 30000


def test_capturar_dos_veces_la_misma_garantia_no_falla(sandbox_cobros):
    """El reintento tras un timeout (la primera captura sí llegó) se da por hecho."""
    hold = MP.crear_pago_con_tarjeta(_tokenizar(), 250000, "Garantía QA", "x@y.cl", _ref("CAP2"), capturar=False)
    assert hold["success"] and hold["retenido"], hold

    primera = MP.capturar_pago(hold["payment_id"], 30000)
    segunda = MP.capturar_pago(hold["payment_id"], 30000)

    assert primera["success"] and segunda["success"], (primera, segunda)
    assert segunda["estado"] == "approved"
    MP.reembolsar(hold["payment_id"])


def test_liberar_dos_veces_la_misma_garantia_no_falla(sandbox_cobros):
    hold = MP.crear_pago_con_tarjeta(_tokenizar(), 250000, "Garantía QA", "x@y.cl", _ref("LIB2"), capturar=False)
    assert hold["success"] and hold["retenido"], hold

    assert MP.liberar_hold(hold["payment_id"])["success"]
    segunda = MP.liberar_hold(hold["payment_id"])

    assert segunda["success"], segunda
    assert segunda["estado"] == "cancelled"


def test_reintentar_con_la_misma_referencia_no_cobra_dos_veces(sandbox_cobros):
    ref = _ref("IDEM")
    token = _tokenizar()
    primero = MP.crear_pago_con_tarjeta(token, 60000, "Arriendo QA", "x@y.cl", ref)
    segundo = MP.crear_pago_con_tarjeta(token, 60000, "Arriendo QA", "x@y.cl", ref)

    assert primero["success"] and segundo["success"], (primero, segundo)
    assert primero["payment_id"] == segundo["payment_id"]
    MP.reembolsar(primero["payment_id"])
