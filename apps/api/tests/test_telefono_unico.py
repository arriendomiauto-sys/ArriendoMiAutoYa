"""Un celular = una cuenta."""
import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from app.features.auth.login.service import _sincronizar_usuario_local
from app.models.entities import Usuario

TELEFONO = "+56 9 4444 5555"


def test_telefono_disponible_dice_si_ya_hay_cuenta(client, usuario_factory):
    usuario_factory(telefono=TELEFONO)

    ocupado = client.post("/api/v1/usuarios/telefono-disponible", json={"telefono": "944445555"})
    assert ocupado.status_code == 200, ocupado.text
    assert ocupado.json() == {"disponible": False}

    libre = client.post("/api/v1/usuarios/telefono-disponible", json={"telefono": "+56 9 4444 0000"})
    assert libre.json() == {"disponible": True}


def test_perfil_basico_rechaza_un_celular_de_otra_cuenta(usuario_factory, auth_as):
    usuario_factory(telefono=TELEFONO)
    yo = usuario_factory(estado_documentos="pendiente")

    resp = auth_as(yo).put(
        "/api/v1/usuarios/me/perfil-basico", json={"nombre": "Camila Rojas", "telefono": "+56944445555"}
    )
    assert resp.status_code == 409
    assert "otra cuenta" in resp.json()["detail"]


def test_perfil_basico_permite_volver_a_guardar_el_propio_celular(usuario_factory, auth_as):
    yo = usuario_factory(telefono=TELEFONO, estado_documentos="pendiente")

    resp = auth_as(yo).put("/api/v1/usuarios/me/perfil-basico", json={"nombre": "Camila Rojas", "telefono": TELEFONO})
    assert resp.status_code == 200, resp.text
    assert resp.json()["telefono"] == TELEFONO


def test_cuenta_nueva_con_celular_ya_usado_se_crea_sin_celular(db_session, usuario_factory):
    usuario_factory(telefono=TELEFONO)

    nuevo = _sincronizar_usuario_local(
        db_session, str(uuid.uuid4()), "otra@test.cl", {"nombre": "Otra Persona", "telefono": TELEFONO}
    )
    assert nuevo.nombre == "Otra Persona"
    assert nuevo.telefono is None


def test_la_base_no_acepta_dos_cuentas_con_el_mismo_celular(db_session, usuario_factory):
    usuario_factory(telefono=TELEFONO)
    db_session.add(Usuario(id=str(uuid.uuid4()), email="dup@test.cl", telefono=TELEFONO, roles_activos=["cliente"]))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_varias_cuentas_sin_celular_no_chocan(usuario_factory):
    usuario_factory(telefono=None)
    usuario_factory(telefono=None)
