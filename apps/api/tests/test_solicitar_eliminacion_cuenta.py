"""
"Eliminar mi cuenta" solo abría un ticket de soporte genérico — nada
verificaba de verdad si el usuario tenía arriendos o pagos en curso antes de
dejarlo pedir la baja. Ahora POST /usuarios/me/solicitar-eliminacion bloquea
con 409 mientras haya reservas activas (como cliente o como dueño de flota)
y, si está limpio, marca `eliminacion_solicitada_en` para que soporte
tramite la baja real.
"""
from datetime import datetime, timedelta, timezone

from app.models.entities import Auto, Reserva


def _crear_auto(db_session, dueno, patente="ELIM-01"):
    auto = Auto(
        dueno_id=dueno.id,
        marca="Toyota",
        modelo="Yaris",
        anio=2021,
        patente=patente,
        tarifa_dia=30000,
        ubicacion_base="Plaza de Armas, Los Ángeles",
        doc_inscripcion_url="https://ejemplo.com/padron.jpg",
        doc_permiso_circulacion_url="https://ejemplo.com/permiso.jpg",
        doc_soap_url="https://ejemplo.com/soap.jpg",
        doc_revision_tecnica_url="https://ejemplo.com/prt.jpg",
        documentos_verificados=True,
        gps_consentimiento=True,
    )
    db_session.add(auto)
    db_session.commit()
    db_session.refresh(auto)
    return auto


def _crear_reserva(db_session, auto, cliente, estado):
    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    reserva = Reserva(
        auto_id=auto.id,
        cliente_id=cliente.id,
        fecha_inicio=ahora,
        fecha_fin=ahora + timedelta(days=3),
        estado=estado,
        monto_hold=100000,
        lugar_entrega_acordado="Plaza de Armas, Los Ángeles",
    )
    db_session.add(reserva)
    db_session.commit()
    db_session.refresh(reserva)
    return reserva


def test_bloquea_con_409_si_tiene_un_arriendo_en_curso_como_cliente(client, db_session, usuario_factory, auth_as):
    dueno = usuario_factory(roles_activos=["dueno"])
    cliente = usuario_factory(roles_activos=["cliente"])
    auto = _crear_auto(db_session, dueno)
    _crear_reserva(db_session, auto, cliente, "en_curso")

    resp = auth_as(cliente).post("/api/v1/usuarios/me/solicitar-eliminacion")

    assert resp.status_code == 409
    assert "1 arriendo(s) tuyo(s)" in resp.json()["detail"]

    db_session.refresh(cliente)
    assert cliente.eliminacion_solicitada_en is None


def test_bloquea_con_409_si_tiene_reservas_pendientes_en_su_flota_como_dueno(client, db_session, usuario_factory, auth_as):
    dueno = usuario_factory(roles_activos=["dueno"])
    cliente = usuario_factory(roles_activos=["cliente"])
    auto = _crear_auto(db_session, dueno)
    _crear_reserva(db_session, auto, cliente, "confirmada")

    resp = auth_as(dueno).post("/api/v1/usuarios/me/solicitar-eliminacion")

    assert resp.status_code == 409
    assert "1 reserva(s) de tu flota" in resp.json()["detail"]


def test_una_cuenta_limpia_puede_solicitar_la_baja(client, db_session, usuario_factory, auth_as):
    usuario = usuario_factory(roles_activos=["cliente"])

    resp = auth_as(usuario).post("/api/v1/usuarios/me/solicitar-eliminacion")

    assert resp.status_code == 200
    body = resp.json()
    assert body["solicitado"] is True
    assert "48 horas" in body["mensaje"]

    db_session.refresh(usuario)
    assert usuario.eliminacion_solicitada_en is not None


def test_reservas_finalizadas_no_bloquean_la_baja(client, db_session, usuario_factory, auth_as):
    dueno = usuario_factory(roles_activos=["dueno"])
    cliente = usuario_factory(roles_activos=["cliente"])
    auto = _crear_auto(db_session, dueno)
    _crear_reserva(db_session, auto, cliente, "finalizada")

    resp = auth_as(cliente).post("/api/v1/usuarios/me/solicitar-eliminacion")

    assert resp.status_code == 200
