"""
Blindaje del checkout de la reserva.

1. Una reserva solo sale de `pendiente_pago` cuando la garantía Y el cobro del
   arriendo quedaron bien, por los montos que calculó el servidor. Antes,
   `/pagos/mercadopago/iniciar` aceptaba el monto que mandara el cliente para
   un `hold_reserva` de su reserva: una "garantía" de $1, sin cobro del
   arriendo, dejaba la reserva pagada.
2. Pagar dos veces la misma reserva (doble toque, reintento tras un timeout)
   no cobra dos veces, tampoco cuando el primer cobro quedó en revisión del banco.
"""
from datetime import datetime, timedelta

import pytest

from app.features.payments import checkout_service, estado_pagos
from app.models.entities import Auto, Pago, Reserva


def _fecha(dias):
    return (datetime.utcnow() + timedelta(days=dias)).strftime("%Y-%m-%dT10:00:00")


def _tarjeta(auth_as, usuario, token):
    r = auth_as(usuario).post("/api/v1/usuarios/me/tarjetas", json={"card_token": token, "payment_method_id": "visa"})
    assert r.status_code == 201, r.text
    return r.json()["tarjeta"]


@pytest.fixture
def reserva_por_pagar(usuario_factory, auth_as, db_session):
    """Reserva firmada, esperando pago: $60.000 de arriendo y $250.000 de garantía."""
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    auto = Auto(dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022, patente="BLND-01",
                tarifa_dia=20000, estado="activo", ubicacion_base="Los Ángeles", categoria="economico")
    db_session.add(auto)
    db_session.commit()
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    debito = _tarjeta(auth_as, cliente, "SIMULADO-DEBITO-4242")
    credito = _tarjeta(auth_as, cliente, "SIMULADO-CREDITO-1111")
    reserva = auth_as(cliente).post(
        "/api/v1/reservas",
        json={"auto_id": auto.id, "fecha_inicio": _fecha(10), "fecha_fin": _fecha(13),
              "lugar_entrega_acordado": "Plaza de Armas"},
    ).json()
    return {"cliente": cliente, "rid": reserva["id"], "debito": debito, "credito": credito}


def _reserva(db_session, rid):
    db_session.expire_all()
    return db_session.get(Reserva, rid)


# ------------------------------------------------------------ monto del cliente
def test_no_se_puede_abrir_una_garantia_por_otro_monto_que_el_de_la_reserva(reserva_por_pagar, auth_as, db_session):
    esc = reserva_por_pagar
    resp = auth_as(esc["cliente"]).post(
        "/api/v1/pagos/mercadopago/iniciar",
        json={"monto": 1, "tipo": "hold_reserva", "reserva_id": esc["rid"]},
    )

    assert resp.status_code == 400, resp.text
    assert db_session.query(Pago).filter(Pago.reserva_id == esc["rid"]).count() == 0


def test_una_garantia_de_un_peso_no_deja_la_reserva_pagada(reserva_por_pagar, auth_as, db_session):
    # Aunque el pago exista (datos antiguos, otro camino), la reserva no avanza.
    esc = reserva_por_pagar
    pago = Pago(reserva_id=esc["rid"], usuario_id=esc["cliente"].id, tipo="hold_reserva",
                monto=1, estado="pendiente", referencia_pago="1000000001")
    db_session.add(pago)
    db_session.commit()

    estado_pagos.aplicar_estado_pasarela(
        db_session, pago, {"success": True, "estado": "authorized", "payment_id": "1000000001", "monto": 1},
    )

    assert _reserva(db_session, esc["rid"]).estado == "pendiente_pago"


def test_la_garantia_sola_no_basta_falta_el_cobro_del_arriendo(reserva_por_pagar, db_session):
    esc = reserva_por_pagar
    reserva = _reserva(db_session, esc["rid"])
    pago = Pago(reserva_id=esc["rid"], usuario_id=esc["cliente"].id, tipo="hold_reserva",
                monto=reserva.monto_hold, estado="pendiente", referencia_pago="1000000001")
    db_session.add(pago)
    db_session.commit()

    estado_pagos.aplicar_estado_pasarela(
        db_session, pago,
        {"success": True, "estado": "authorized", "payment_id": "1000000001", "monto": reserva.monto_hold},
    )

    assert _reserva(db_session, esc["rid"]).estado == "pendiente_pago"


def test_con_garantia_y_cobro_completos_la_reserva_avanza(reserva_por_pagar, db_session):
    esc = reserva_por_pagar
    reserva = _reserva(db_session, esc["rid"])
    db_session.add(Pago(reserva_id=esc["rid"], usuario_id=esc["cliente"].id, tipo="hold_reserva",
                        monto=reserva.monto_hold, estado="retenido", referencia_pago="1000000001"))
    cobro = Pago(reserva_id=esc["rid"], usuario_id=esc["cliente"].id, tipo="cobro_arriendo",
                 monto=reserva.monto_cobro, estado="pendiente", referencia_pago="1000000002")
    db_session.add(cobro)
    db_session.commit()

    estado_pagos.aplicar_estado_pasarela(
        db_session, cobro,
        {"success": True, "estado": "approved", "payment_id": "1000000002", "monto": reserva.monto_cobro},
    )

    assert _reserva(db_session, esc["rid"]).estado == "pendiente"  # pagada, esperando al dueño


# ------------------------------------------------------------ pagar dos veces
def _pagar(auth_as, esc):
    return auth_as(esc["cliente"]).post(
        f"/api/v1/reservas/{esc['rid']}/pagar",
        json={"tarjeta_cobro_id": esc["debito"]["id"], "tarjeta_garantia_id": esc["credito"]["id"]},
    )


def test_reintentar_el_pago_con_el_cobro_en_revision_no_cobra_de_nuevo(reserva_por_pagar, auth_as, db_session, monkeypatch):
    movimientos = []

    def mover(tarjeta, usuario, monto, capturar, ref, **_):
        movimientos.append((monto, capturar))
        n = 1000000000 + len(movimientos)
        if capturar:  # el cobro del arriendo queda en revisión del banco
            return {"success": True, "autorizada": False, "estado": "in_process", "payment_id": str(n)}
        return {"success": True, "autorizada": True, "retenido": True, "estado": "authorized", "payment_id": str(n)}

    monkeypatch.setattr(checkout_service, "_mover", mover)

    primero = _pagar(auth_as, reserva_por_pagar)
    assert primero.status_code == 200, primero.text
    assert primero.json()["estado"] == "pendiente"

    segundo = _pagar(auth_as, reserva_por_pagar)
    assert segundo.status_code == 200, segundo.text
    assert segundo.json()["estado"] == "pendiente"

    assert len(movimientos) == 2, "el reintento volvió a retener la garantía y a cobrar el arriendo"
    pagos = db_session.query(Pago).filter(Pago.reserva_id == reserva_por_pagar["rid"]).all()
    assert sorted(p.tipo for p in pagos) == ["cobro_arriendo", "hold_reserva"]


def test_pagar_una_reserva_ya_pagada_no_cobra_de_nuevo(reserva_por_pagar, auth_as, db_session, monkeypatch):
    assert _pagar(auth_as, reserva_por_pagar).json()["estado"] == "esperando_dueno"
    monkeypatch.setattr(checkout_service, "_mover", lambda *a, **k: pytest.fail("se cobró dos veces"))

    segundo = _pagar(auth_as, reserva_por_pagar)

    assert segundo.status_code == 200
    assert segundo.json()["estado"] == "esperando_dueno"
