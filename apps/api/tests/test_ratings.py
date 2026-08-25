from app.models.entities import Reserva

def test_crear_calificacion_bidireccional(client, db_session):
    reserva = db_session.query(Reserva).first()
    reserva.estado = "finalizada"
    db_session.commit()

    # Calificación del cliente hacia el dueño
    resp_cliente = client.post(
        "/api/v1/calificaciones",
        json={
            "reserva_id": reserva.id,
            "autor_id": reserva.cliente_id,
            "autor_rol": "cliente",
            "destinatario_id": "dueno_id_123",
            "puntaje": 5,
            "comentario": "Excelente auto, muy limpio y puntual."
        }
    )
    assert resp_cliente.status_code == 200
    assert resp_cliente.json()["puntaje"] == 5

    # Calificación del dueño hacia el cliente
    resp_dueno = client.post(
        "/api/v1/calificaciones",
        json={
            "reserva_id": reserva.id,
            "autor_id": "dueno_id_123",
            "autor_rol": "dueno",
            "destinatario_id": reserva.cliente_id,
            "puntaje": 5,
            "comentario": "Excelente cliente, cuidó muy bien el vehículo."
        }
    )
    assert resp_dueno.status_code == 200
    assert resp_dueno.json()["puntaje"] == 5
