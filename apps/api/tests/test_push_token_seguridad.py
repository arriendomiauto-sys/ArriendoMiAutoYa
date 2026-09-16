"""
Riesgo detectado: en un dispositivo compartido, si el usuario anterior no
limpiaba su token push al cerrar sesión (o `_post_push` ignoraba que Expo
reportó el token como muerto), dos cuentas podían terminar con el MISMO
`expo_push_token` — un push dirigido a una cuenta llegaba al dispositivo de
la otra. Cubre:

1. PUT /usuarios/me/push-token le "roba" el token a cualquier otra cuenta que
   lo tuviera antes de asignárselo al usuario actual.
2. El índice único parcial en BD es el resguardo final (dos usuarios no
   pueden compartir el mismo token no-nulo).
3. `_post_push` limpia el token cuando Expo responde DeviceNotRegistered, y
   NO lo limpia ante errores transitorios.
"""
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.models.entities import Usuario
from app.features.communications.notifications.service import _post_push

TOKEN_COMPARTIDO = "ExponentPushToken[Compartido123]"


def test_registrar_token_se_lo_roba_a_otra_cuenta(usuario_factory, auth_as, db_session):
    anterior = usuario_factory(roles_activos=["cliente"], expo_push_token=TOKEN_COMPARTIDO)
    nuevo = usuario_factory(roles_activos=["cliente"])

    resp = auth_as(nuevo).put(
        "/api/v1/usuarios/me/push-token", json={"expo_push_token": TOKEN_COMPARTIDO}
    )
    assert resp.status_code == 200

    db_session.expire_all()
    assert db_session.get(Usuario, nuevo.id).expo_push_token == TOKEN_COMPARTIDO
    assert db_session.get(Usuario, anterior.id).expo_push_token is None


def test_indice_unico_rechaza_dos_cuentas_con_el_mismo_token(usuario_factory, db_session):
    usuario_factory(roles_activos=["cliente"], expo_push_token=TOKEN_COMPARTIDO)
    db_session.add(Usuario(
        nombre="Otro", email="otro-token-dup@test.cl", expo_push_token=TOKEN_COMPARTIDO,
    ))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_dos_cuentas_sin_token_no_chocan(usuario_factory, db_session):
    """El índice es parcial (solo NOT NULL): NULL no cuenta como duplicado."""
    usuario_factory(roles_activos=["cliente"])
    otro = Usuario(nombre="Otro", email="otro-sin-token@test.cl")
    db_session.add(otro)
    db_session.commit()
    assert otro.expo_push_token is None


def _mock_resp(data_status, razon=None, mensaje=None):
    resp = MagicMock()
    ticket = {"status": data_status}
    if razon:
        ticket["details"] = {"error": razon}
    if mensaje:
        ticket["message"] = mensaje
    resp.json.return_value = {"data": [ticket]}
    return resp


def test_post_push_limpia_token_device_not_registered(usuario_factory, db_session, monkeypatch):
    usuario = usuario_factory(roles_activos=["cliente"], expo_push_token=TOKEN_COMPARTIDO)
    # _post_push corre en un thread del pool y abre su PROPIA sesión (la del
    # request que disparó la notificación ya se cerró) — normalmente vía
    # app.core.database.SessionLocal, que en tests es un engine sqlite en
    # memoria DISTINTO del de `db_session`. Se apunta al mismo para poder
    # observar el efecto con `db_session`.
    monkeypatch.setattr(
        "app.features.communications.notifications.service.SessionLocal",
        sessionmaker(bind=db_session.get_bind()),
    )

    with patch("httpx.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.post.return_value = _mock_resp("error", razon="DeviceNotRegistered")
        mock_client_cls.return_value.__enter__.return_value = mock_instance

        _post_push(TOKEN_COMPARTIDO, "Titulo", "Mensaje")

    db_session.expire_all()
    assert db_session.get(Usuario, usuario.id).expo_push_token is None


def test_post_push_no_limpia_token_ante_error_transitorio(usuario_factory, db_session, monkeypatch):
    usuario = usuario_factory(roles_activos=["cliente"], expo_push_token=TOKEN_COMPARTIDO)
    monkeypatch.setattr(
        "app.features.communications.notifications.service.SessionLocal",
        sessionmaker(bind=db_session.get_bind()),
    )

    with patch("httpx.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.post.return_value = _mock_resp("error", razon="MessageRateExceeded")
        mock_client_cls.return_value.__enter__.return_value = mock_instance

        _post_push(TOKEN_COMPARTIDO, "Titulo", "Mensaje")

    db_session.expire_all()
    assert db_session.get(Usuario, usuario.id).expo_push_token == TOKEN_COMPARTIDO
