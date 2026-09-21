"""
Almacenamiento de PDF para los certificados oficiales (antecedentes, hoja de vida,
anotaciones vigentes).

Un PDF no es una foto: puede traer scripts y no se debe renderizar dentro de la app. Por
eso solo se acepta cuando el llamador lo pide expresamente (el endpoint de certificados),
únicamente en los buckets privados de documentos, con tope de tamaño, sin contenido activo
(JavaScript, lanzadores, archivos incrustados) y se entrega siempre como descarga y solo a
quien lo subió o a un ejecutivo. El `/storage/upload` genérico sigue aceptando solo imágenes.
"""
import uuid

import pytest

from app.core.config import settings
from app.features.system.storage.service import StorageService
from app.models.entities import CertificadoAntecedente

PDF_OK = b"%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n" + b"0" * 64 + b"\n%%EOF"


@pytest.fixture
def almacenamiento(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "STORAGE_LOCAL_DIR", str(tmp_path / "publico"))
    monkeypatch.setattr(settings, "STORAGE_LOCAL_PRIVATE_DIR", str(tmp_path / "privado"))
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "your-placeholder")  # fuerza el respaldo local
    return tmp_path


def _subir(contenido=PDF_OK, bucket="documentos-kyc", permitir_pdf=True):
    return StorageService.subir_archivo(
        contenido_bytes=contenido, nombre_original="certificado.pdf", content_type="application/pdf",
        bucket=bucket, base_url="http://testserver/", permitir_pdf=permitir_pdf,
    )


def test_el_pdf_solo_se_acepta_si_el_llamador_lo_pide(almacenamiento):
    sin_permiso = _subir(permitir_pdf=False)
    con_permiso = _subir(permitir_pdf=True)

    assert sin_permiso["success"] is False and sin_permiso["validation_error"] is True
    assert con_permiso["success"] is True
    assert con_permiso["url"].endswith(".pdf")
    assert con_permiso["provider"] == "local_privado"
    assert (almacenamiento / "privado" / "documentos-kyc" / con_permiso["filename"]).read_bytes() == PDF_OK


@pytest.mark.parametrize("bucket", ["general", "autos", "checklists", "evidencias"])
def test_el_pdf_no_va_a_otros_buckets(almacenamiento, bucket):
    resultado = _subir(bucket=bucket)

    assert resultado["success"] is False and resultado["validation_error"] is True


@pytest.mark.parametrize("activo", [b"/JavaScript", b"/JS ", b"/Launch", b"/EmbeddedFile", b"/OpenAction"])
def test_un_pdf_con_contenido_activo_se_rechaza(almacenamiento, activo):
    resultado = _subir(contenido=PDF_OK + b"\n<< " + activo + b" >>")

    assert resultado["success"] is False and resultado["validation_error"] is True


def test_un_pdf_demasiado_grande_se_rechaza(almacenamiento):
    resultado = _subir(contenido=PDF_OK + b"0" * (6 * 1024 * 1024))

    assert resultado["success"] is False and resultado["validation_error"] is True
    assert "tamaño" in resultado["error"].lower()


def test_algo_que_dice_ser_pdf_pero_no_lo_es_se_rechaza(almacenamiento):
    resultado = _subir(contenido=b"esto no es un pdf" * 10)

    assert resultado["success"] is False and resultado["validation_error"] is True


def test_el_upload_generico_sigue_rechazando_pdf(usuario_factory, auth_as):
    usuario = usuario_factory(roles_activos=["cliente"])
    resp = auth_as(usuario).post(
        "/api/v1/storage/upload",
        files={"file": ("c.pdf", PDF_OK, "application/pdf")},
        data={"bucket": "documentos-kyc"},
    )

    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Entrega del PDF
# ---------------------------------------------------------------------------
@pytest.fixture
def pdf_guardado(almacenamiento, usuario_factory, db_session):
    subio = usuario_factory(roles_activos=["cliente"])
    nombre = f"{uuid.uuid4().hex}.pdf"
    carpeta = almacenamiento / "privado" / "documentos-kyc"
    carpeta.mkdir(parents=True)
    (carpeta / nombre).write_bytes(PDF_OK)
    db_session.add(CertificadoAntecedente(
        sujeto_tipo="usuario", sujeto_id=subio.id, tipo="antecedentes", estado="revision",
        archivo_url=f"/api/v1/storage/local/documentos-kyc/{nombre}", subido_por_id=subio.id,
    ))
    db_session.commit()
    return subio, nombre


def test_quien_lo_subio_puede_descargarlo_como_archivo(auth_as, pdf_guardado):
    subio, nombre = pdf_guardado

    resp = auth_as(subio).get(f"/api/v1/storage/local/documentos-kyc/{nombre}")

    assert resp.status_code == 200
    assert resp.content == PDF_OK
    assert "attachment" in resp.headers["content-disposition"].lower()
    assert resp.headers["content-type"].startswith("application/pdf")


def test_un_ejecutivo_puede_descargarlo(auth_as, usuario_factory, pdf_guardado):
    _, nombre = pdf_guardado
    admin = usuario_factory(roles_activos=["admin"])

    assert auth_as(admin).get(f"/api/v1/storage/local/documentos-kyc/{nombre}").status_code == 200


def test_otro_usuario_no_puede_descargarlo(auth_as, usuario_factory, pdf_guardado):
    _, nombre = pdf_guardado
    intruso = usuario_factory(roles_activos=["cliente"])

    assert auth_as(intruso).get(f"/api/v1/storage/local/documentos-kyc/{nombre}").status_code == 403


def test_un_pdf_que_ningun_certificado_reclama_solo_lo_ve_un_ejecutivo(auth_as, usuario_factory, almacenamiento):
    carpeta = almacenamiento / "privado" / "documentos-kyc"
    carpeta.mkdir(parents=True)
    nombre = f"{uuid.uuid4().hex}.pdf"
    (carpeta / nombre).write_bytes(PDF_OK)
    cliente = usuario_factory(roles_activos=["cliente"])
    admin = usuario_factory(roles_activos=["admin"])

    assert auth_as(cliente).get(f"/api/v1/storage/local/documentos-kyc/{nombre}").status_code == 403
    assert auth_as(admin).get(f"/api/v1/storage/local/documentos-kyc/{nombre}").status_code == 200
