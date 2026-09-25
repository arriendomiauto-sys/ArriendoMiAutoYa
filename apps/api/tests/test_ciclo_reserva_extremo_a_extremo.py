"""
Ciclo de vida de una reserva por los endpoints REALES (sin armar filas a mano):
alta de tarjetas -> reservar -> firmar -> pagar -> cancelar.

Complementa `test_cancelacion_reserva.py`, que fabrica los `Pago` directamente:
acá el estado del dinero sale del checkout de verdad, así que también prueba que
la cancelación reconoce lo que el checkout guarda (p. ej. los ids simulados).

Corre en modo simulado; cualquier salida a la pasarela real revienta el test.
"""


def _fecha(dias):
    """Fecha relativa a hoy: las reservas en el pasado se rechazan, las fijas envejecen."""
    from datetime import datetime, timedelta
    return (datetime.utcnow() + timedelta(days=dias)).strftime("%Y-%m-%dT10:00:00")

from datetime import datetime, timedelta

import pytest

from app.features.payments.mercadopago_service import MercadoPagoService
from app.models.entities import Auto, Pago, Reserva


@pytest.fixture(autouse=True)
def sin_pasarela_real(monkeypatch):
    def prohibido(*a, **k):
        raise AssertionError("se intentó llamar a Mercado Pago de verdad en un test simulado")

    monkeypatch.setattr(MercadoPagoService, "_pedir", classmethod(lambda cls, *a, **k: prohibido()))


def _auto(db_session, dueno, patente="KLPW-88", tarifa_dia=20000):
    auto = Auto(
        dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022, patente=patente,
        tarifa_dia=tarifa_dia, estado="activo", ubicacion_base="Los Ángeles", categoria="economico",
    )
    db_session.add(auto)
    db_session.commit()
    return auto


def _tarjeta(auth_as, usuario, token):
    r = auth_as(usuario).post(
        "/api/v1/usuarios/me/tarjetas", json={"card_token": token, "payment_method_id": "visa"}
    )
    assert r.status_code == 201, r.text
    return r.json()["tarjeta"]


def _reservar(auth_as, cliente, auto):
    return auth_as(cliente).post(
        "/api/v1/reservas",
        json={
            "auto_id": auto.id,
            "fecha_inicio": _fecha(60),
            "fecha_fin": _fecha(63),
            "lugar_entrega_acordado": "Plaza de Armas",
        },
    )


@pytest.fixture
def escenario(usuario_factory, auth_as, db_session):
    """Reserva pagada: arrendatario con débito + crédito, auto del dueño, contrato firmado."""
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    auto = _auto(db_session, dueno)
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    debito = _tarjeta(auth_as, cliente, "SIMULADO-DEBITO-4242")
    credito = _tarjeta(auth_as, cliente, "SIMULADO-CREDITO-1111")

    reserva = _reservar(auth_as, cliente, auto).json()
    # El contrato ya no se firma antes de pagar: se firma en la entrega.
    pago = auth_as(cliente).post(
        f"/api/v1/reservas/{reserva['id']}/pagar",
        json={"tarjeta_cobro_id": debito["id"], "tarjeta_garantia_id": credito["id"]},
    )
    assert pago.status_code == 200, pago.text
    return {"dueno": dueno, "cliente": cliente, "auto": auto, "reserva_id": reserva["id"]}


def _estados_de_pago(db_session, reserva_id):
    db_session.expire_all()
    return {p.tipo: p.estado for p in db_session.query(Pago).filter(Pago.reserva_id == reserva_id)}


def _cancelar(auth_as, usuario, reserva_id):
    return auth_as(usuario).patch(f"/api/v1/reservas/{reserva_id}/estado", params={"nuevo_estado": "cancelada"})


def test_pagada_y_cancelada_con_anticipacion_devuelve_todo(escenario, auth_as, db_session):
    assert _estados_de_pago(db_session, escenario["reserva_id"]) == {
        "cobro_arriendo": "capturado", "hold_reserva": "retenido",
    }

    resp = _cancelar(auth_as, escenario["cliente"], escenario["reserva_id"])

    assert resp.status_code == 200, resp.text
    assert _estados_de_pago(db_session, escenario["reserva_id"]) == {
        "cobro_arriendo": "reembolsado", "hold_reserva": "liberado",
    }


def test_pagada_y_cancelada_por_el_dueno_devuelve_todo_aunque_falte_poco(escenario, auth_as, db_session):
    reserva = db_session.get(Reserva, escenario["reserva_id"])
    reserva.fecha_inicio = datetime.utcnow() + timedelta(hours=3)
    db_session.commit()

    resp = _cancelar(auth_as, escenario["dueno"], escenario["reserva_id"])

    assert resp.status_code == 200, resp.text
    assert _estados_de_pago(db_session, escenario["reserva_id"]) == {
        "cobro_arriendo": "reembolsado", "hold_reserva": "liberado",
    }


def test_cancelada_tarde_por_el_arrendatario_libera_la_garantia_y_retiene_el_arriendo(escenario, auth_as, db_session):
    reserva = db_session.get(Reserva, escenario["reserva_id"])
    reserva.estado = "confirmada"
    reserva.fecha_inicio = datetime.utcnow() + timedelta(hours=3)
    db_session.commit()

    resp = _cancelar(auth_as, escenario["cliente"], escenario["reserva_id"])

    assert resp.status_code == 200, resp.text
    assert _estados_de_pago(db_session, escenario["reserva_id"]) == {
        "cobro_arriendo": "capturado", "hold_reserva": "liberado",
    }


def test_un_tercero_no_puede_cancelar_la_reserva_de_otro(escenario, usuario_factory, auth_as, db_session):
    intruso = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")

    resp = _cancelar(auth_as, intruso, escenario["reserva_id"])

    assert resp.status_code == 403
    assert db_session.get(Reserva, escenario["reserva_id"]).estado == "pendiente"  # esperando al dueño
    assert _estados_de_pago(db_session, escenario["reserva_id"])["hold_reserva"] == "retenido"


def test_ciclo_completo_el_dueno_confirma_y_luego_el_arrendatario_cancela(escenario, auth_as, db_session):
    """pagar -> pendiente -> el dueño confirma -> confirmada -> cancelar con anticipación."""
    reserva_id = escenario["reserva_id"]
    assert db_session.get(Reserva, reserva_id).estado == "pendiente"

    confirmada = auth_as(escenario["dueno"]).patch(
        f"/api/v1/reservas/{reserva_id}/estado", params={"nuevo_estado": "confirmada"}
    )
    assert confirmada.status_code == 200, confirmada.text
    assert confirmada.json()["estado"] == "confirmada"

    assert _cancelar(auth_as, escenario["cliente"], reserva_id).status_code == 200
    assert _estados_de_pago(db_session, reserva_id) == {"cobro_arriendo": "reembolsado", "hold_reserva": "liberado"}


def test_con_la_reserva_activa_nadie_mas_reserva_esas_fechas_y_al_cancelar_se_liberan(
    escenario, usuario_factory, auth_as
):
    otro = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")

    ocupado = _reservar(auth_as, otro, escenario["auto"])
    assert ocupado.status_code == 400, ocupado.text

    assert _cancelar(auth_as, escenario["cliente"], escenario["reserva_id"]).status_code == 200

    libre = _reservar(auth_as, otro, escenario["auto"])
    assert libre.status_code in (200, 201), libre.text
