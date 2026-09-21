"""
Extender una reserva (POST /reservas/{id}/extender): solo el cliente de la
reserva puede hacerlo, y los días adicionales se cobran aparte a su tarjeta
(la garantía es fija por categoría: no crece). El detalle del cobro está en
test_cobro_de_cargos.py.
"""
from app.models.entities import Reserva, Usuario, Auto, Pago, Tarjeta


def test_extender_reserva_solo_lo_puede_el_cliente(db_session, auth_as):
    reserva = db_session.query(Reserva).filter(Reserva.estado.in_(["confirmada", "en_curso"])).first()
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    intruso = db_session.query(Usuario).filter(Usuario.email == "manager.la@arriendatuauto.cl").first()

    resp_intruso = auth_as(intruso).post(f"/api/v1/reservas/{reserva.id}/extender", json={"dias_adicionales": 1})
    assert resp_intruso.status_code == 403


def test_extender_reserva_suma_dias_y_los_cobra_sin_tocar_la_garantia(db_session, auth_as):
    reserva = db_session.query(Reserva).filter(Reserva.estado.in_(["confirmada", "en_curso"])).first()
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    auto = db_session.query(Auto).filter(Auto.id == reserva.auto_id).first()
    tarjeta = Tarjeta(usuario_id=cliente.id, tipo="debito", estado="validada", ultimos4="4242", marca="visa")
    db_session.add(tarjeta)
    db_session.flush()
    reserva.tarjeta_cobro_id = tarjeta.id
    db_session.commit()

    fecha_fin_original = reserva.fecha_fin
    hold_original = reserva.monto_hold

    resp = auth_as(cliente).post(f"/api/v1/reservas/{reserva.id}/extender", json={"dias_adicionales": 2})
    assert resp.status_code == 200
    data = resp.json()

    assert data["monto_hold"] == hold_original
    cobro = db_session.query(Pago).filter(Pago.reserva_id == reserva.id, Pago.tipo == "cobro_arriendo").one()
    assert cobro.monto == auto.tarifa_dia * 2
    assert cobro.estado == "capturado"

    db_session.refresh(reserva)
    assert (reserva.fecha_fin - fecha_fin_original).days == 2
