"""
Ownership en el flujo de entrega/QR: generar el código es solo del
cliente de la reserva; validar el código, confirmar identidad y
registrar el checklist es solo del dueño del auto reservado.
"""
from app.models.entities import Reserva, Usuario, Auto


def test_generar_codigo_solo_lo_puede_el_cliente_de_la_reserva(db_session, auth_as):
    reserva = db_session.query(Reserva).first()
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    intruso = db_session.query(Usuario).filter(Usuario.email == "manager.la@arriendatuauto.cl").first()

    resp_intruso = auth_as(intruso).post(f"/api/v1/reservas/{reserva.id}/generar-codigo")
    assert resp_intruso.status_code == 403

    resp_cliente = auth_as(cliente).post(f"/api/v1/reservas/{reserva.id}/generar-codigo")
    assert resp_cliente.status_code == 200


def test_validar_codigo_solo_lo_puede_el_dueno_del_auto(db_session, auth_as):
    reserva = db_session.query(Reserva).first()
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    auto = db_session.query(Auto).filter(Auto.id == reserva.auto_id).first()
    dueno = db_session.query(Usuario).filter(Usuario.id == auto.dueno_id).first()
    intruso = db_session.query(Usuario).filter(Usuario.email == "manager.la@arriendatuauto.cl").first()

    qr_hash = auth_as(cliente).post(f"/api/v1/reservas/{reserva.id}/generar-codigo").json()["codigo_qr_hash"]

    resp_intruso = auth_as(intruso).post("/api/v1/entrega/validar-codigo", json={"codigo_qr_hash": qr_hash})
    assert resp_intruso.status_code == 403

    resp_dueno = auth_as(dueno).post("/api/v1/entrega/validar-codigo", json={"codigo_qr_hash": qr_hash})
    assert resp_dueno.status_code == 200


def test_confirmar_verificacion_solo_lo_puede_el_dueno_del_auto(db_session, auth_as):
    reserva = db_session.query(Reserva).first()
    auto = db_session.query(Auto).filter(Auto.id == reserva.auto_id).first()
    dueno = db_session.query(Usuario).filter(Usuario.id == auto.dueno_id).first()
    intruso = db_session.query(Usuario).filter(Usuario.email == "manager.la@arriendatuauto.cl").first()

    resp_intruso = auth_as(intruso).post(
        f"/api/v1/entrega/{reserva.id}/confirmar-verificacion",
        json={"resultado": "confirmada", "tipo": "entrega"},
    )
    assert resp_intruso.status_code == 403

    resp_dueno = auth_as(dueno).post(
        f"/api/v1/entrega/{reserva.id}/confirmar-verificacion",
        json={"resultado": "confirmada", "tipo": "entrega"},
    )
    assert resp_dueno.status_code == 200


def test_registrar_checklist_solo_lo_puede_el_dueno_del_auto(db_session, auth_as):
    reserva = db_session.query(Reserva).first()
    auto = db_session.query(Auto).filter(Auto.id == reserva.auto_id).first()
    dueno = db_session.query(Usuario).filter(Usuario.id == auto.dueno_id).first()
    intruso = db_session.query(Usuario).filter(Usuario.email == "manager.la@arriendatuauto.cl").first()

    payload = {
        "tipo": "antes",
        "fotos": ["https://ejemplo.com/foto1.jpg"],
        "kilometraje": 1000,
        "nivel_combustible": "lleno",
        "firma_svg": "M1 1L2 2",
    }

    resp_intruso = auth_as(intruso).post(f"/api/v1/entrega/{reserva.id}/checklist", json=payload)
    assert resp_intruso.status_code == 403

    resp_dueno = auth_as(dueno).post(f"/api/v1/entrega/{reserva.id}/checklist", json=payload)
    assert resp_dueno.status_code == 200
