"""
Extender una reserva (POST /reservas/{id}/extender): solo el cliente de la
reserva puede hacerlo, y el monto del hold debe crecer con el costo real
de los días adicionales.
"""
from app.models.entities import Reserva, Usuario, Auto


def test_extender_reserva_solo_lo_puede_el_cliente(db_session, auth_as):
    reserva = db_session.query(Reserva).filter(Reserva.estado.in_(["confirmada", "en_curso"])).first()
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    intruso = db_session.query(Usuario).filter(Usuario.email == "manager.la@arriendatuauto.cl").first()

    resp_intruso = auth_as(intruso).post(f"/api/v1/reservas/{reserva.id}/extender", json={"dias_adicionales": 1})
    assert resp_intruso.status_code == 403


def test_extender_reserva_suma_dias_y_monto_hold_real(db_session, auth_as):
    reserva = db_session.query(Reserva).filter(Reserva.estado.in_(["confirmada", "en_curso"])).first()
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    auto = db_session.query(Auto).filter(Auto.id == reserva.auto_id).first()

    fecha_fin_original = reserva.fecha_fin
    hold_original = reserva.monto_hold

    resp = auth_as(cliente).post(f"/api/v1/reservas/{reserva.id}/extender", json={"dias_adicionales": 2})
    assert resp.status_code == 200
    data = resp.json()

    assert data["monto_hold"] == hold_original + (auto.tarifa_dia * 2)

    db_session.refresh(reserva)
    assert (reserva.fecha_fin - fecha_fin_original).days == 2
