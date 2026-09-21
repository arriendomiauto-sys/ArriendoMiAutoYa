"""
Servicio de certificados de antecedentes: registra el PDF, lo analiza, deja un
ticket para el admin y calcula `antecedentes_estado`.

El estado se calcula SOLO a partir de certificados. Sin certificados es
"pendiente" (antes el proveedor simulado devolvía "limpio" y, si fallaba la red,
también). "limpio" exige los dos certificados aprobados por un ejecutivo y
vigentes.
"""
import io
from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.features.auth.background_checks.certificados import (
    TIPO_ANOTACIONES,
    TIPO_ANTECEDENTES,
    TIPO_HOJA_VIDA,
)
from app.features.auth.background_checks import certificados_service as svc
from app.features.auth.background_checks.service import BackgroundCheckService
from app.models.entities import (
    Auto,
    CertificadoAntecedente,
    ConductorAdicional,
    Notificacion,
    Reserva,
    TicketSoporte,
    Usuario,
)

RUT = "11.111.111-1"


def _fecha(dias_atras):
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


def pdf_antecedentes(rut=RUT, dias_atras=3, cuerpo="NO REGISTRA ANTECEDENTES"):
    return _pdf(["CERTIFICADO DE ANTECEDENTES", f"RUN: {rut}", f"Fecha de emision: {_fecha(dias_atras)}",
                 cuerpo, "Folio: 500004443232", "Codigo de verificacion: 2rR4t56Cv332"])


def pdf_hoja_vida(rut=RUT, dias_atras=3, cuerpo="NO REGISTRA ANOTACIONES"):
    return _pdf(["CERTIFICADO HOJA DE VIDA DEL CONDUCTOR", f"RUN: {rut}", f"Fecha de emision: {_fecha(dias_atras)}",
                 cuerpo, "Folio: 600001112223", "Codigo de verificacion: 9xY8w7Vu6T5s"])


@pytest.fixture
def usuario(usuario_factory):
    return usuario_factory(roles_activos=["cliente"], rut=RUT)


@pytest.fixture
def admin(usuario_factory):
    return usuario_factory(roles_activos=["admin"], rut="20.333.444-3")


def _subir(db, usuario, tipo, pdf, consentimiento=True, **kw):
    return svc.registrar_certificado(
        db, sujeto_tipo="usuario", sujeto_id=usuario.id, tipo=tipo, pdf_bytes=pdf,
        archivo_url="/storage/local/documentos-kyc/x.pdf", subido_por=usuario,
        consentimiento=consentimiento, rut_esperado=usuario.rut, **kw,
    )


def _aprobar_ambos(db, usuario, admin):
    a = _subir(db, usuario, TIPO_ANTECEDENTES, pdf_antecedentes())
    h = _subir(db, usuario, TIPO_HOJA_VIDA, pdf_hoja_vida())
    svc.revisar_certificado(db, a, admin, "aprobar", "CVE confirmado")
    svc.revisar_certificado(db, h, admin, "aprobar", "CVE confirmado")


# ===========================================================================
# Estado
# ===========================================================================
def test_sin_certificados_el_estado_es_pendiente_nunca_limpio(db_session, usuario):
    assert svc.recalcular_estado_usuario(db_session, usuario) == "pendiente"
    assert usuario.antecedentes_estado == "pendiente"


def test_con_un_solo_certificado_aprobado_sigue_pendiente(db_session, usuario, admin):
    a = _subir(db_session, usuario, TIPO_ANTECEDENTES, pdf_antecedentes())
    svc.revisar_certificado(db_session, a, admin, "aprobar", "ok")

    assert svc.recalcular_estado_usuario(db_session, usuario) == "pendiente"


def test_con_los_dos_aprobados_el_estado_es_limpio(db_session, usuario, admin):
    _aprobar_ambos(db_session, usuario, admin)

    assert svc.recalcular_estado_usuario(db_session, usuario) == "limpio"
    assert usuario.antecedentes_estado == "limpio"


def test_un_certificado_esperando_al_admin_deja_el_estado_en_revision(db_session, usuario, admin):
    a = _subir(db_session, usuario, TIPO_ANTECEDENTES, pdf_antecedentes())
    svc.revisar_certificado(db_session, a, admin, "aprobar", "ok")
    _subir(db_session, usuario, TIPO_HOJA_VIDA, pdf_hoja_vida())

    assert svc.recalcular_estado_usuario(db_session, usuario) == "revision"


def test_la_aprobacion_vence_y_hay_que_volver_a_verificar(db_session, usuario, admin, monkeypatch):
    _aprobar_ambos(db_session, usuario, admin)
    monkeypatch.setattr(settings, "ANTECEDENTES_REVERIFICACION_DIAS", 180)
    futuro = datetime.now(timezone.utc) + timedelta(days=181)

    assert svc.recalcular_estado_usuario(db_session, usuario, ahora=futuro) == "pendiente"


def test_una_licencia_suspendida_rechazada_bloquea(db_session, usuario, admin):
    _aprobar_ambos(db_session, usuario, admin)
    h = _subir(db_session, usuario, TIPO_HOJA_VIDA, pdf_hoja_vida(cuerpo="Licencia clase B SUSPENDIDA"))
    svc.revisar_certificado(db_session, h, admin, "rechazar", "Licencia suspendida")

    assert svc.recalcular_estado_usuario(db_session, usuario) == "bloqueado"


def test_un_rechazo_por_otro_motivo_solo_pide_subirlo_de_nuevo(db_session, usuario):
    _subir(db_session, usuario, TIPO_ANTECEDENTES, pdf_antecedentes(rut="20.222.333-8"))  # es de otra persona

    assert svc.recalcular_estado_usuario(db_session, usuario) == "pendiente"


# ===========================================================================
# Registro del certificado
# ===========================================================================
def test_registrar_guarda_el_analisis_y_deja_el_caso_para_el_admin(db_session, usuario):
    c = _subir(db_session, usuario, TIPO_ANTECEDENTES, pdf_antecedentes())

    assert c.estado == "revision"
    assert c.contenido_ok is True
    assert c.rut_detectado == RUT
    assert c.folio == "500004443232"
    assert c.codigo_verificacion == "2rR4t56Cv332"
    assert len(c.sha256) == 64
    assert c.consentimiento_en is not None
    ticket = db_session.query(TicketSoporte).filter(TicketSoporte.usuario_id == usuario.id).one()
    assert "antecedentes" in ticket.asunto.lower()


def test_sin_consentimiento_no_se_guarda_nada(db_session, usuario):
    with pytest.raises(svc.CertificadoError) as e:
        _subir(db_session, usuario, TIPO_ANTECEDENTES, pdf_antecedentes(), consentimiento=False)

    assert e.value.http_status == 400
    assert db_session.query(CertificadoAntecedente).count() == 0


def test_el_certificado_de_otra_persona_se_rechaza_sin_molestar_al_admin(db_session, usuario):
    c = _subir(db_session, usuario, TIPO_ANTECEDENTES, pdf_antecedentes(rut="20.222.333-8"))

    assert c.estado == "rechazado"
    assert "otra persona" in c.motivo.lower()
    assert db_session.query(TicketSoporte).count() == 0


def test_un_pdf_ilegible_queda_en_revision(db_session, usuario):
    c = _subir(db_session, usuario, TIPO_ANTECEDENTES, b"%PDF-1.4 no es un pdf de verdad")

    assert c.estado == "revision"
    assert c.contenido_ok is False


def test_el_estado_del_usuario_se_actualiza_al_subir(db_session, usuario):
    _subir(db_session, usuario, TIPO_ANTECEDENTES, pdf_antecedentes())

    db_session.refresh(usuario)
    assert usuario.antecedentes_estado == "revision"


# ===========================================================================
# Revisión del admin
# ===========================================================================
def test_el_admin_aprueba_y_queda_registrado(db_session, usuario, admin):
    c = _subir(db_session, usuario, TIPO_ANTECEDENTES, pdf_antecedentes())

    svc.revisar_certificado(db_session, c, admin, "aprobar", "CVE confirmado en registrocivil.cl")

    db_session.refresh(c)
    assert c.estado == "aprobado"
    assert c.revisado_por_id == admin.id
    assert c.revisado_en is not None
    assert any(n.usuario_id == usuario.id for n in db_session.query(Notificacion))


def test_solo_se_revisa_lo_que_esta_en_revision(db_session, usuario, admin):
    c = _subir(db_session, usuario, TIPO_ANTECEDENTES, pdf_antecedentes(rut="20.222.333-8"))  # rechazado

    with pytest.raises(svc.CertificadoError) as e:
        svc.revisar_certificado(db_session, c, admin, "aprobar", "ok")

    assert e.value.http_status == 409


def test_la_accion_del_admin_debe_ser_valida(db_session, usuario, admin):
    c = _subir(db_session, usuario, TIPO_ANTECEDENTES, pdf_antecedentes())

    with pytest.raises(svc.CertificadoError):
        svc.revisar_certificado(db_session, c, admin, "quiza", "")


# ===========================================================================
# BackgroundCheckService (ya sin ChapiAPI)
# ===========================================================================
def test_el_chequeo_de_fondo_sin_certificados_deja_pendiente_y_no_bloquea_la_cuenta(db_session, usuario):
    usuario.estado_documentos = "verificado"
    db_session.commit()

    BackgroundCheckService.run_and_flag_user(db_session, usuario.id)

    db_session.refresh(usuario)
    assert usuario.antecedentes_estado == "pendiente"
    assert usuario.estado_documentos == "verificado"
    assert db_session.query(TicketSoporte).count() == 0


def test_chapi_ya_no_existe():
    with pytest.raises(ImportError):
        from app.features.auth.background_checks import chapi_provider  # noqa: F401


# ===========================================================================
# Segundo conductor
# ===========================================================================
def _conductor(db, usuario_factory):
    dueno = usuario_factory(roles_activos=["dueno"])
    titular = usuario_factory(roles_activos=["cliente"])
    auto = Auto(dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022, patente="KLPW-88",
                tarifa_dia=20000, estado="activo", ubicacion_base="Los Ángeles")
    db.add(auto)
    db.commit()
    reserva = Reserva(auto_id=auto.id, cliente_id=titular.id, estado="confirmada",
                      fecha_inicio=datetime.utcnow() + timedelta(days=3),
                      fecha_fin=datetime.utcnow() + timedelta(days=5), lugar_entrega_acordado="Plaza")
    db.add(reserva)
    db.commit()
    conductor = ConductorAdicional(reserva_id=reserva.id, nombre="Segundo Conductor", rut=RUT, estado_kyc="verificado")
    db.add(conductor)
    db.commit()
    return titular, conductor


def test_el_segundo_conductor_sin_certificados_queda_pendiente(db_session, usuario_factory):
    titular, conductor = _conductor(db_session, usuario_factory)

    BackgroundCheckService.run_and_flag_conductor(db_session, conductor.id)

    db_session.refresh(conductor)
    assert conductor.antecedentes_estado == "pendiente"


def test_el_titular_sube_los_certificados_del_segundo_conductor(db_session, usuario_factory, admin):
    titular, conductor = _conductor(db_session, usuario_factory)

    a = svc.registrar_certificado(
        db_session, sujeto_tipo="conductor_adicional", sujeto_id=conductor.id, tipo=TIPO_ANTECEDENTES,
        pdf_bytes=pdf_antecedentes(), archivo_url="/storage/local/documentos-kyc/a.pdf",
        subido_por=titular, consentimiento=True, rut_esperado=conductor.rut,
    )
    h = svc.registrar_certificado(
        db_session, sujeto_tipo="conductor_adicional", sujeto_id=conductor.id, tipo=TIPO_HOJA_VIDA,
        pdf_bytes=pdf_hoja_vida(), archivo_url="/storage/local/documentos-kyc/h.pdf",
        subido_por=titular, consentimiento=True, rut_esperado=conductor.rut,
    )
    svc.revisar_certificado(db_session, a, admin, "aprobar", "ok")
    svc.revisar_certificado(db_session, h, admin, "aprobar", "ok")

    db_session.refresh(conductor)
    assert conductor.antecedentes_estado == "limpio"
