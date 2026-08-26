"""
Pruebas de restricción por rol en endpoints internos: admin.py (panel
financiero, métricas, documentos pendientes), soporte.py (tickets) y
disputas.py. Todos exigían cero autenticación antes de esta sesión.
"""
from app.models.entities import Disputa, TicketSoporte, Reserva


def test_panel_financiero_sin_auth_da_401(client):
    assert client.get("/api/v1/admin/panel-financiero").status_code == 401


def test_panel_financiero_cliente_da_403(usuario_factory, auth_as):
    cliente = usuario_factory(roles_activos=["cliente"])
    resp = auth_as(cliente).get("/api/v1/admin/panel-financiero")
    assert resp.status_code == 403


def test_panel_financiero_manager_da_403_solo_admin(usuario_factory, auth_as):
    manager = usuario_factory(roles_activos=["manager"])
    resp = auth_as(manager).get("/api/v1/admin/panel-financiero")
    assert resp.status_code == 403


def test_panel_financiero_admin_da_200(usuario_factory, auth_as):
    admin = usuario_factory(roles_activos=["admin"])
    resp = auth_as(admin).get("/api/v1/admin/panel-financiero")
    assert resp.status_code == 200
    assert "total_holds_capturados_clp" in resp.json()


def test_metricas_globales_requiere_admin(usuario_factory, auth_as):
    cliente = usuario_factory(roles_activos=["cliente"])
    admin = usuario_factory(roles_activos=["admin"])
    assert auth_as(cliente).get("/api/v1/admin/metricas-globales").status_code == 403
    assert auth_as(admin).get("/api/v1/admin/metricas-globales").status_code == 200


def test_documentos_pendientes_requiere_admin_o_manager(usuario_factory, auth_as):
    cliente = usuario_factory(roles_activos=["cliente"])
    manager = usuario_factory(roles_activos=["manager"])
    admin = usuario_factory(roles_activos=["admin"])

    assert auth_as(cliente).get("/api/v1/admin/documentos/pendientes").status_code == 403
    assert auth_as(manager).get("/api/v1/admin/documentos/pendientes").status_code == 200
    assert auth_as(admin).get("/api/v1/admin/documentos/pendientes").status_code == 200


def test_configuracion_plataforma_sigue_de_lectura_publica(client):
    # Decisión deliberada: son parámetros de negocio (comisión, UF, etc.),
    # no datos personales, así que se dejan de lectura pública.
    resp = client.get("/api/v1/admin/configuracion")
    assert resp.status_code == 200


def test_actualizar_configuracion_requiere_admin(usuario_factory, auth_as):
    cliente = usuario_factory(roles_activos=["cliente"])
    resp = auth_as(cliente).put("/api/v1/admin/configuracion", json={"comision_plataforma_pct": 25})
    assert resp.status_code == 403


# --------------------------- soporte.py ---------------------------

def test_listar_tickets_requiere_admin_o_manager(usuario_factory, auth_as):
    cliente = usuario_factory(roles_activos=["cliente"])
    manager = usuario_factory(roles_activos=["manager"])

    assert auth_as(cliente).get("/api/v1/soporte/tickets").status_code == 403
    assert auth_as(manager).get("/api/v1/soporte/tickets").status_code == 200


def test_crear_ticket_ignora_usuario_id_del_payload(usuario_factory, auth_as):
    autor = usuario_factory(roles_activos=["cliente"])
    otro = usuario_factory(roles_activos=["cliente"])

    resp = auth_as(autor).post(
        "/api/v1/soporte/tickets",
        json={"usuario_id": otro.id, "asunto": "Prueba", "descripcion": "Descripción de prueba"},
    )
    assert resp.status_code == 200
    assert resp.json()["usuario_id"] == autor.id


def test_escalar_ticket_requiere_admin_o_manager(db_session, usuario_factory, auth_as):
    reserva = db_session.query(Reserva).first()
    autor = usuario_factory(roles_activos=["cliente"])
    ticket = TicketSoporte(usuario_id=autor.id, asunto="Consulta", descripcion="detalle")
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    cliente = usuario_factory(roles_activos=["cliente"])
    manager = usuario_factory(roles_activos=["manager"])

    resp_denegado = auth_as(cliente).post(
        f"/api/v1/soporte/tickets/{ticket.id}/escalar", params={"reserva_id": reserva.id}
    )
    assert resp_denegado.status_code == 403

    resp_ok = auth_as(manager).post(
        f"/api/v1/soporte/tickets/{ticket.id}/escalar", params={"reserva_id": reserva.id}
    )
    assert resp_ok.status_code == 200
    assert resp_ok.json()["escalado_a_disputa"] is True


# --------------------------- disputas.py ---------------------------

def test_listar_y_obtener_disputa_requiere_admin_o_manager(db_session, usuario_factory, auth_as):
    reserva = db_session.query(Reserva).first()
    disputa = Disputa(reserva_id=reserva.id, tipo="dano", motivo="Rayón en la puerta")
    db_session.add(disputa)
    db_session.commit()
    db_session.refresh(disputa)

    cliente = usuario_factory(roles_activos=["cliente"])
    manager = usuario_factory(roles_activos=["manager"])

    assert auth_as(cliente).get("/api/v1/disputas").status_code == 403
    assert auth_as(manager).get("/api/v1/disputas").status_code == 200

    assert auth_as(cliente).get(f"/api/v1/disputas/{disputa.id}").status_code == 403
    assert auth_as(manager).get(f"/api/v1/disputas/{disputa.id}").status_code == 200


def test_resolver_disputa_requiere_admin_no_basta_manager(db_session, usuario_factory, auth_as):
    reserva = db_session.query(Reserva).first()
    disputa = Disputa(reserva_id=reserva.id, tipo="limpieza", motivo="Estanque vacío")
    db_session.add(disputa)
    db_session.commit()
    db_session.refresh(disputa)

    manager = usuario_factory(roles_activos=["manager"])
    admin = usuario_factory(roles_activos=["admin"])

    resp_manager = auth_as(manager).post(
        f"/api/v1/disputas/{disputa.id}/resolver",
        json={"accion_pago": "reembolso_total", "resolucion": "Se descuenta cargo de combustible."},
    )
    assert resp_manager.status_code == 403

    resp_admin = auth_as(admin).post(
        f"/api/v1/disputas/{disputa.id}/resolver",
        json={"accion_pago": "reembolso_total", "resolucion": "Se descuenta cargo de combustible."},
    )
    assert resp_admin.status_code == 200
    assert resp_admin.json()["estado"] == "resuelta"
