"""
Orden e indexación de las fotos del auto al enrolarlo.

El móvil manda las 9 tomas guiadas en un orden fijo (frontal, trasera,
laterales, interiores, maletero, tablero, limpieza — ver FOTOS_AUTO). El
backend tiene que guardar ESA secuencia tal cual: la posición 0 es siempre
la frontal, la 1 la trasera, etc. No reordenar, no deduplicar, no dejar que
un slot vacío corra el resto.
"""
import pytest

from app.models.entities import Auto
from app.schemas.schemas import _validar_secuencia_fotos, MAX_FOTOS_AUTO

# URLs a propósito NO alfabéticas: si algo ordenara la lista, el test lo caza.
FOTOS = [
    "https://storage.test/9-frontal.jpg",
    "https://storage.test/1-trasera.jpg",
    "https://storage.test/5-lateral-izq.jpg",
    "https://storage.test/3-lateral-der.jpg",
    "https://storage.test/8-int-del.jpg",
    "https://storage.test/2-int-tra.jpg",
    "https://storage.test/7-maletero.jpg",
    "https://storage.test/4-tablero.jpg",
    "https://storage.test/6-limpieza.jpg",
]

PAYLOAD = {
    "marca": "Toyota",
    "modelo": "Yaris",
    "anio": 2021,
    "patente": "ORDN-01",
    "tarifa_dia": 40000,
    "ubicacion_base": "Los Angeles, Biobio",
    "gps_consentimiento": True,
    "doc_inscripcion_url": "https://storage.test/padron.jpg",
    "doc_permiso_circulacion_url": "https://storage.test/permiso.jpg",
    "doc_soap_url": "https://storage.test/soap.jpg",
    "doc_revision_tecnica_url": "https://storage.test/revtec.jpg",
}


def _publicar(auth_as, usuario_factory, fotos, patente="ORDN-01"):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    return auth_as(dueno).post("/api/v1/autos", json={**PAYLOAD, "patente": patente, "fotos": fotos})


# --------------------------------------------------------------------------- #
# _validar_secuencia_fotos (unidad)
# --------------------------------------------------------------------------- #
def test_helper_conserva_orden_y_elementos():
    assert _validar_secuencia_fotos(FOTOS) == FOTOS
    assert _validar_secuencia_fotos(["b", "a", "b"]) == ["b", "a", "b"]  # ni orden ni dedupe


def test_helper_recorta_espacios_sin_mover_nada():
    assert _validar_secuencia_fotos(["  x ", "y"]) == ["x", "y"]


@pytest.mark.parametrize("mala", [["ok", "", "ok2"], ["ok", "   ", "ok2"], ["ok", None, "ok2"]])
def test_helper_rechaza_slot_vacio(mala):
    with pytest.raises(ValueError):
        _validar_secuencia_fotos(mala)


def test_helper_tope_de_cantidad():
    with pytest.raises(ValueError):
        _validar_secuencia_fotos([f"u{i}" for i in range(MAX_FOTOS_AUTO + 1)])


# --------------------------------------------------------------------------- #
# POST /autos — la secuencia se guarda verbatim
# --------------------------------------------------------------------------- #
def test_post_autos_guarda_las_fotos_en_el_orden_enviado(auth_as, usuario_factory, db_session):
    resp = _publicar(auth_as, usuario_factory, FOTOS)
    assert resp.status_code == 200, resp.text
    assert resp.json()["fotos"] == FOTOS

    auto = db_session.query(Auto).filter(Auto.patente == "ORDN-01").first()
    assert auto.fotos == FOTOS  # en disco, mismo orden


def test_post_autos_no_reordena_una_lista_invertida(auth_as, usuario_factory, db_session):
    invertida = list(reversed(FOTOS))
    resp = _publicar(auth_as, usuario_factory, invertida, patente="ORDN-02")
    assert resp.status_code == 200, resp.text

    auto = db_session.query(Auto).filter(Auto.patente == "ORDN-02").first()
    assert auto.fotos == invertida
    assert auto.fotos != FOTOS


def test_post_autos_conserva_urls_repetidas(auth_as, usuario_factory, db_session):
    con_dup = [FOTOS[0], FOTOS[0], FOTOS[1]]
    resp = _publicar(auth_as, usuario_factory, con_dup, patente="ORDN-03")
    assert resp.status_code == 200, resp.text

    auto = db_session.query(Auto).filter(Auto.patente == "ORDN-03").first()
    assert auto.fotos == con_dup  # no se deduplica: la posición importa


def test_post_autos_rechaza_slot_vacio(auth_as, usuario_factory):
    resp = _publicar(auth_as, usuario_factory, [FOTOS[0], "", FOTOS[2]], patente="ORDN-04")
    assert resp.status_code == 422
    assert "posición 1" in resp.text


# --------------------------------------------------------------------------- #
# PATCH /autos/{id} — reemplazar el set también respeta el orden
# --------------------------------------------------------------------------- #
def test_patch_reemplaza_fotos_en_el_orden_enviado(auth_as, usuario_factory, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    cli = auth_as(dueno)
    creado = cli.post("/api/v1/autos", json={**PAYLOAD, "patente": "ORDN-05", "fotos": FOTOS})
    assert creado.status_code == 200, creado.text
    auto_id = creado.json()["id"]

    nuevo_orden = [FOTOS[3], FOTOS[0], FOTOS[7]]
    resp = cli.patch(f"/api/v1/autos/{auto_id}", json={"fotos": nuevo_orden})
    assert resp.status_code == 200, resp.text

    db_session.expire_all()
    auto = db_session.query(Auto).filter(Auto.id == auto_id).first()
    assert auto.fotos == nuevo_orden
