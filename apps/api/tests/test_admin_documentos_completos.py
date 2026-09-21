"""
El panel de admin tiene que recibir TODOS los documentos e imágenes de lo que revisa.

Hallazgos de la revisión (2026-09-20):
  · `/admin/documentos/pendientes` devolvía un `UserOut` que no trae `carnet_frontal_url`,
    `carnet_trasero_url` ni `licencia_url`: el frente y el reverso de la cédula y la licencia
    nunca llegaban al visor.
  · `/admin/autos/documentos-pendientes` no armaba `doc_historial_vehicular_url` (el campo existía
    en el esquema pero no se rellenaba) y no traía las anotaciones ni el estado del encargo por robo.
  · Las URLs firmadas de los buckets privados caducan a los 7 días; solo se renovaban las
    fotos de perfil. Las de carnet, licencia, documentos del auto y evidencias de disputas quedaban
    caducadas y la imagen "no llegaba".
  · El segundo conductor no tenía ningún camino de revisión en el panel.
"""
from datetime import datetime, timedelta

import pytest

from app.features.system.storage.service import StorageService
from app.models.entities import Auto, ConductorAdicional, Disputa, Notificacion, Reserva


@pytest.fixture(autouse=True)
def firmas_caducadas(monkeypatch):
    """Toda URL de `https://x/` se considera a punto de caducar y se re-firma con `?r=1`."""
    def renovar(cls, url, margen_horas=24):
        return f"{url}?r=1" if url and url.startswith("https://x/") and "?r=1" not in url else url

    monkeypatch.setattr(StorageService, "renovar_si_vence_pronto", classmethod(renovar))


@pytest.fixture
def admin(usuario_factory):
    return usuario_factory(roles_activos=["admin"])


# ===========================================================================
# Identidad y licencia
# ===========================================================================
def _usuario_con_documentos(usuario_factory, db_session):
    u = usuario_factory(roles_activos=["cliente"], estado_documentos="requiere_revision_manual")
    u.carnet_frontal_url = "https://x/frente.jpg"
    u.carnet_trasero_url = "https://x/dorso.jpg"
    u.licencia_url = "https://x/licencia.jpg"
    u.pic_url = "https://x/pic.jpg"
    u.foto_perfil_verificada_url = "https://x/selfie.jpg"
    u.licencia_numero = "LIC-123"
    u.licencia_clase = "B"
    u.licencia_vencimiento = datetime(2028, 1, 1)
    u.fecha_nacimiento = datetime(1990, 5, 17)
    u.antecedentes_estado = "revision"
    db_session.commit()
    return u


def _pendiente(auth_as, admin, usuario_id):
    filas = auth_as(admin).get("/api/v1/admin/documentos/pendientes").json()
    return next(f for f in filas if f["id"] == usuario_id)


def test_llegan_el_frente_el_reverso_y_la_licencia(usuario_factory, auth_as, db_session, admin):
    u = _usuario_con_documentos(usuario_factory, db_session)

    fila = _pendiente(auth_as, admin, u.id)

    assert fila["carnet_frontal_url"].startswith("https://x/frente.jpg")
    assert fila["carnet_trasero_url"].startswith("https://x/dorso.jpg")
    assert fila["licencia_url"].startswith("https://x/licencia.jpg")
    assert fila["pic_url"].startswith("https://x/pic.jpg")


def test_llegan_los_datos_para_cotejar_los_documentos(usuario_factory, auth_as, db_session, admin):
    u = _usuario_con_documentos(usuario_factory, db_session)

    fila = _pendiente(auth_as, admin, u.id)

    assert fila["licencia_numero"] == "LIC-123"
    assert fila["licencia_clase"] == "B"
    assert fila["licencia_vencimiento"].startswith("2028-01-01")
    assert fila["fecha_nacimiento"].startswith("1990-05-17")
    assert fila["antecedentes_estado"] == "revision"


def test_las_urls_firmadas_de_todos_los_documentos_se_renuevan(usuario_factory, auth_as, db_session, admin):
    u = _usuario_con_documentos(usuario_factory, db_session)

    fila = _pendiente(auth_as, admin, u.id)

    for campo in ("carnet_frontal_url", "carnet_trasero_url", "licencia_url", "pic_url", "foto_perfil_verificada_url"):
        assert fila[campo].endswith("?r=1"), f"{campo} no se renovó"
    db_session.refresh(u)
    assert u.carnet_frontal_url.endswith("?r=1") and u.licencia_url.endswith("?r=1")


def test_un_manager_tambien_recibe_los_documentos(usuario_factory, auth_as, db_session):
    manager = usuario_factory(roles_activos=["manager"])
    u = _usuario_con_documentos(usuario_factory, db_session)

    fila = _pendiente(auth_as, manager, u.id)

    assert fila["carnet_frontal_url"]


# ===========================================================================
# Autos
# ===========================================================================
@pytest.fixture
def auto_pendiente(usuario_factory, db_session):
    dueno = usuario_factory(roles_activos=["dueno"])
    a = Auto(dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022, patente="KLPW-88", tarifa_dia=20000,
             estado="activo", ubicacion_base="Los Ángeles", documentos_verificados=False,
             fotos=["https://x/foto1.jpg", "https://x/foto2.jpg"],
             doc_inscripcion_url="https://x/padron.jpg", doc_permiso_circulacion_url="https://x/permiso.jpg",
             doc_soap_url="https://x/soap.jpg", doc_revision_tecnica_url="https://x/rt.jpg",
             doc_certificado_gases_url="https://x/gases.jpg", doc_historial_vehicular_url="https://x/hist.jpg",
             doc_seguro_url="https://x/seguro.jpg", doc_anotaciones_vigentes_url="https://x/anot.pdf",
             encargo_robo_estado="sin_encargo")
    db_session.add(a)
    db_session.commit()
    return a


def _auto_en_cola(auth_as, admin, auto_id):
    filas = auth_as(admin).get("/api/v1/admin/autos/documentos-pendientes").json()
    return next(f for f in filas if f["id"] == auto_id)


def test_llegan_todos_los_documentos_del_auto(auth_as, admin, auto_pendiente):
    fila = _auto_en_cola(auth_as, admin, auto_pendiente.id)

    for campo in ("doc_inscripcion_url", "doc_permiso_circulacion_url", "doc_soap_url",
                  "doc_revision_tecnica_url", "doc_certificado_gases_url", "doc_historial_vehicular_url",
                  "doc_seguro_url", "doc_anotaciones_vigentes_url"):
        assert fila[campo], f"{campo} no llegó"


def test_llega_el_estado_del_encargo_por_robo(auth_as, admin, auto_pendiente):
    fila = _auto_en_cola(auth_as, admin, auto_pendiente.id)

    assert fila["encargo_robo_estado"] == "sin_encargo"
    assert "anotaciones_aprobadas_en" in fila


def test_las_urls_del_auto_y_sus_fotos_se_renuevan(auth_as, admin, auto_pendiente, db_session):
    fila = _auto_en_cola(auth_as, admin, auto_pendiente.id)

    assert fila["doc_soap_url"].endswith("?r=1")
    assert fila["doc_historial_vehicular_url"].endswith("?r=1")
    assert all(f.endswith("?r=1") for f in fila["fotos"])
    db_session.refresh(auto_pendiente)
    assert auto_pendiente.doc_soap_url.endswith("?r=1")
    assert all(f.endswith("?r=1") for f in auto_pendiente.fotos)


def test_renovar_no_corrompe_las_urls_que_no_caducan(auth_as, admin, auto_pendiente, db_session):
    auto_pendiente.fotos = ["https://otro-dominio/foto.jpg"]
    db_session.commit()

    fila = _auto_en_cola(auth_as, admin, auto_pendiente.id)

    assert fila["fotos"] == ["https://otro-dominio/foto.jpg"]


# ===========================================================================
# Disputas
# ===========================================================================
def test_las_evidencias_de_una_disputa_se_renuevan(usuario_factory, auth_as, db_session, admin):
    reserva = db_session.query(Reserva).first()
    d = Disputa(reserva_id=reserva.id, tipo="dano", estado="abierta", motivo="Rayón",
                foto_evidencia_url="https://x/e1.jpg", evidencia_fotos=["https://x/e2.jpg", "https://x/e3.jpg"])
    db_session.add(d)
    db_session.commit()

    lista = auth_as(admin).get("/api/v1/disputas").json()
    detalle = auth_as(admin).get(f"/api/v1/disputas/{d.id}").json()

    fila = next(x for x in lista if x["id"] == d.id)
    assert fila["foto_evidencia_url"].endswith("?r=1")
    assert all(u.endswith("?r=1") for u in fila["evidencia_fotos"])
    assert detalle["foto_evidencia_url"].endswith("?r=1")


# ===========================================================================
# Segundo conductor
# ===========================================================================
@pytest.fixture
def conductor_en_revision(usuario_factory, db_session):
    dueno = usuario_factory(roles_activos=["dueno"])
    titular = usuario_factory(roles_activos=["cliente"], nombre="Titular Uno")
    auto = Auto(dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022, patente="KLPW-88",
                tarifa_dia=20000, estado="activo", ubicacion_base="Los Ángeles")
    db_session.add(auto)
    db_session.commit()
    reserva = Reserva(auto_id=auto.id, cliente_id=titular.id, estado="confirmada",
                      fecha_inicio=datetime.utcnow() + timedelta(days=3),
                      fecha_fin=datetime.utcnow() + timedelta(days=5), lugar_entrega_acordado="Plaza")
    db_session.add(reserva)
    db_session.commit()
    c = ConductorAdicional(
        reserva_id=reserva.id, nombre="Segundo Conductor", rut="16.789.012-1", estado_kyc="requiere_revision_manual",
        carnet_frontal_url="https://x/c-frente.jpg", carnet_trasero_url="https://x/c-dorso.jpg",
        licencia_url="https://x/c-lic.jpg", selfie_url="https://x/c-selfie.jpg",
        licencia_clase="B", licencia_vencimiento=datetime(2028, 1, 1), confianza_ocr=0.6,
        notas_auditoria="Foto borrosa", antecedentes_estado="pendiente",
    )
    db_session.add(c)
    db_session.commit()
    return titular, reserva, c


def test_el_segundo_conductor_en_revision_llega_al_panel_con_todas_sus_imagenes(
    auth_as, admin, conductor_en_revision
):
    titular, reserva, c = conductor_en_revision

    filas = auth_as(admin).get("/api/v1/admin/conductores/pendientes").json()

    fila = next(f for f in filas if f["id"] == c.id)
    for campo in ("carnet_frontal_url", "carnet_trasero_url", "licencia_url", "selfie_url"):
        assert fila[campo].endswith("?r=1"), campo
    assert fila["nombre"] == "Segundo Conductor"
    assert fila["titular_nombre"] == "Titular Uno"
    assert fila["patente"] == "KLPW-88"
    assert fila["confianza_ocr"] == 0.6
    assert fila["notas_auditoria"] == "Foto borrosa"


def test_un_conductor_ya_verificado_no_esta_en_la_cola(auth_as, admin, conductor_en_revision, db_session):
    _, _, c = conductor_en_revision
    c.estado_kyc = "verificado"
    db_session.commit()

    filas = auth_as(admin).get("/api/v1/admin/conductores/pendientes").json()

    assert all(f["id"] != c.id for f in filas)


def test_la_cola_de_conductores_es_solo_para_ejecutivos(auth_as, usuario_factory, conductor_en_revision):
    cliente = usuario_factory(roles_activos=["cliente"])

    assert auth_as(cliente).get("/api/v1/admin/conductores/pendientes").status_code == 403


def test_aprobar_al_conductor_lo_deja_verificado_y_avisa_al_titular(
    auth_as, admin, conductor_en_revision, db_session
):
    titular, _, c = conductor_en_revision

    resp = auth_as(admin).post(f"/api/v1/admin/conductores/{c.id}/revisar", json={"accion": "aprobar", "notas": "ok"})

    assert resp.status_code == 200, resp.text
    db_session.refresh(c)
    assert c.estado_kyc == "verificado"
    assert any(n.usuario_id == titular.id for n in db_session.query(Notificacion))


def test_rechazar_al_conductor(auth_as, admin, conductor_en_revision, db_session):
    _, _, c = conductor_en_revision

    resp = auth_as(admin).post(
        f"/api/v1/admin/conductores/{c.id}/revisar", json={"accion": "rechazar", "notas": "Licencia ilegible"}
    )

    assert resp.status_code == 200
    db_session.refresh(c)
    assert c.estado_kyc == "rechazado"
    assert "Licencia ilegible" in c.notas_auditoria


def test_solo_el_admin_resuelve_al_conductor(auth_as, usuario_factory, conductor_en_revision):
    _, _, c = conductor_en_revision
    manager = usuario_factory(roles_activos=["manager"])

    resp = auth_as(manager).post(f"/api/v1/admin/conductores/{c.id}/revisar", json={"accion": "aprobar"})

    assert resp.status_code == 403


def test_un_conductor_inexistente_da_404(auth_as, admin):
    assert auth_as(admin).post("/api/v1/admin/conductores/no-existe/revisar", json={"accion": "aprobar"}).status_code == 404
