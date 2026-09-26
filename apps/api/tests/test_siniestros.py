"""
Accidente durante el arriendo: el arrendatario lo reporta, el soporte 24/7 lo
toma y todo lo que se decide les llega por escrito a las dos partes. Mientras
el caso esté abierto la garantía queda retenida (disputa "accidente").
"""
import pytest

from app.models.entities import Disputa, Notificacion, Pago, Reserva, Siniestro, TicketSoporte
from test_flujos_controlado_y_no_controlado import (  # noqa: F401 — fixtures reutilizadas
    FOTO, _checklist, _entregar, _estado, _verificar, confirmada, partes, sin_pasarela_real,
)

REPORTE = {
    "descripcion": "Me chocaron por atrás en un semáforo, el parachoques quedó hundido.",
    "hay_terceros": True,
    "datos_tercero": "Patente ABCD-12, seguro XYZ",
    "fotos": [FOTO],
}


@pytest.fixture
def en_curso(confirmada, auth_as):
    _entregar(auth_as, confirmada)
    return confirmada


def _reportar(auth_as, quien, rid, **cambios):
    return auth_as(quien).post(f"/api/v1/reservas/{rid}/siniestro", json={**REPORTE, **cambios})


def _notificaciones(db_session, usuario_id):
    db_session.expire_all()
    return db_session.query(Notificacion).filter(Notificacion.usuario_id == usuario_id, Notificacion.tipo == "siniestro").all()


def test_el_arrendatario_reporta_y_se_avisa_a_todos(auth_as, db_session, usuario_factory, en_curso):
    agente = usuario_factory(roles_activos=["soporte"])
    r = _reportar(auth_as, en_curso["cliente"], en_curso["rid"])
    assert r.status_code == 200, r.text
    caso = r.json()
    assert caso["codigo"].startswith("SIN-") and caso["estado"] == "reportado"

    siniestro = db_session.get(Siniestro, caso["id"])
    disputa = db_session.get(Disputa, siniestro.disputa_id)
    assert disputa.tipo == "accidente" and disputa.estado == "abierta"
    assert db_session.get(TicketSoporte, siniestro.ticket_id).asunto.startswith(f"[{caso['codigo']}]")

    assert _notificaciones(db_session, en_curso["cliente"].id)
    assert _notificaciones(db_session, en_curso["dueno"].id)
    assert _notificaciones(db_session, agente.id)
    # El arriendo sigue en curso: el auto se devuelve con el checklist normal.
    assert _estado(db_session, en_curso["rid"]) == "en_curso"


def test_solo_el_arrendatario_reporta_y_solo_las_partes_lo_ven(auth_as, usuario_factory, en_curso):
    rid = en_curso["rid"]
    assert _reportar(auth_as, en_curso["dueno"], rid).status_code == 403
    assert _reportar(auth_as, en_curso["cliente"], rid).status_code == 200

    extrano = usuario_factory(roles_activos=["cliente"])
    assert auth_as(extrano).get(f"/api/v1/reservas/{rid}/siniestro").status_code == 403
    vista = auth_as(en_curso["dueno"]).get(f"/api/v1/reservas/{rid}/siniestro")
    assert vista.status_code == 200
    # Los teléfonos de las partes son solo para soporte.
    assert vista.json()["cliente_telefono"] is None


def test_no_se_reporta_fuera_del_arriendo_ni_dos_veces(auth_as, confirmada):
    rid = confirmada["rid"]
    assert _reportar(auth_as, confirmada["cliente"], rid).status_code == 409  # aún no entregado
    _entregar(auth_as, confirmada)
    assert _reportar(auth_as, confirmada["cliente"], rid).status_code == 200
    assert _reportar(auth_as, confirmada["cliente"], rid).status_code == 409


def test_sin_fotos_solo_si_hubo_lesionados(auth_as, en_curso):
    rid, cliente = en_curso["rid"], en_curso["cliente"]
    assert _reportar(auth_as, cliente, rid, fotos=[]).status_code == 400
    assert _reportar(auth_as, cliente, rid, fotos=[], hubo_lesionados=True).status_code == 200


def test_con_el_caso_abierto_la_devolucion_retiene_la_garantia(auth_as, db_session, en_curso):
    rid = en_curso["rid"]
    assert _reportar(auth_as, en_curso["cliente"], rid).status_code == 200
    _verificar(auth_as, en_curso["dueno"], en_curso["cliente"], rid, tipo="devolucion")
    r = _checklist(auth_as, en_curso["dueno"], rid, "despues")
    assert r.status_code == 200, r.text
    assert _estado(db_session, rid) == "disputada"
    hold = db_session.query(Pago).filter(Pago.reserva_id == rid, Pago.tipo == "hold_reserva").one()
    # Asegurada para la reparación (retenida o capturada en disputa), nunca liberada.
    assert hold.estado in ("retenido", "capturado_disputa")


def test_con_el_caso_abierto_no_se_extiende(auth_as, en_curso):
    rid = en_curso["rid"]
    assert _reportar(auth_as, en_curso["cliente"], rid).status_code == 200
    r = auth_as(en_curso["cliente"]).post(f"/api/v1/reservas/{rid}/extender", json={"dias_adicionales": 1})
    assert r.status_code == 409


def test_soporte_atiende_informa_a_ambas_partes_y_cierra(auth_as, db_session, usuario_factory, en_curso):
    rid = en_curso["rid"]
    caso = _reportar(auth_as, en_curso["cliente"], rid).json()
    agente = usuario_factory(roles_activos=["soporte"])
    base = f"/api/v1/soporte/siniestros/{caso['id']}"

    assert auth_as(en_curso["dueno"]).get("/api/v1/soporte/siniestros").status_code == 403
    bandeja = auth_as(agente).get("/api/v1/soporte/siniestros").json()
    assert [c["id"] for c in bandeja] == [caso["id"]]
    assert bandeja[0]["cliente_telefono"] is not None or bandeja[0]["cliente_nombre"]

    assert auth_as(agente).post(f"{base}/atender").json()["estado"] == "en_atencion"
    assert auth_as(agente).post(f"{base}/dueno-contactado").json()["dueno_contactado_en"]

    texto = "El taller Pérez revisará el auto el lunes; el presupuesto se envía a ambos."
    assert auth_as(agente).post(f"{base}/informar", json={"mensaje": texto}).status_code == 200
    for parte in (en_curso["cliente"], en_curso["dueno"]):
        assert any(n.mensaje == texto for n in _notificaciones(db_session, parte.id))

    # No se cierra sin decidir antes qué se cobra de la garantía (la disputa).
    cierre = {"mensaje": "Reparación cubierta con la garantía; caso terminado."}
    assert auth_as(agente).post(f"{base}/cerrar", json=cierre).status_code == 409
    disputa = db_session.get(Disputa, db_session.get(Siniestro, caso["id"]).disputa_id)
    disputa.estado = "resuelta"
    db_session.commit()
    cerrado = auth_as(agente).post(f"{base}/cerrar", json=cierre)
    assert cerrado.status_code == 200 and cerrado.json()["estado"] == "cerrado"
    assert [a["mensaje"] for a in cerrado.json()["actualizaciones"]][-1] == cierre["mensaje"]
    assert auth_as(agente).post(f"{base}/informar", json={"mensaje": "otra cosa más"}).status_code == 409
