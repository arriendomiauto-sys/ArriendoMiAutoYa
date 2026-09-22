"""
Verificación de autos con documentos oficiales gratuitos:

  · el dueño sube el Certificado de anotaciones vigentes (PDF del Registro Civil): patente,
    titular, prohibiciones. Un ejecutivo confirma el código de verificación.
  · el ejecutivo consulta el encargo por robo en autoseguro.gob.cl (no tiene API pública, por
    eso es manual) y registra el resultado.
  · con AUTOS_VERIFICADOS_OBLIGATORIOS un auto sin verificar no se ofrece ni se puede reservar.
    Hoy un auto con `documentos_verificados=False` queda visible y reservable.
"""
import io
from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.features.auth.background_checks import certificados_service as svc
from app.models.entities import Auto

RUT_DUENO = "20.222.333-8"


def _fecha(dias_atras=3):
    return (datetime.now(timezone.utc) - timedelta(days=dias_atras)).strftime("%d/%m/%Y")


def _pdf(lineas):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    y = 800
    for linea in lineas:
        c.drawString(50, y, linea)
        y -= 18
    c.save()
    return buf.getvalue()


def pdf_anotaciones(patente="KLPW-88", rut=RUT_DUENO, cuerpo="SIN ANOTACIONES VIGENTES"):
    return _pdf(["CERTIFICADO DE ANOTACIONES VIGENTES", f"PPU: {patente}", f"Propietario RUN {rut}",
                 f"Fecha de emision: {_fecha()}", cuerpo, "Folio: 700009998887", "Codigo de verificacion: 1aB2c3D4e5F6"])


@pytest.fixture(autouse=True)
def almacenamiento(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "STORAGE_LOCAL_DIR", str(tmp_path / "publico"))
    monkeypatch.setattr(settings, "STORAGE_LOCAL_PRIVATE_DIR", str(tmp_path / "privado"))
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "your-placeholder")


@pytest.fixture
def dueno(usuario_factory):
    return usuario_factory(roles_activos=["dueno"], rut=RUT_DUENO, estado_documentos="verificado")


@pytest.fixture
def admin(usuario_factory):
    return usuario_factory(roles_activos=["admin"], rut="20.333.444-3")


@pytest.fixture
def auto(db_session, dueno):
    a = Auto(dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022, patente="KLPW-88", tarifa_dia=20000,
             estado="activo", ubicacion_base="Los Ángeles", categoria="economico", documentos_verificados=True)
    db_session.add(a)
    db_session.commit()
    return a


def _subir(auth_as, usuario, auto, pdf=None):
    return auth_as(usuario).post(
        f"/api/v1/autos/{auto.id}/certificado-anotaciones",
        files={"archivo": ("c.pdf", pdf if pdf is not None else pdf_anotaciones(), "application/pdf")},
        data={"consentimiento": "true"},
    )


def _revisar(auth_as, admin, cid, accion="aprobar"):
    return auth_as(admin).post(f"/api/v1/admin/antecedentes/{cid}/revisar", json={"accion": accion, "notas": "CVE ok"})


def _encargo(auth_as, admin, auto, resultado="sin_encargo"):
    return auth_as(admin).post(f"/api/v1/admin/autos/{auto.id}/encargo-robo", json={"resultado": resultado, "notas": "consulta"})


def _verificar_todo(auth_as, dueno, admin, auto):
    cid = _subir(auth_as, dueno, auto).json()["id"]
    _revisar(auth_as, admin, cid)
    _encargo(auth_as, admin, auto)


# ===========================================================================
# Certificado de anotaciones
# ===========================================================================
def test_el_dueno_sube_el_certificado_de_su_auto(auth_as, dueno, auto, db_session):
    resp = _subir(auth_as, dueno, auto)

    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "revision"
    db_session.refresh(auto)
    assert auto.doc_anotaciones_vigentes_url
    assert auto.anotaciones_aprobadas_en is None


def test_solo_el_dueno_sube_el_certificado(auth_as, usuario_factory, auto):
    otro = usuario_factory(roles_activos=["dueno"], rut="11.111.111-1", estado_documentos="verificado")

    assert _subir(auth_as, otro, auto).status_code == 403


def test_un_auto_inexistente_da_404(auth_as, dueno):
    resp = auth_as(dueno).post(
        "/api/v1/autos/no-existe/certificado-anotaciones",
        files={"archivo": ("c.pdf", pdf_anotaciones(), "application/pdf")}, data={"consentimiento": "true"},
    )

    assert resp.status_code == 404


def test_un_certificado_de_otra_patente_se_rechaza(auth_as, dueno, auto):
    resp = _subir(auth_as, dueno, auto, pdf=pdf_anotaciones(patente="ABCD-12"))

    assert resp.json()["estado"] == "rechazado"
    assert "patente" in resp.json()["motivo"].lower()


def test_un_titular_distinto_al_dueno_va_a_revision_con_el_aviso(auth_as, dueno, auto, admin):
    resp = _subir(auth_as, dueno, auto, pdf=pdf_anotaciones(rut="11.111.111-1"))

    assert resp.json()["estado"] == "revision"
    cola = auth_as(admin).get("/api/v1/admin/antecedentes/pendientes").json()
    assert "titular" in cola[0]["motivo"].lower()
    assert cola[0]["contenido_ok"] is False
    assert cola[0]["sujeto_detalle"] == "KLPW-88"


def test_al_aprobar_el_auto_queda_con_las_anotaciones_aprobadas(auth_as, dueno, auto, admin, db_session):
    cid = _subir(auth_as, dueno, auto).json()["id"]

    assert _revisar(auth_as, admin, cid).status_code == 200

    db_session.refresh(auto)
    assert auto.anotaciones_aprobadas_en is not None


def test_al_subir_uno_nuevo_se_pierde_la_aprobacion_anterior(auth_as, dueno, auto, admin, db_session):
    cid = _subir(auth_as, dueno, auto).json()["id"]
    _revisar(auth_as, admin, cid)

    _subir(auth_as, dueno, auto)

    db_session.refresh(auto)
    assert auto.anotaciones_aprobadas_en is None


# ===========================================================================
# Encargo por robo (consulta manual en AutoSeguro)
# ===========================================================================
def test_el_admin_registra_el_resultado_de_autoseguro(auth_as, admin, auto, db_session):
    resp = _encargo(auth_as, admin, auto, "sin_encargo")

    assert resp.status_code == 200, resp.text
    db_session.refresh(auto)
    assert auto.encargo_robo_estado == "sin_encargo"
    assert auto.encargo_robo_consultado_por == admin.id
    assert auto.encargo_robo_consultado_en is not None


def test_solo_el_admin_registra_el_encargo(auth_as, usuario_factory, dueno, auto):
    manager = usuario_factory(roles_activos=["manager"])

    assert _encargo(auth_as, manager, auto).status_code == 403
    assert _encargo(auth_as, dueno, auto).status_code == 403


def test_un_resultado_invalido_da_422(auth_as, admin, auto):
    assert _encargo(auth_as, admin, auto, "quiza").status_code == 422


def test_un_auto_con_encargo_por_robo_queda_pausado(auth_as, admin, auto, db_session):
    _encargo(auth_as, admin, auto, "con_encargo")

    db_session.refresh(auto)
    assert auto.encargo_robo_estado == "con_encargo"
    assert auto.estado == "pausado"


# ===========================================================================
# Verificación completa
# ===========================================================================
def test_un_auto_verificado_exige_las_tres_cosas(auth_as, dueno, admin, auto, db_session):
    assert svc.auto_esta_verificado(auto) is False

    cid = _subir(auth_as, dueno, auto).json()["id"]
    _revisar(auth_as, admin, cid)
    db_session.refresh(auto)
    assert svc.auto_esta_verificado(auto) is False  # falta la consulta de robo

    _encargo(auth_as, admin, auto)
    db_session.refresh(auto)
    assert svc.auto_esta_verificado(auto) is True


def test_sin_documentos_verificados_el_auto_no_esta_verificado(auth_as, dueno, admin, auto, db_session):
    _verificar_todo(auth_as, dueno, admin, auto)
    auto.documentos_verificados = False
    db_session.commit()

    assert svc.auto_esta_verificado(auto) is False


def test_la_verificacion_vence(auth_as, dueno, admin, auto, db_session):
    _verificar_todo(auth_as, dueno, admin, auto)
    db_session.refresh(auto)
    futuro = datetime.now(timezone.utc) + timedelta(days=settings.ANTECEDENTES_REVERIFICACION_DIAS + 1)

    assert svc.auto_esta_verificado(auto, ahora=futuro) is False


# ===========================================================================
# Catálogo y reserva
# ===========================================================================
def _ids(auth_as, usuario):
    return {a["id"] for a in auth_as(usuario).get("/api/v1/autos").json()}


def _reservar(auth_as, cliente, auto):
    f = lambda d: (datetime.utcnow() + timedelta(days=d)).strftime("%Y-%m-%dT10:00:00")
    return auth_as(cliente).post("/api/v1/reservas", json={
        "auto_id": auto.id, "fecha_inicio": f(30), "fecha_fin": f(33), "lugar_entrega_acordado": "Plaza de Armas"})


@pytest.fixture
def cliente(usuario_factory):
    return usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")


def test_con_el_bloqueo_apagado_un_auto_sin_verificar_se_ve_y_se_reserva(auth_as, cliente, auto, monkeypatch):
    monkeypatch.setattr(settings, "AUTOS_VERIFICADOS_OBLIGATORIOS", False)

    assert auto.id in _ids(auth_as, cliente)
    assert _reservar(auth_as, cliente, auto).status_code in (200, 201)


def test_con_el_bloqueo_encendido_un_auto_sin_verificar_no_se_ofrece_ni_se_reserva(auth_as, cliente, auto, monkeypatch):
    monkeypatch.setattr(settings, "AUTOS_VERIFICADOS_OBLIGATORIOS", True)

    assert auto.id not in _ids(auth_as, cliente)
    resp = _reservar(auth_as, cliente, auto)
    assert resp.status_code == 400
    assert "disponible" in resp.json()["detail"].lower()


def test_con_el_bloqueo_encendido_un_auto_verificado_si_se_ve_y_se_reserva(
    auth_as, dueno, admin, cliente, auto, monkeypatch
):
    monkeypatch.setattr(settings, "AUTOS_VERIFICADOS_OBLIGATORIOS", True)
    _verificar_todo(auth_as, dueno, admin, auto)

    assert auto.id in _ids(auth_as, cliente)
    assert _reservar(auth_as, cliente, auto).status_code in (200, 201)


def test_el_dueno_sigue_viendo_su_auto_sin_verificar_en_su_flota(auth_as, dueno, auto, monkeypatch):
    monkeypatch.setattr(settings, "AUTOS_VERIFICADOS_OBLIGATORIOS", True)

    mios = {a["id"] for a in auth_as(dueno).get("/api/v1/autos/mios").json()}

    assert auto.id in mios


def test_auto_sin_documentos_verificados_no_se_puede_activar(auth_as, dueno, auto, db_session):
    auto.documentos_verificados = False
    auto.estado = "pendiente"
    db_session.commit()

    resp = auth_as(dueno).patch(f"/api/v1/autos/{auto.id}", json={"estado": "activo"})
    assert resp.status_code == 400
    assert "documentos aún no han sido verificados" in resp.json()["detail"]


def test_reemplazar_documentos_auto_lo_devuelve_a_pendiente(auth_as, dueno, auto, db_session):
    auto.documentos_verificados = True
    auto.estado = "activo"
    db_session.commit()

    resp = auth_as(dueno).patch(
        f"/api/v1/autos/{auto.id}",
        json={"doc_permiso_circulacion_url": "https://ejemplo.com/nuevo_permiso.jpg"}
    )
    assert resp.status_code == 200
    db_session.refresh(auto)
    assert auto.documentos_verificados is False
    assert auto.estado == "pendiente"

