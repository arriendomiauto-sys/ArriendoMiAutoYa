"""
El dueño de un auto no puede arrendar su propio vehículo.

Un usuario con los roles `dueno` y `cliente` puede abrir la app de arrendatario
y ver su auto en el catálogo; sin esta regla podría reservarlo, pagar y cobrarse
a sí mismo (comisión, bonos de referido, liquidaciones).
"""


def _fecha(dias):
    """Fecha relativa a hoy: las reservas en el pasado se rechazan, las fijas envejecen."""
    from datetime import datetime, timedelta
    return (datetime.utcnow() + timedelta(days=dias)).strftime("%Y-%m-%dT10:00:00")

from app.models.entities import Auto, Reserva


def _auto(db_session, dueno):
    auto = Auto(
        dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022, patente="KLPW-88",
        tarifa_dia=20000, estado="activo", ubicacion_base="Los Ángeles", categoria="economico",
    )
    db_session.add(auto)
    db_session.commit()
    return auto


def _reservar(auth_as, usuario, auto):
    return auth_as(usuario).post(
        "/api/v1/reservas",
        json={
            "auto_id": auto.id,
            "fecha_inicio": _fecha(60),
            "fecha_fin": _fecha(63),
            "lugar_entrega_acordado": "Plaza de Armas",
        },
    )


def test_el_dueno_no_puede_reservar_su_propio_auto(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno", "cliente"], estado_documentos="verificado")
    auto = _auto(db_session, dueno)

    resp = _reservar(auth_as, dueno, auto)

    assert resp.status_code == 400, resp.text
    assert "propio" in resp.json()["detail"].lower()
    assert db_session.query(Reserva).filter(Reserva.auto_id == auto.id).count() == 0


def test_otro_arrendatario_si_puede_reservar_ese_auto(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno", "cliente"], estado_documentos="verificado")
    auto = _auto(db_session, dueno)
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")

    resp = _reservar(auth_as, cliente, auto)

    assert resp.status_code in (200, 201), resp.text
