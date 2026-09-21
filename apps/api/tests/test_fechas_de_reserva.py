"""Fechas de una reserva: no se reserva en el pasado ni por una duración absurda."""


def _fecha(dias):
    """Fecha relativa a hoy: las reservas en el pasado se rechazan, las fijas envejecen."""
    from datetime import datetime, timedelta
    return (datetime.utcnow() + timedelta(days=dias)).strftime("%Y-%m-%dT10:00:00")

import pytest

from app.models.entities import Auto


@pytest.fixture
def escenario(usuario_factory, db_session):
    dueno = usuario_factory(roles_activos=["dueno"])
    auto = Auto(dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022, patente="KLPW-88",
                tarifa_dia=20000, estado="activo", ubicacion_base="Los Ángeles", categoria="economico")
    db_session.add(auto)
    db_session.commit()
    return auto, usuario_factory(roles_activos=["cliente"])


def _reservar(auth_as, cliente, auto, inicio, fin):
    return auth_as(cliente).post("/api/v1/reservas", json={
        "auto_id": auto.id, "fecha_inicio": inicio, "fecha_fin": fin, "lugar_entrega_acordado": "Plaza de Armas"})


def test_no_se_puede_reservar_en_el_pasado(escenario, auth_as):
    auto, cliente = escenario
    resp = _reservar(auth_as, cliente, auto, "2020-01-05T10:00:00", "2020-01-08T10:00:00")
    assert resp.status_code in (400, 422), resp.text


def test_no_se_puede_reservar_por_un_ano(escenario, auth_as):
    auto, cliente = escenario
    resp = _reservar(auth_as, cliente, auto, _fecha(60), _fecha(425))
    assert resp.status_code in (400, 422), resp.text


def test_una_reserva_normal_sigue_funcionando(escenario, auth_as):
    auto, cliente = escenario
    resp = _reservar(auth_as, cliente, auto, _fecha(60), _fecha(63))
    assert resp.status_code in (200, 201), resp.text
