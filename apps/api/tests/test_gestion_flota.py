"""
Mantenciones/documentos legales y calendario de bloqueo de un auto: solo
el dueño del vehículo (o admin) puede leer y escribir.
"""
from app.models.entities import Auto, Usuario, Reserva


def test_mantencion_solo_la_gestiona_el_dueno_del_auto(db_session, auth_as):
    auto = db_session.query(Auto).first()
    dueno = db_session.query(Usuario).filter(Usuario.id == auto.dueno_id).first()
    intruso = db_session.query(Usuario).filter(Usuario.email == "manager.la@arriendatuauto.cl").first()

    payload = {"tipo": "documento_legal", "nombre": "Revisión Técnica"}

    resp_intruso = auth_as(intruso).post(f"/api/v1/autos/{auto.id}/mantenciones", json=payload)
    assert resp_intruso.status_code == 403

    resp_dueno = auth_as(dueno).post(f"/api/v1/autos/{auto.id}/mantenciones", json=payload)
    assert resp_dueno.status_code == 200
    mantencion_id = resp_dueno.json()["id"]

    resp_listar_intruso = auth_as(intruso).get(f"/api/v1/autos/{auto.id}/mantenciones")
    assert resp_listar_intruso.status_code == 403

    resp_listar_dueno = auth_as(dueno).get(f"/api/v1/autos/{auto.id}/mantenciones")
    assert resp_listar_dueno.status_code == 200
    assert len(resp_listar_dueno.json()) == 1

    resp_borrar_intruso = auth_as(intruso).delete(f"/api/v1/mantenciones/{mantencion_id}")
    assert resp_borrar_intruso.status_code == 403

    resp_borrar_dueno = auth_as(dueno).delete(f"/api/v1/mantenciones/{mantencion_id}")
    assert resp_borrar_dueno.status_code == 204


def test_bloqueo_calendario_solo_lo_gestiona_el_dueno_del_auto(db_session, auth_as):
    auto = db_session.query(Auto).filter(Auto.estado == "activo").all()
    # Elegimos un auto sin reservas activas seed para no chocar con el check de solapamiento
    autos_sin_reserva = [a for a in auto if not db_session.query(Reserva).filter(Reserva.auto_id == a.id, Reserva.estado.in_(["confirmada", "en_curso"])).first()]
    target = autos_sin_reserva[0]
    dueno = db_session.query(Usuario).filter(Usuario.id == target.dueno_id).first()
    intruso = db_session.query(Usuario).filter(Usuario.email == "manager.la@arriendatuauto.cl").first()

    payload = {"fecha": "2026-09-01T00:00:00", "motivo": "Uso personal"}

    resp_intruso = auth_as(intruso).post(f"/api/v1/autos/{target.id}/bloqueos", json=payload)
    assert resp_intruso.status_code == 403

    resp_dueno = auth_as(dueno).post(f"/api/v1/autos/{target.id}/bloqueos", json=payload)
    assert resp_dueno.status_code == 200
    bloqueo_id = resp_dueno.json()["id"]

    resp_borrar_dueno = auth_as(dueno).delete(f"/api/v1/bloqueos/{bloqueo_id}")
    assert resp_borrar_dueno.status_code == 204


def test_no_se_puede_bloquear_un_dia_con_reserva_confirmada(db_session, auth_as):
    reserva = db_session.query(Reserva).filter(Reserva.estado.in_(["confirmada", "en_curso"])).first()
    auto = db_session.query(Auto).filter(Auto.id == reserva.auto_id).first()
    dueno = db_session.query(Usuario).filter(Usuario.id == auto.dueno_id).first()

    payload = {"fecha": reserva.fecha_inicio.isoformat()}
    resp = auth_as(dueno).post(f"/api/v1/autos/{auto.id}/bloqueos", json=payload)
    assert resp.status_code == 400
