"""
Test Suite: qa-push-notifications-lifecycle
Verifica el ciclo de vida completo de las notificaciones push (Expo Push Notifications):
1. Registro de token (ExponentPushToken[...] válido vs vacío vs inválido).
2. Despacho in-app + push request a Expo API con payload estructurado.
3. Notificación de reserva y chat a contraparte.
4. Resiliencia ante fallos HTTP/timeouts de Expo (operación atómica sin romper transacciones).
"""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
from app.models.entities import Usuario, Auto, Reserva, Notificacion
from app.services.notificaciones import crear_notificacion, _enviar_push


def test_registro_y_limpieza_push_token(usuario_factory, auth_as, db_session):
    usuario = usuario_factory(roles_activos=["cliente"])
    client = auth_as(usuario)

    # 1. Registrar token válido
    valid_token = "ExponentPushToken[AbCdEf1234567890]"
    resp = client.put("/api/v1/usuarios/me/push-token", json={"expo_push_token": valid_token})
    assert resp.status_code == 200
    db_session.expire_all()
    user_db = db_session.get(Usuario, usuario.id)
    assert user_db.expo_push_token == valid_token

    # 2. Limpieza de token (logout o revocar)
    resp = client.put("/api/v1/usuarios/me/push-token", json={"expo_push_token": ""})
    assert resp.status_code == 200
    db_session.expire_all()
    user_db = db_session.get(Usuario, usuario.id)
    assert user_db.expo_push_token is None


def test_enviar_push_payload_correcto():
    token = "ExponentPushToken[TestDeviceToken123]"
    with patch("httpx.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_instance

        _enviar_push(token, "Reserva Confirmada", "Tu reserva ha sido confirmada con éxito", {"tipo": "reserva", "entidad_id": "res-123"})

        mock_instance.post.assert_called_once()
        args, kwargs = mock_instance.post.call_args
        assert kwargs["json"]["to"] == token
        assert kwargs["json"]["title"] == "Reserva Confirmada"
        assert kwargs["json"]["body"] == "Tu reserva ha sido confirmada con éxito"
        assert kwargs["json"]["data"] == {"tipo": "reserva", "entidad_id": "res-123"}


def test_enviar_push_ignora_tokens_invalidos():
    with patch("httpx.Client") as mock_client_cls:
        # Token que no empieza con ExponentPushToken
        _enviar_push("invalid_token_123", "Titulo", "Mensaje")
        mock_client_cls.assert_not_called()

        _enviar_push("", "Titulo", "Mensaje")
        mock_client_cls.assert_not_called()


def test_crear_notificacion_guarda_en_bd_y_despacha_push(usuario_factory, db_session):
    usuario = usuario_factory(roles_activos=["cliente"], expo_push_token="ExponentPushToken[TestToken999]")
    
    with patch("app.services.notificaciones._enviar_push") as mock_push:
        notif = crear_notificacion(
            db_session,
            usuario_id=usuario.id,
            tipo="reserva",
            titulo="Nueva Solicitud",
            mensaje="Tienes una solicitud de arriendo",
            entidad_tipo="reserva",
            entidad_id="res-abc-456",
            commit=True,
        )

        assert notif is not None
        assert notif.id is not None
        assert notif.usuario_id == usuario.id
        assert notif.leido is False

        mock_push.assert_called_once_with(
            "ExponentPushToken[TestToken999]",
            "Nueva Solicitud",
            "Tienes una solicitud de arriendo",
            {"tipo": "reserva", "entidad_id": "res-abc-456"},
        )


def test_crear_notificacion_tolerante_a_fallos_http_expo(usuario_factory, db_session):
    usuario = usuario_factory(roles_activos=["cliente"], expo_push_token="ExponentPushToken[FailToken]")

    with patch("httpx.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.post.side_effect = Exception("Expo Server 503 Service Unavailable")
        mock_client_cls.return_value.__enter__.return_value = mock_instance

        # No debe lanzar excepción
        notif = crear_notificacion(
            db_session,
            usuario_id=usuario.id,
            tipo="mensaje",
            titulo="Nuevo Mensaje",
            mensaje="Hola!",
            commit=True,
        )

        assert notif is not None
        assert notif.mensaje == "Hola!"
