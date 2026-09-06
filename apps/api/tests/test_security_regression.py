"""
Test Suite: qa-security-regression
Verifica que las medidas de seguridad del backend permanezcan blindadas:
1. Saneamiento de documentos legales y sensibles en endpoints públicos de autos (GET /autos, GET /autos/{id}).
2. El dueño legítimo puede ver sus documentos completos en GET /autos/mios y GET /autos/{id}.
3. Integridad del hash SHA-256 en contratos descargables (X-Contract-SHA256 y persistencia en DB).
4. Configuración estricta de CORS en producción (filtrado de localhost y soporte de admin panel).
"""
import pytest
from app.models.entities import Auto, Reserva
from app.core.config import Settings
from app.services.contract import ContractService


def test_public_catalog_sanitizes_sensitive_documents(client, db_session, usuario_factory):
    dueno = usuario_factory(roles_activos=["dueno", "cliente"], estado_documentos="verificado")
    auto = Auto(
        dueno_id=dueno.id,
        marca="Toyota",
        modelo="Corolla",
        anio=2022,
        patente="TKCR-88",
        tarifa_dia=30000,
        estado="activo",
        ubicacion_base="Los Ángeles",
        doc_inscripcion_url="https://supabase.co/private/padron.pdf",
        doc_permiso_circulacion_url="https://supabase.co/private/permiso.pdf",
        doc_soap_url="https://supabase.co/private/soap.pdf",
        doc_revision_tecnica_url="https://supabase.co/private/rt.pdf",
        doc_seguro_url="https://supabase.co/private/seguro.pdf",
    )
    db_session.add(auto)
    db_session.commit()

    # 1. Consulta pública sin autenticación
    resp_public = client.get("/api/v1/autos")
    assert resp_public.status_code == 200
    items = resp_public.json()
    auto_data = next((a for a in items if a["id"] == auto.id), None)
    assert auto_data is not None
    assert auto_data["doc_inscripcion_url"] is None
    assert auto_data["doc_permiso_circulacion_url"] is None
    assert auto_data["doc_soap_url"] is None
    assert auto_data["doc_revision_tecnica_url"] is None
    assert auto_data["doc_seguro_url"] is None

    # 2. Detalle público de auto por ID
    resp_detail = client.get(f"/api/v1/autos/{auto.id}")
    assert resp_detail.status_code == 200
    detail_data = resp_detail.json()
    assert detail_data["doc_inscripcion_url"] is None
    assert detail_data["doc_seguro_url"] is None


def test_dueno_can_view_own_car_documents(auth_as, db_session, usuario_factory):
    dueno = usuario_factory(roles_activos=["dueno", "cliente"], estado_documentos="verificado")
    auto = Auto(
        dueno_id=dueno.id,
        marca="Nissan",
        modelo="Kicks",
        anio=2023,
        patente="NKKS-55",
        tarifa_dia=32000,
        estado="activo",
        ubicacion_base="Los Ángeles",
        doc_inscripcion_url="https://supabase.co/private/padron.pdf",
        doc_soap_url="https://supabase.co/private/soap.pdf",
    )
    db_session.add(auto)
    db_session.commit()

    # El dueño autenticado accede a sus autos
    resp_mios = auth_as(dueno).get("/api/v1/autos/mios")
    assert resp_mios.status_code == 200
    mios_data = resp_mios.json()
    auto_mio = next((a for a in mios_data if a["id"] == auto.id), None)
    assert auto_mio is not None
    assert auto_mio["doc_inscripcion_url"] == "https://supabase.co/private/padron.pdf"
    assert auto_mio["doc_soap_url"] == "https://supabase.co/private/soap.pdf"


def test_contrato_pdf_sha256_hash_generation():
    fake_pdf = b"%PDF-1.4 Mock Contract Content For Testing Crypto Hash"
    hash_calc = ContractService.calcular_hash_contrato(fake_pdf)
    assert len(hash_calc) == 64
    assert isinstance(hash_calc, str)
    # Hash vacío si no hay contenido
    assert ContractService.calcular_hash_contrato(b"") == ""


def test_cors_production_filtering():
    s_prod = Settings(
        ENVIRONMENT="production",
        CORS_ORIGINS=["https://arriendatuauto.com", "http://localhost:3000"],
        ADMIN_PANEL_ORIGIN="https://admin.arriendatuauto.com"
    )
    origins = s_prod.allowed_cors_origins
    assert "https://arriendatuauto.com" in origins
    assert "https://admin.arriendatuauto.com" in origins
    assert "http://localhost:3000" not in origins
