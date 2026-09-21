"""
Minimización de datos: el PDF de un certificado (datos personales sensibles) se borra pasado
`ANTECEDENTES_RETENCION_DIAS` una vez resuelto. Queda solo el hash, el folio y el resultado. Lo que
todavía espera al ejecutivo nunca se purga.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.features.auth.background_checks import certificados_service as svc
from app.features.system.storage.service import StorageService
from app.models.entities import Auto, CertificadoAntecedente


@pytest.fixture(autouse=True)
def almacenamiento(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "STORAGE_LOCAL_PRIVATE_DIR", str(tmp_path / "privado"))
    monkeypatch.setattr(settings, "ANTECEDENTES_RETENCION_DIAS", 30)
    (tmp_path / "privado" / "documentos-kyc").mkdir(parents=True)
    return tmp_path


def _certificado(db, tmp_path, usuario, estado="aprobado", dias_desde_la_revision=45):
    nombre = f"{uuid.uuid4().hex}.pdf"
    ruta = tmp_path / "privado" / "documentos-kyc" / nombre
    ruta.write_bytes(b"%PDF-1.7 contenido")
    c = CertificadoAntecedente(
        sujeto_tipo="usuario", sujeto_id=usuario.id, tipo="antecedentes", estado=estado,
        archivo_url=f"http://x/api/v1/storage/local/documentos-kyc/{nombre}", sha256="a" * 64,
        folio="500004443232", codigo_verificacion="2rR4t56Cv332",
        revisado_en=datetime.now(timezone.utc) - timedelta(days=dias_desde_la_revision),
        creado_en=datetime.now(timezone.utc) - timedelta(days=dias_desde_la_revision + 1),
    )
    db.add(c)
    db.commit()
    return c, ruta


def test_se_purga_el_pdf_resuelto_y_queda_el_rastro(db_session, usuario_factory, almacenamiento):
    usuario = usuario_factory()
    c, ruta = _certificado(db_session, almacenamiento, usuario)

    assert svc.purgar_certificados(db_session) == 1

    db_session.refresh(c)
    assert not ruta.exists()
    assert c.archivo_url is None
    assert c.sha256 == "a" * 64 and c.folio == "500004443232" and c.estado == "aprobado"


def test_un_rechazado_tambien_se_purga(db_session, usuario_factory, almacenamiento):
    c, ruta = _certificado(db_session, almacenamiento, usuario_factory(), estado="rechazado")

    assert svc.purgar_certificados(db_session) == 1
    assert not ruta.exists()


def test_lo_reciente_no_se_purga(db_session, usuario_factory, almacenamiento):
    c, ruta = _certificado(db_session, almacenamiento, usuario_factory(), dias_desde_la_revision=5)

    assert svc.purgar_certificados(db_session) == 0
    assert ruta.exists()


def test_lo_que_espera_al_ejecutivo_nunca_se_purga(db_session, usuario_factory, almacenamiento):
    c, ruta = _certificado(db_session, almacenamiento, usuario_factory(), estado="revision", dias_desde_la_revision=400)

    assert svc.purgar_certificados(db_session) == 0
    assert ruta.exists()


def test_es_idempotente(db_session, usuario_factory, almacenamiento):
    _certificado(db_session, almacenamiento, usuario_factory())

    assert svc.purgar_certificados(db_session) == 1
    assert svc.purgar_certificados(db_session) == 0


def test_el_auto_deja_de_apuntar_al_pdf_borrado(db_session, usuario_factory, almacenamiento):
    dueno = usuario_factory(roles_activos=["dueno"])
    c, ruta = _certificado(db_session, almacenamiento, dueno)
    c.sujeto_tipo = "auto"
    auto = Auto(dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022, patente="KLPW-88", tarifa_dia=20000,
                estado="activo", ubicacion_base="Los Ángeles", doc_anotaciones_vigentes_url=c.archivo_url)
    db_session.add(auto)
    db_session.commit()
    c.sujeto_id = auto.id
    db_session.commit()

    svc.purgar_certificados(db_session)

    db_session.refresh(auto)
    assert auto.doc_anotaciones_vigentes_url is None


def test_si_no_se_pudo_borrar_se_reintenta_despues(db_session, usuario_factory, almacenamiento, monkeypatch):
    c, ruta = _certificado(db_session, almacenamiento, usuario_factory())
    monkeypatch.setattr(StorageService, "eliminar_archivo_privado", classmethod(lambda cls, url: False))

    assert svc.purgar_certificados(db_session) == 0

    db_session.refresh(c)
    assert c.archivo_url is not None


def test_borrar_un_archivo_que_ya_no_existe_cuenta_como_hecho():
    assert StorageService.eliminar_archivo_privado(
        "http://x/api/v1/storage/local/documentos-kyc/no-existe.pdf"
    ) is True
