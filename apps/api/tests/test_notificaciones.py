"""
Notificaciones in-app: se generan en eventos reales (mensaje nuevo,
enrolamiento) y el usuario las lee/marca por /notificaciones.
"""
from datetime import datetime
from app.models.entities import Auto, Reserva, Notificacion


def _auto_y_reserva(db_session, dueno, cliente):
    auto = Auto(
        dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2021,
        patente="NTF-01", tarifa_dia=18000, estado="activo", ubicacion_base="Los Ángeles",
    )
    db_session.add(auto)
    db_session.commit()
    reserva = Reserva(
        auto_id=auto.id, cliente_id=cliente.id,
        fecha_inicio=datetime(2026, 9, 1, 10), fecha_fin=datetime(2026, 9, 3, 10),
        estado="confirmada", monto_hold=54000, lugar_entrega_acordado="Plaza de Armas",
    )
    db_session.add(reserva)
    db_session.commit()
    return auto, reserva


def test_mensaje_genera_notificacion_a_la_otra_parte(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno", "cliente"], estado_documentos="verificado")
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    _, reserva = _auto_y_reserva(db_session, dueno, cliente)

    r = auth_as(cliente).post(f"/api/v1/reservas/{reserva.id}/mensajes", json={"texto": "Voy llegando"})
    assert r.status_code == 200

    notis = (
        db_session.query(Notificacion)
        .filter(Notificacion.usuario_id == dueno.id, Notificacion.tipo == "mensaje")
        .all()
    )
    assert len(notis) == 1
    assert "Voy llegando" in notis[0].mensaje

    # El autor no se notifica a sí mismo
    assert (
        db_session.query(Notificacion).filter(Notificacion.usuario_id == cliente.id).count() == 0
    )


def test_listar_y_marcar_notificaciones(usuario_factory, auth_as, db_session):
    usuario = usuario_factory(roles_activos=["cliente"])
    for i in range(3):
        db_session.add(Notificacion(
            usuario_id=usuario.id, tipo="sistema", titulo=f"T{i}", mensaje="m",
        ))
    db_session.commit()
    c = auth_as(usuario)

    assert c.get("/api/v1/notificaciones/conteo-no-leidas").json()["no_leidas"] == 3

    lista = c.get("/api/v1/notificaciones").json()
    assert len(lista) == 3

    c.post(f"/api/v1/notificaciones/{lista[0]['id']}/leida")
    assert c.get("/api/v1/notificaciones/conteo-no-leidas").json()["no_leidas"] == 2

    c.post("/api/v1/notificaciones/marcar-todas-leidas")
    assert c.get("/api/v1/notificaciones/conteo-no-leidas").json()["no_leidas"] == 0


def test_solo_veo_mis_notificaciones(usuario_factory, auth_as, db_session):
    yo = usuario_factory(roles_activos=["cliente"])
    otro = usuario_factory(roles_activos=["cliente"])
    db_session.add(Notificacion(usuario_id=otro.id, tipo="sistema", titulo="ajena", mensaje="m"))
    db_session.commit()

    assert auth_as(yo).get("/api/v1/notificaciones").json() == []
