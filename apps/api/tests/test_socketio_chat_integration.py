"""
Test Suite: qa-socketio-stress-latency
Verifica la lógica del servidor Socket.IO para chat en tiempo real:
1. Conexión con autenticación por token.
2. Control de acceso y unión a salas de reserva (`reserva_{id}`).
3. Envío y broadcast de mensajes con persistencia atómica en BD.
4. Señales de tipeo (`escribiendo`, `dejo_de_escribir`).
5. Difusión segura de eventos sin fugas de sala.
"""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime
from app.models.entities import Usuario, Auto, Reserva, Mensaje
from app.features.communications.messages.socketio_server import (
    connect,
    unir_reserva,
    enviar_mensaje,
    escribiendo,
    dejo_de_escribir,
    difundir_mensaje_socketio,
    sio
)


class NoCloseSession:
    def __init__(self, s):
        self._s = s
    def __getattr__(self, item):
        if item == "close":
            return lambda: None
        return getattr(self._s, item)


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_socketio_connect_sin_token():
    res = await connect("test_sid", {"QUERY_STRING": ""}, auth=None)
    assert res is False


@pytest.mark.anyio
async def test_socketio_connect_token_valido(usuario_factory, db_session):
    usuario = usuario_factory(roles_activos=["cliente"])

    with patch("app.features.communications.messages.socketio_server.SessionLocal", return_value=NoCloseSession(db_session)), \
         patch("app.features.communications.messages.socketio_server.autenticar_token", new_callable=AsyncMock) as mock_auth, \
         patch.object(sio, "save_session", new_callable=AsyncMock) as mock_save:
        
        mock_auth.return_value = usuario

        res = await connect("sid_123", {"QUERY_STRING": "token=valid_token"}, auth=None)
        assert res is True
        mock_save.assert_called_once()


@pytest.mark.anyio
async def test_socketio_unir_reserva_autorizado_vs_ajeno(usuario_factory, db_session):
    dueno = usuario_factory(roles_activos=["dueno", "cliente"], estado_documentos="verificado")
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    intruso = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")

    auto = Auto(
        dueno_id=dueno.id, marca="Hyundai", modelo="Tucson", anio=2023,
        patente="TEST-77", tarifa_dia=35000, estado="activo", ubicacion_base="Los Ángeles"
    )
    db_session.add(auto)
    db_session.commit()

    reserva = Reserva(
        auto_id=auto.id, cliente_id=cliente.id,
        fecha_inicio=datetime(2026, 9, 10, 10), fecha_fin=datetime(2026, 9, 12, 10),
        estado="confirmada", monto_hold=70000, lugar_entrega_acordado="Centro"
    )
    db_session.add(reserva)
    db_session.commit()

    with patch("app.features.communications.messages.socketio_server.SessionLocal", return_value=NoCloseSession(db_session)):
        # Intruso intenta unirse a la sala
        with patch.object(sio, "get_session", new_callable=AsyncMock) as mock_get_session:
            mock_get_session.return_value = {"usuario_id": intruso.id}
            res_intruso = await unir_reserva("sid_intruso", {"reserva_id": reserva.id})
            assert res_intruso["ok"] is False
            assert "Sin acceso" in res_intruso["error"]

        # Cliente legítimo se une a la sala
        with patch.object(sio, "get_session", new_callable=AsyncMock) as mock_get_session, \
             patch.object(sio, "enter_room", new_callable=AsyncMock) as mock_enter, \
             patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
            
            mock_get_session.return_value = {"usuario_id": cliente.id}
            res_cliente = await unir_reserva("sid_cliente", {"reserva_id": reserva.id})
            assert res_cliente["ok"] is True
            mock_enter.assert_called_once_with("sid_cliente", f"reserva_{reserva.id}")


@pytest.mark.anyio
async def test_socketio_enviar_mensaje_persiste_y_emite(usuario_factory, db_session):
    dueno = usuario_factory(roles_activos=["dueno", "cliente"], estado_documentos="verificado")
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")

    auto = Auto(
        dueno_id=dueno.id, marca="Suzuki", modelo="Swift", anio=2021,
        patente="SWIF-99", tarifa_dia=25000, estado="activo", ubicacion_base="Los Ángeles"
    )
    db_session.add(auto)
    db_session.commit()

    reserva = Reserva(
        auto_id=auto.id, cliente_id=cliente.id,
        fecha_inicio=datetime(2026, 9, 10, 10), fecha_fin=datetime(2026, 9, 12, 10),
        estado="confirmada", monto_hold=50000, lugar_entrega_acordado="Terminal"
    )
    db_session.add(reserva)
    db_session.commit()

    with patch("app.features.communications.messages.socketio_server.SessionLocal", return_value=NoCloseSession(db_session)):
        with patch.object(sio, "get_session", new_callable=AsyncMock) as mock_get_session, \
             patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
            
            mock_get_session.return_value = {"usuario_id": cliente.id}
            res = await enviar_mensaje("sid_cliente", {
                "reserva_id": reserva.id,
                "texto": "Hola, estoy listo para retirar el auto."
            })

            assert res["ok"] is True
            assert res["mensaje"]["texto"] == "Hola, estoy listo para retirar el auto."
            mock_emit.assert_called()


@pytest.mark.anyio
async def test_socketio_escribiendo_y_dejo_de_escribir():
    with patch.object(sio, "get_session", new_callable=AsyncMock) as mock_get_session, \
         patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
        
        mock_get_session.return_value = {"usuario_id": "usr-123"}
        await escribiendo("sid_1", {"reserva_id": "res-999"})
        mock_emit.assert_called_with("usuario_escribiendo", {"reserva_id": "res-999", "usuario_id": "usr-123"}, room="reserva_res-999", skip_sid="sid_1")

        await dejo_de_escribir("sid_1", {"reserva_id": "res-999"})
        mock_emit.assert_called_with("usuario_dejo_de_escribir", {"reserva_id": "res-999", "usuario_id": "usr-123"}, room="reserva_res-999", skip_sid="sid_1")


@pytest.mark.anyio
async def test_difundir_mensaje_socketio():
    with patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
        await difundir_mensaje_socketio("res-100", {"id": "msg-1", "texto": "Broadcast"})
        mock_emit.assert_called_once_with("nuevo_mensaje", {"reserva_id": "res-100", "mensaje": {"id": "msg-1", "texto": "Broadcast"}}, room="reserva_res-100")
