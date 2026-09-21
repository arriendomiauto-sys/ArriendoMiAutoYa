"""
Endpoints de la verificación de antecedentes:

  · POST /antecedentes/certificados      la persona sube su PDF (recibe el archivo, no una URL)
  · GET  /antecedentes/mi-estado         su estado y el de cada documento
  · POST /reservas/{id}/segundo-conductor/certificados   el titular sube por su segundo conductor
  · GET  /admin/antecedentes/pendientes  cola del ejecutivo
  · POST /admin/antecedentes/{id}/revisar
  · crear_reserva exige antecedentes "limpio" cuando ANTECEDENTES_OBLIGATORIOS está activo
"""
import io
from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.models.entities import Auto, CertificadoAntecedente, ConductorAdicional, Reserva

RUT = "11.111.111-1"


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


def pdf_antecedentes(rut=RUT):
    return _pdf(["CERTIFICADO DE ANTECEDENTES", f"RUN: {rut}", f"Fecha de emision: {_fecha()}",
                 "NO REGISTRA ANTECEDENTES", "Folio: 500004443232", "Codigo de verificacion: 2rR4t56Cv332"])


def pdf_hoja_vida(rut=RUT):
    return _pdf(["CERTIFICADO HOJA DE VIDA DEL CONDUCTOR", f"RUN: {rut}", f"Fecha de emision: {_fecha()}",
                 "NO REGISTRA ANOTACIONES", "Folio: 600001112223", "Codigo de verificacion: 9xY8w7Vu6T5s"])


@pytest.fixture(autouse=True)
def almacenamiento(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "STORAGE_LOCAL_DIR", str(tmp_path / "publico"))
    monkeypatch.setattr(settings, "STORAGE_LOCAL_PRIVATE_DIR", str(tmp_path / "privado"))
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "your-placeholder")


@pytest.fixture
def persona(usuario_factory):
    return usuario_factory(roles_activos=["cliente"], rut=RUT, estado_documentos="verificado")


@pytest.fixture
def admin(usuario_factory):
    return usuario_factory(roles_activos=["admin"], rut="20.333.444-3")


def _subir(auth_as, usuario, tipo="antecedentes", pdf=None, consentimiento="true", nombre="c.pdf"):
    pdf = pdf if pdf is not None else pdf_antecedentes()
    return auth_as(usuario).post(
        "/api/v1/antecedentes/certificados",
        files={"archivo": (nombre, pdf, "application/pdf")},
        data={"tipo": tipo, "consentimiento": consentimiento},
    )


# ===========================================================================
# Subida
# ===========================================================================
def test_subir_exige_sesion(client):
    resp = client.post(
        "/api/v1/antecedentes/certificados",
        files={"archivo": ("c.pdf", pdf_antecedentes(), "application/pdf")},
        data={"tipo": "antecedentes", "consentimiento": "true"},
    )

    assert resp.status_code == 401


def test_subir_un_certificado_valido_lo_deja_en_revision_y_lo_guarda_en_privado(
    auth_as, persona, db_session, tmp_path
):
    resp = _subir(auth_as, persona)

    assert resp.status_code == 200, resp.text
    cuerpo = resp.json()
    assert cuerpo["estado"] == "revision"
    assert cuerpo["tipo"] == "antecedentes"
    fila = db_session.get(CertificadoAntecedente, cuerpo["id"])
    assert fila.subido_por_id == persona.id
    assert "/storage/local/documentos-kyc/" in fila.archivo_url
    assert list((tmp_path / "privado" / "documentos-kyc").glob("*.pdf"))
    db_session.refresh(persona)
    assert persona.antecedentes_estado == "revision"


def test_subir_sin_consentimiento_da_400(auth_as, persona, db_session):
    resp = _subir(auth_as, persona, consentimiento="false")

    assert resp.status_code == 400
    assert resp.json()["detail"]["codigo"] == "CONSENTIMIENTO_REQUERIDO"
    assert db_session.query(CertificadoAntecedente).count() == 0


def test_subir_exige_identidad_verificada(auth_as, usuario_factory):
    sin_kyc = usuario_factory(roles_activos=["cliente"], rut=None, estado_documentos="pendiente")

    resp = _subir(auth_as, sin_kyc)

    assert resp.status_code == 403


def test_subir_algo_que_no_es_pdf_da_400(auth_as, persona):
    resp = _subir(auth_as, persona, pdf=b"\xff\xd8\xff esto es una foto", nombre="foto.pdf")

    assert resp.status_code == 400


def test_subir_un_pdf_con_javascript_da_400(auth_as, persona):
    resp = _subir(auth_as, persona, pdf=pdf_antecedentes() + b"\n<< /JavaScript (app.alert(1)) >>")

    assert resp.status_code == 400


def test_el_certificado_de_otra_persona_vuelve_rechazado_con_el_motivo(auth_as, persona):
    resp = _subir(auth_as, persona, pdf=pdf_antecedentes(rut="20.222.333-8"))

    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "rechazado"
    assert "otra persona" in resp.json()["motivo"].lower()


def test_un_tipo_desconocido_da_422(auth_as, persona):
    resp = _subir(auth_as, persona, tipo="lo_que_sea")

    assert resp.status_code == 422


def test_no_se_puede_subir_anotaciones_de_auto_como_persona(auth_as, persona):
    resp = _subir(auth_as, persona, tipo="anotaciones_vigentes")

    assert resp.status_code in (400, 422)


# ===========================================================================
# mi-estado
# ===========================================================================
def test_mi_estado_al_inicio_es_pendiente_con_los_dos_documentos_sin_subir(auth_as, persona):
    resp = auth_as(persona).get("/api/v1/antecedentes/mi-estado")

    assert resp.status_code == 200
    datos = resp.json()
    assert datos["estado"] == "pendiente"
    assert {d["tipo"]: d["estado"] for d in datos["documentos"]} == {
        "antecedentes": "sin_subir", "hoja_vida": "sin_subir",
    }


def test_mi_estado_refleja_lo_subido_y_solo_lo_mio(auth_as, persona, usuario_factory):
    _subir(auth_as, persona)
    otra = usuario_factory(roles_activos=["cliente"], rut="20.222.333-8", estado_documentos="verificado")

    mio = auth_as(persona).get("/api/v1/antecedentes/mi-estado").json()
    ajeno = auth_as(otra).get("/api/v1/antecedentes/mi-estado").json()

    assert {d["tipo"]: d["estado"] for d in mio["documentos"]}["antecedentes"] == "revision"
    assert {d["tipo"]: d["estado"] for d in ajeno["documentos"]}["antecedentes"] == "sin_subir"


def test_mi_estado_no_expone_el_folio_ni_el_codigo(auth_as, persona):
    _subir(auth_as, persona)

    cuerpo = auth_as(persona).get("/api/v1/antecedentes/mi-estado").text

    assert "500004443232" not in cuerpo and "2rR4t56Cv332" not in cuerpo


# ===========================================================================
# Admin
# ===========================================================================
def test_la_cola_es_solo_para_ejecutivos(auth_as, persona):
    assert auth_as(persona).get("/api/v1/admin/antecedentes/pendientes").status_code == 403


def test_la_cola_lista_lo_que_espera_revision_con_el_codigo_para_confirmar(auth_as, persona, admin):
    _subir(auth_as, persona)
    _subir(auth_as, persona, pdf=pdf_antecedentes(rut="20.222.333-8"))  # rechazado: no va a la cola

    resp = auth_as(admin).get("/api/v1/admin/antecedentes/pendientes")

    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["folio"] == "500004443232"
    assert items[0]["codigo_verificacion"] == "2rR4t56Cv332"
    assert items[0]["contenido_ok"] is True
    assert items[0]["sujeto_nombre"] == persona.nombre


def test_un_manager_ve_la_cola_pero_no_resuelve(auth_as, persona, usuario_factory):
    manager = usuario_factory(roles_activos=["manager"])
    cid = _subir(auth_as, persona).json()["id"]

    assert auth_as(manager).get("/api/v1/admin/antecedentes/pendientes").status_code == 200
    resp = auth_as(manager).post(f"/api/v1/admin/antecedentes/{cid}/revisar", json={"accion": "aprobar"})
    assert resp.status_code == 403


def test_aprobar_los_dos_deja_al_usuario_limpio(auth_as, persona, admin, db_session):
    a = _subir(auth_as, persona, "antecedentes", pdf_antecedentes()).json()["id"]
    h = _subir(auth_as, persona, "hoja_vida", pdf_hoja_vida()).json()["id"]

    for cid in (a, h):
        resp = auth_as(admin).post(
            f"/api/v1/admin/antecedentes/{cid}/revisar", json={"accion": "aprobar", "notas": "CVE confirmado"}
        )
        assert resp.status_code == 200, resp.text

    db_session.refresh(persona)
    assert persona.antecedentes_estado == "limpio"


def test_resolver_dos_veces_da_409(auth_as, persona, admin):
    cid = _subir(auth_as, persona).json()["id"]
    auth_as(admin).post(f"/api/v1/admin/antecedentes/{cid}/revisar", json={"accion": "aprobar"})

    resp = auth_as(admin).post(f"/api/v1/admin/antecedentes/{cid}/revisar", json={"accion": "aprobar"})

    assert resp.status_code == 409


def test_una_accion_invalida_da_422(auth_as, persona, admin):
    cid = _subir(auth_as, persona).json()["id"]

    resp = auth_as(admin).post(f"/api/v1/admin/antecedentes/{cid}/revisar", json={"accion": "quiza"})

    assert resp.status_code == 422


# ===========================================================================
# Segundo conductor
# ===========================================================================
@pytest.fixture
def reserva_con_conductor(usuario_factory, db_session):
    dueno = usuario_factory(roles_activos=["dueno"])
    titular = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    auto = Auto(dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022, patente="KLPW-88",
                tarifa_dia=20000, estado="activo", ubicacion_base="Los Ángeles")
    db_session.add(auto)
    db_session.commit()
    reserva = Reserva(auto_id=auto.id, cliente_id=titular.id, estado="confirmada",
                      fecha_inicio=datetime.utcnow() + timedelta(days=3),
                      fecha_fin=datetime.utcnow() + timedelta(days=5), lugar_entrega_acordado="Plaza")
    db_session.add(reserva)
    db_session.commit()
    conductor = ConductorAdicional(reserva_id=reserva.id, nombre="Segundo Conductor", rut=RUT, estado_kyc="verificado")
    db_session.add(conductor)
    db_session.commit()
    return titular, reserva, conductor


def _subir_conductor(auth_as, usuario, reserva_id, pdf=None, tipo="antecedentes"):
    return auth_as(usuario).post(
        f"/api/v1/reservas/{reserva_id}/segundo-conductor/certificados",
        files={"archivo": ("c.pdf", pdf if pdf is not None else pdf_antecedentes(), "application/pdf")},
        data={"tipo": tipo, "consentimiento": "true"},
    )


def test_el_titular_sube_el_certificado_de_su_segundo_conductor(auth_as, reserva_con_conductor, db_session):
    titular, reserva, conductor = reserva_con_conductor

    resp = _subir_conductor(auth_as, titular, reserva.id)

    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "revision"
    db_session.refresh(conductor)
    assert conductor.antecedentes_estado == "revision"


def test_el_certificado_del_conductor_se_compara_con_el_rut_del_conductor(auth_as, reserva_con_conductor):
    titular, reserva, _ = reserva_con_conductor

    resp = _subir_conductor(auth_as, titular, reserva.id, pdf=pdf_antecedentes(rut="20.222.333-8"))

    assert resp.json()["estado"] == "rechazado"


def test_solo_el_titular_sube_por_el_conductor(auth_as, reserva_con_conductor, usuario_factory):
    _, reserva, _ = reserva_con_conductor
    intruso = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")

    assert _subir_conductor(auth_as, intruso, reserva.id).status_code == 403


def test_sin_segundo_conductor_da_404(auth_as, reserva_con_conductor, db_session):
    titular, reserva, conductor = reserva_con_conductor
    db_session.delete(conductor)
    db_session.commit()

    assert _subir_conductor(auth_as, titular, reserva.id).status_code == 404


# ===========================================================================
# Bloqueo al reservar
# ===========================================================================
def _fecha_futura(dias):
    return (datetime.utcnow() + timedelta(days=dias)).strftime("%Y-%m-%dT10:00:00")


@pytest.fixture
def auto_publicado(usuario_factory, db_session):
    dueno = usuario_factory(roles_activos=["dueno"])
    auto = Auto(dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022, patente="KLPW-88",
                tarifa_dia=20000, estado="activo", ubicacion_base="Los Ángeles", categoria="economico")
    db_session.add(auto)
    db_session.commit()
    return auto


def _reservar(auth_as, usuario, auto):
    return auth_as(usuario).post("/api/v1/reservas", json={
        "auto_id": auto.id, "fecha_inicio": _fecha_futura(30), "fecha_fin": _fecha_futura(33),
        "lugar_entrega_acordado": "Plaza de Armas"})


def test_con_el_bloqueo_apagado_se_puede_reservar_sin_antecedentes(auth_as, persona, auto_publicado, monkeypatch):
    monkeypatch.setattr(settings, "ANTECEDENTES_OBLIGATORIOS", False)

    assert _reservar(auth_as, persona, auto_publicado).status_code in (200, 201)


def test_con_el_bloqueo_encendido_no_se_reserva_sin_antecedentes(auth_as, persona, auto_publicado, monkeypatch):
    monkeypatch.setattr(settings, "ANTECEDENTES_OBLIGATORIOS", True)

    resp = _reservar(auth_as, persona, auto_publicado)

    assert resp.status_code == 403
    assert resp.json()["detail"]["codigo"] == "ANTECEDENTES_PENDIENTES"


def test_con_el_bloqueo_encendido_se_reserva_con_antecedentes_limpio(
    auth_as, persona, admin, auto_publicado, monkeypatch
):
    monkeypatch.setattr(settings, "ANTECEDENTES_OBLIGATORIOS", True)
    for tipo, pdf in (("antecedentes", pdf_antecedentes()), ("hoja_vida", pdf_hoja_vida())):
        cid = _subir(auth_as, persona, tipo, pdf).json()["id"]
        auth_as(admin).post(f"/api/v1/admin/antecedentes/{cid}/revisar", json={"accion": "aprobar"})

    assert _reservar(auth_as, persona, auto_publicado).status_code in (200, 201)


def test_un_usuario_bloqueado_por_hallazgo_no_reserva_ni_aunque_suba_de_nuevo(
    auth_as, persona, admin, auto_publicado, monkeypatch
):
    monkeypatch.setattr(settings, "ANTECEDENTES_OBLIGATORIOS", True)
    susp = _pdf(["CERTIFICADO HOJA DE VIDA DEL CONDUCTOR", f"RUN: {RUT}", f"Fecha de emision: {_fecha()}",
                 "Licencia clase B SUSPENDIDA", "Folio: 600001112223", "Codigo de verificacion: 9xY8w7Vu6T5s"])
    cid = _subir(auth_as, persona, "hoja_vida", susp).json()["id"]
    auth_as(admin).post(f"/api/v1/admin/antecedentes/{cid}/revisar", json={"accion": "rechazar", "notas": "Suspendida"})

    resp = _reservar(auth_as, persona, auto_publicado)

    assert resp.status_code == 403
    assert resp.json()["detail"]["estado"] == "bloqueado"
