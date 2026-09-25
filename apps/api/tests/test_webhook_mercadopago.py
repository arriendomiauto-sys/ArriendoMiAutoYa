"""
Webhook de Mercado Pago: la vía que confirma los pagos aunque el arrendatario
cierre la app antes de volver del checkout.

  · Sin firma válida no se toca nada (401): si no, cualquiera que conozca la
    URL "aprobaría" pagos.
  · El aviso solo dice qué pago mirar: el estado sale de la API de Mercado Pago.
  · Un aviso repetido no cambia nada y un aviso tardío no reabre un pago cerrado.
  · Lo que no se puede procesar ahora (API caída) responde error para que
    Mercado Pago lo reintente; lo que no es nuestro responde 200 para que no.
"""
import hashlib
import hmac

import pytest

from app.core.config import settings
from app.features.payments.mercadopago_service import MercadoPagoService
from app.models.entities import Pago, Usuario

URL = "/api/v1/pagos/mercadopago/webhook"
SECRETO = "secreto-de-prueba"
PAYMENT_ID = "1234567890"


@pytest.fixture(autouse=True)
def secreto(monkeypatch):
    monkeypatch.setattr(settings, "MERCADOPAGO_WEBHOOK_SECRET", SECRETO)


@pytest.fixture
def pasarela(monkeypatch):
    """Estado que devuelve la API de Mercado Pago para el pago consultado."""
    estado = {"respuesta": None, "consultas": []}

    def obtener_pago(cls, payment_id):
        estado["consultas"].append(payment_id)
        return estado["respuesta"]

    monkeypatch.setattr(MercadoPagoService, "obtener_pago", classmethod(obtener_pago))
    return estado


def _firma(data_id, request_id="req-1", ts="1727300000"):
    manifiesto = f"id:{data_id.lower()};request-id:{request_id};ts:{ts};"
    v1 = hmac.new(SECRETO.encode(), manifiesto.encode(), hashlib.sha256).hexdigest()
    return {"x-signature": f"ts={ts},v1={v1}", "x-request-id": request_id}


def _aviso(client, data_id=PAYMENT_ID, headers=None):
    return client.post(
        URL, json={"type": "payment", "data": {"id": data_id}},
        headers=_firma(data_id) if headers is None else headers,
    )


def _respuesta_mp(pago, estado, monto=None):
    return {
        "success": True, "estado": estado, "payment_id": PAYMENT_ID,
        "autorizada": estado in ("approved", "authorized"),
        "monto": pago.monto if monto is None else monto, "referencia_externa": pago.id,
    }


@pytest.fixture
def pago(db_session):
    usuario = db_session.query(Usuario).first()
    p = Pago(usuario_id=usuario.id, tipo="hold_enrolamiento", monto=50000, estado="pendiente",
             referencia_pago=PAYMENT_ID)
    db_session.add(p)
    db_session.commit()
    return p


def _estado(db_session, pago):
    db_session.expire_all()
    return db_session.get(Pago, pago.id).estado


# ------------------------------------------------------------------ firma
def test_sin_firma_se_rechaza_y_no_se_consulta_nada(client, pago, pasarela, db_session):
    resp = _aviso(client, headers={})

    assert resp.status_code == 401
    assert pasarela["consultas"] == []
    assert _estado(db_session, pago) == "pendiente"


def test_firma_de_otro_pago_se_rechaza(client, pago, pasarela):
    # Una firma válida para otro id no sirve para este (el id va dentro del HMAC).
    resp = _aviso(client, data_id=PAYMENT_ID, headers=_firma("999"))

    assert resp.status_code == 401
    assert pasarela["consultas"] == []


def test_sin_secreto_configurado_se_rechaza_todo(client, pago, pasarela, monkeypatch):
    monkeypatch.setattr(settings, "MERCADOPAGO_WEBHOOK_SECRET", "")

    assert _aviso(client).status_code == 401


# ------------------------------------------------------------------ cuerpo
def test_cuerpo_que_no_es_json_responde_400(client):
    resp = client.post(URL, content=b"no-es-json", headers={"content-type": "application/json"})

    assert resp.status_code == 400


def test_aviso_que_no_es_de_un_pago_se_ignora_con_200(client, pasarela):
    resp = client.post(URL, json={"type": "merchant_order", "data": {"id": "1"}})

    assert resp.status_code == 200
    assert pasarela["consultas"] == []


# ------------------------------------------------------------------ estado
def test_pago_aprobado_se_aplica(client, pago, pasarela, db_session):
    pasarela["respuesta"] = _respuesta_mp(pago, "approved")

    resp = _aviso(client)

    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "capturado"
    assert _estado(db_session, pago) == "capturado"
    assert pasarela["consultas"] == [PAYMENT_ID]


def test_aviso_repetido_no_cambia_nada(client, pago, pasarela, db_session):
    pasarela["respuesta"] = _respuesta_mp(pago, "approved")

    assert _aviso(client).status_code == 200
    assert _aviso(client).status_code == 200

    assert _estado(db_session, pago) == "capturado"


def test_aviso_tardio_no_reabre_un_pago_ya_reembolsado(client, pago, pasarela, db_session):
    pago.estado = "reembolsado"
    db_session.commit()
    pasarela["respuesta"] = _respuesta_mp(pago, "approved")

    assert _aviso(client).status_code == 200

    assert _estado(db_session, pago) == "reembolsado"


def test_pago_rechazado_queda_fallido(client, pago, pasarela, db_session):
    pasarela["respuesta"] = _respuesta_mp(pago, "rejected")

    assert _aviso(client).status_code == 200

    assert _estado(db_session, pago) == "fallido"


def test_si_la_api_de_mercado_pago_falla_se_pide_reintento(client, pago, pasarela, db_session):
    pasarela["respuesta"] = {"success": False, "error": "timeout"}

    resp = _aviso(client)

    assert resp.status_code == 502  # Mercado Pago reintenta lo que no recibe 2xx
    assert _estado(db_session, pago) == "pendiente"


def test_pago_que_no_es_nuestro_se_ignora_con_200(client, pasarela):
    pasarela["respuesta"] = {"success": True, "estado": "approved", "payment_id": "555",
                             "monto": 1000, "referencia_externa": "otra-cosa"}

    resp = _aviso(client, data_id="555")

    assert resp.status_code == 200
    assert resp.json()["ignorado"] == "pago desconocido"
