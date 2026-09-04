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

def test_listar_calificaciones_incluye_el_nombre_del_autor(db_session, auth_as, client):
    """
    La ficha del auto muestra el nombre de quien escribió cada reseña, no
    solo su id — sin esto no había forma de mostrarlo sin un N+1 desde el
    cliente (una consulta de usuario por cada reseña).
    """
    reserva = db_session.query(Reserva).first()
    reserva.estado = "finalizada"
    db_session.commit()

    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    cliente.nombre = "Juanita Pérez"
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()
    db_session.commit()

    auth_as(cliente).post(
        "/api/v1/calificaciones",
        json={
            "reserva_id": reserva.id,
            "autor_rol": "cliente",
            "destinatario_id": dueno.id,
            "puntaje": 5,
            "comentario": "Auto impecable.",
        },
    )

    resp = client.get(f"/api/v1/calificaciones?destinatario_id={dueno.id}")
    assert resp.status_code == 200
    reseña = next(r for r in resp.json() if r["comentario"] == "Auto impecable.")
    assert reseña["autor_nombre"] == "Juanita Pérez"


def test_las_calificaciones_mas_recientes_van_primero(db_session, auth_as):
    reserva = db_session.query(Reserva).first()
    reserva.estado = "finalizada"
    db_session.commit()
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()

    auth_as(cliente).post(
        "/api/v1/calificaciones",
        json={"reserva_id": reserva.id, "autor_rol": "cliente", "destinatario_id": dueno.id, "puntaje": 3, "comentario": "primera"},
    )
    resp = auth_as(dueno).get(f"/api/v1/calificaciones?destinatario_id={dueno.id}")
    assert resp.json()[0]["comentario"] == "primera"


def test_calificacion_rechaza_a_alguien_ajeno_a_la_reserva(db_session, auth_as, usuario_factory):
    """
    Sin esto, cualquier usuario autenticado podía calificar una reserva en
    la que nunca participó, con cualquier destinatario_id — reserva_id no
    se cruzaba con la identidad real de quien calificaba.
    """
    reserva = db_session.query(Reserva).first()
    reserva.estado = "finalizada"
    db_session.commit()

    intruso = usuario_factory(roles_activos=["cliente"])
    resp = auth_as(intruso).post(
        "/api/v1/calificaciones",
        json={
            "reserva_id": reserva.id,
            "autor_rol": "cliente",
            "destinatario_id": "quien-sea",
            "puntaje": 1,
            "comentario": "Nunca arrendé este auto.",
        },
    )
    assert resp.status_code == 403


def test_calificacion_rechaza_rol_declarado_falso(db_session, auth_as):
    """El cliente real de la reserva no puede firmar como si fuera el dueño."""
    reserva = db_session.query(Reserva).first()
    reserva.estado = "finalizada"
    db_session.commit()
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()

    resp = auth_as(cliente).post(
        "/api/v1/calificaciones",
        json={
            "reserva_id": reserva.id,
            "autor_rol": "dueno",
            "destinatario_id": cliente.id,
            "puntaje": 5,
        },
    )
    assert resp.status_code == 403


def test_calificacion_ignora_destinatario_id_forjado(db_session, auth_as):
    """El destinatario se calcula del lado servidor a partir de la reserva,
    nunca del valor que mande el cliente."""
    reserva = db_session.query(Reserva).first()
    reserva.estado = "finalizada"
    db_session.commit()
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()

    resp = auth_as(cliente).post(
        "/api/v1/calificaciones",
        json={
            "reserva_id": reserva.id,
            "autor_rol": "cliente",
            "destinatario_id": cliente.id,  # se manda a sí mismo, a propósito
            "puntaje": 5,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["destinatario_id"] == dueno.id


def test_calificacion_duplicada_para_la_misma_reserva_es_rechazada(db_session, auth_as):
    reserva = db_session.query(Reserva).first()
    reserva.estado = "finalizada"
    db_session.commit()
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()

    payload = {
        "reserva_id": reserva.id,
        "autor_rol": "cliente",
        "destinatario_id": dueno.id,
        "puntaje": 5,
    }
    c = auth_as(cliente)
    primera = c.post("/api/v1/calificaciones", json=payload)
    assert primera.status_code == 200

    segunda = c.post("/api/v1/calificaciones", json={**payload, "puntaje": 1, "comentario": "cambié de opinión"})
    assert segunda.status_code == 400

    # Pero el dueño sí puede calificar la MISMA reserva desde su lado —
    # el duplicado se evalúa por autor, no por reserva sola.
    resp_dueno = auth_as(dueno).post(
        "/api/v1/calificaciones",
        json={"reserva_id": reserva.id, "autor_rol": "dueno", "destinatario_id": cliente.id, "puntaje": 4},
    )
    assert resp_dueno.status_code == 200


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
