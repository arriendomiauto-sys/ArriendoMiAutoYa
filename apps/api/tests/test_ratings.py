from app.models.entities import Reserva, Usuario

def test_crear_calificacion_bidireccional(db_session, auth_as):
    reserva = db_session.query(Reserva).first()
    reserva.estado = "finalizada"
    db_session.commit()

    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()

    # Calificación del cliente hacia el dueño
    resp_cliente = auth_as(cliente).post(
        "/api/v1/calificaciones",
        json={
            "reserva_id": reserva.id,
            "autor_rol": "cliente",
            "destinatario_id": dueno.id,
            "puntaje": 5,
            "comentario": "Excelente auto, muy limpio y puntual."
        }
    )
    assert resp_cliente.status_code == 200
    assert resp_cliente.json()["puntaje"] == 5
    assert resp_cliente.json()["autor_id"] == cliente.id

    # Calificación del dueño hacia el cliente
    resp_dueno = auth_as(dueno).post(
        "/api/v1/calificaciones",
        json={
            "reserva_id": reserva.id,
            "autor_rol": "dueno",
            "destinatario_id": cliente.id,
            "puntaje": 5,
            "comentario": "Excelente cliente, cuidó muy bien el vehículo."
        }
    )
    assert resp_dueno.status_code == 200
    assert resp_dueno.json()["puntaje"] == 5
    assert resp_dueno.json()["autor_id"] == dueno.id

def test_calificacion_ignora_autor_id_del_payload(db_session, auth_as):
    """El autor_id siempre es el usuario autenticado, nunca el del payload
    (evita firmar una calificación como si fuera otro usuario)."""
    reserva = db_session.query(Reserva).first()
    reserva.estado = "finalizada"
    db_session.commit()

    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()

    resp = auth_as(cliente).post(
        "/api/v1/calificaciones",
        json={
            "reserva_id": reserva.id,
            "autor_id": dueno.id,  # intento de suplantar al dueño
            "autor_rol": "cliente",
            "destinatario_id": dueno.id,
            "puntaje": 1,
            "comentario": "Intento de suplantación."
        }
    )
    assert resp.status_code == 200
    assert resp.json()["autor_id"] == cliente.id

def test_calificacion_sin_auth_da_401(client, db_session):
    reserva = db_session.query(Reserva).first()
    resp = client.post(
        "/api/v1/calificaciones",
        json={
            "reserva_id": reserva.id,
            "autor_rol": "cliente",
            "destinatario_id": "algun-id",
            "puntaje": 5,
        }
    )
    assert resp.status_code == 401
