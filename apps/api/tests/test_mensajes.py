"""
Mensajería por reserva: solo el cliente de la reserva o el dueño del auto
pueden leer y escribir mensajes de esa conversación.
"""
from app.models.entities import Reserva, Usuario, Auto


def test_mensajes_solo_los_ven_las_partes_de_la_reserva(db_session, auth_as):
    reserva = db_session.query(Reserva).first()
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    auto = db_session.query(Auto).filter(Auto.id == reserva.auto_id).first()
    dueno = db_session.query(Usuario).filter(Usuario.id == auto.dueno_id).first()
    intruso = db_session.query(Usuario).filter(Usuario.email == "manager.la@arriendatuauto.cl").first()

    resp_intruso = auth_as(intruso).get(f"/api/v1/reservas/{reserva.id}/mensajes")
    assert resp_intruso.status_code == 403

    resp_cliente = auth_as(cliente).get(f"/api/v1/reservas/{reserva.id}/mensajes")
    assert resp_cliente.status_code == 200

    resp_dueno = auth_as(dueno).get(f"/api/v1/reservas/{reserva.id}/mensajes")
    assert resp_dueno.status_code == 200


def test_enviar_mensaje_solo_las_partes_de_la_reserva_y_se_ve_en_ambos_lados(db_session, auth_as):
    reserva = db_session.query(Reserva).first()
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    auto = db_session.query(Auto).filter(Auto.id == reserva.auto_id).first()
    dueno = db_session.query(Usuario).filter(Usuario.id == auto.dueno_id).first()
    intruso = db_session.query(Usuario).filter(Usuario.email == "manager.la@arriendatuauto.cl").first()

    resp_intruso = auth_as(intruso).post(
        f"/api/v1/reservas/{reserva.id}/mensajes", json={"texto": "Hola"}
    )
    assert resp_intruso.status_code == 403

    resp_cliente = auth_as(cliente).post(
        f"/api/v1/reservas/{reserva.id}/mensajes", json={"texto": "Voy en camino"}
    )
    assert resp_cliente.status_code == 200
    assert resp_cliente.json()["autor_id"] == cliente.id

    resp_lista_dueno = auth_as(dueno).get(f"/api/v1/reservas/{reserva.id}/mensajes")
    assert resp_lista_dueno.status_code == 200
    textos = [m["texto"] for m in resp_lista_dueno.json()]
    assert "Voy en camino" in textos
