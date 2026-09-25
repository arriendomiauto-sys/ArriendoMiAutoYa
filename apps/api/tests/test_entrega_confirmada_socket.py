"""
El cliente se queda mirando la pantalla del código QR esperando que el
dueño lo escanee. Antes no había forma de avisarle que ya lo verificaron
salvo que volviera a entrar a la app: ahora, al confirmar la identidad, el
backend emite `entrega_confirmada` a la sala de la reserva por Socket.IO.
"""
from unittest.mock import AsyncMock, patch

from conftest import simular_escaneo_qr
from app.models.entities import Reserva, Usuario


def test_confirmar_identidad_exitosa_emite_entrega_confirmada(client, db_session, auth_as):
    reserva = db_session.query(Reserva).first()
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()

    simular_escaneo_qr(db_session, reserva.id)
    with patch(
        "app.features.bookings.delivery.router.sio.emit", new_callable=AsyncMock
    ) as mock_emit:
        resp = auth_as(dueno).post(
            f"/api/v1/entrega/{reserva.id}/confirmar-verificacion",
            json={"resultado": "confirmada", "tipo": "entrega"},
        )

    assert resp.status_code == 200
    mock_emit.assert_awaited_once_with(
        "entrega_confirmada",
        {"reserva_id": reserva.id, "tipo": "entrega", "resultado": "checklist_fotos"},
        room=f"reserva_{reserva.id}",
    )


def test_confirmar_identidad_rechazada_no_emite_entrega_confirmada(client, db_session, auth_as):
    reserva = db_session.query(Reserva).first()
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()

    simular_escaneo_qr(db_session, reserva.id)
    with patch(
        "app.features.bookings.delivery.router.sio.emit", new_callable=AsyncMock
    ) as mock_emit:
        resp = auth_as(dueno).post(
            f"/api/v1/entrega/{reserva.id}/confirmar-verificacion",
            json={
                "resultado": "rechazada",
                "tipo": "entrega",
                "motivo_rechazo": "El rostro no coincide con la cédula.",
            },
        )

    assert resp.status_code == 200
    mock_emit.assert_not_awaited()
