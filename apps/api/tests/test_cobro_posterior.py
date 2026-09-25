"""
Cobro posterior (peaje / TAG / multa) que el dueño le carga a la tarjeta de
crédito del arrendatario: es el único camino que hoy mueve plata después de
la devolución, así que cada cobro tiene que ser un cobro real y distinto.

Hallazgos de la revisión de QA (2026-09-20):
  · La referencia que se manda a Mercado Pago era `POST-<reserva>-<TIPO>`: igual
    para todo cobro del mismo tipo en la misma reserva. MP usa esa referencia
    como clave de idempotencia, así que un SEGUNDO peaje devolvía el pago del
    primero sin cobrar nada nuevo, y aquí igual quedaba registrado (y avisado
    al arrendatario) como cobrado.
  · `tipo` era texto libre: se guardaba cualquier cosa como `cobro_posterior_<x>`.
"""
import pytest

from app.features.payments import checkout_service
from app.models.entities import Pago, Reserva, Usuario


@pytest.fixture
def escenario(db_session, auth_as):
    reserva = db_session.query(Reserva).first()
    reserva.estado = "finalizada"
    # Una reserva finalizada normal ya devolvió su garantía (los datos de prueba la traen "capturada"
    # por el monto completo, lo que agotaría el tope del cobro posterior).
    for hold in db_session.query(Pago).filter(Pago.reserva_id == reserva.id, Pago.tipo == "hold_reserva"):
        hold.estado = "liberado"
    db_session.commit()
    cliente = db_session.get(Usuario, reserva.cliente_id)
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()
    r = auth_as(cliente).post(
        "/api/v1/usuarios/me/tarjetas", json={"card_token": "SIMULADO-CREDITO-1111", "payment_method_id": "visa"}
    )
    assert r.status_code == 201, r.text
    return {"reserva": reserva, "dueno": dueno}


def _cobrar(auth_as, esc, tipo="peaje", monto=3200):
    return auth_as(esc["dueno"]).post(
        f"/api/v1/reservas/{esc['reserva'].id}/cobro-posterior",
        json={"tipo": tipo, "monto": monto, "descripcion": "Peaje Ruta 5 Sur",
              "comprobante_url": "https://ej.com/boleta.pdf"},
    )


def test_un_cobro_posterior_valido_funciona(escenario, auth_as, db_session):
    resp = _cobrar(auth_as, escenario)

    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "capturado"


def test_dos_cobros_del_mismo_tipo_no_comparten_referencia_de_idempotencia(escenario, auth_as, monkeypatch):
    referencias = []

    def espia(tarjeta, cliente, monto, capturar, ref, **_):
        referencias.append(ref)
        return {"success": True, "autorizada": True, "capturado": True, "estado": "approved",
                "payment_id": f"SIMULADO-{len(referencias)}"}

    monkeypatch.setattr(checkout_service, "_mover", espia)

    assert _cobrar(auth_as, escenario, monto=3200).status_code == 200
    assert _cobrar(auth_as, escenario, monto=4100).status_code == 200

    assert len(referencias) == 2
    assert referencias[0] != referencias[1], (
        "los dos peajes se mandan con la misma clave de idempotencia: MP cobraría solo el primero"
    )


@pytest.mark.parametrize("tipo", ["liquidacion_dueno", "lo_que_sea", "PEAJE_EXTRA"])
def test_el_tipo_de_cobro_posterior_es_una_lista_cerrada(escenario, auth_as, db_session, tipo):
    resp = _cobrar(auth_as, escenario, tipo=tipo)

    assert resp.status_code == 422, resp.text
    assert db_session.query(Pago).filter(Pago.tipo.like("cobro_posterior_%")).count() == 0
