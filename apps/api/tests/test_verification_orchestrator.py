"""
Pruebas unitarias y de integración para el orquestador de verificación (Didit + Fallback casero)
y el servicio de antecedentes (Background Checks).
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.features.auth.verification.orchestrator import VerificationOrchestrator
from app.features.auth.verification.models import VerificationResult
from app.features.auth.verification.storage_sync import persist_verification_assets
from app.features.auth.background_checks.service import BackgroundCheckService
from app.features.auth.background_checks.models import BackgroundCheckResult
from app.main import app

client = TestClient(app)


# ============================================================================
# 1. Pruebas de VerificationOrchestrator
# ============================================================================
class TestVerificationOrchestrator:

    def test_didit_approved_flow(self):
        """
        Didit aprobado debe retornar VerificationResult exitoso con
        provider='didit' para identidad — pero NUNCA para la licencia:
        Didit todavía no la reconoce de forma confiable, así que
        is_license_verified debe quedar en False sin importar qué venga en
        el payload (la licencia se verifica aparte, con el pipeline casero
        de Google Vision).
        """
        mock_payload = {
            "datos": {
                "nombre_completo": "Juan Perez Gonzalez",
                "rut": "12.345.678-5",
                "fecha_nacimiento": "1990-05-15",
                "foto_url": "https://storage.didit.me/temp_avatar.jpg",
                "carnet_frontal_url": "https://storage.didit.me/temp_front.jpg",
                "carnet_trasero_url": "https://storage.didit.me/temp_back.jpg",
            }
        }

        with patch("app.features.auth.verification.orchestrator.persist_verification_assets") as mock_persist:
            mock_persist.return_value = {
                "verified_avatar_url": "https://supabase.co/storage/v1/object/sign/documentos-kyc/verified_avatar_123.jpg",
                "front_card_url": "https://supabase.co/storage/v1/object/sign/documentos-kyc/id_card_front_123.jpg",
                "back_card_url": "https://supabase.co/storage/v1/object/sign/documentos-kyc/id_card_back_123.jpg",
            }

            result = VerificationOrchestrator.evaluate_user_verification(
                user_id="user_test_123",
                external_state="aprobada",
                external_payload=mock_payload,
                manual_documents=None,
            )

            assert isinstance(result, VerificationResult)
            assert result.status == "approved"
            assert result.provider == "didit"
            assert result.is_identity_verified is True
            assert result.is_license_verified is False
            assert result.is_liveness_verified is True
            assert result.extracted_full_name == "Juan Perez Gonzalez"
            assert result.extracted_rut == "12.345.678-5"
            assert result.license_url is None
            assert "supabase.co" in result.verified_avatar_url

    def test_inhouse_fallback_when_didit_failed_or_missing(self):
        """Si Didit no está aprobado pero hay documentos manuales completos, activa OCR casero."""
        manual_docs = {
            "carnet_frontal_url": "https://supabase.co/files/front.jpg",
            "carnet_trasero_url": "https://supabase.co/files/back.jpg",
            "foto_perfil_verificada_url": "https://supabase.co/files/selfie.jpg",
            "selfie_liveness_url": "https://supabase.co/files/liveness.jpg",
            "licencia_url": "https://supabase.co/files/license.jpg",
            "tipo_documento": "rut",
        }

        mock_ocr_response = {
            "estado_recomendado": "verificado",
            "documentos_legibles": True,
            "confianza_ocr": 0.95,
            "rut_extraido": "18.765.432-1",
            "nombre_extraido": "Maria Lopez Soto",
            "verificacion_facial": "ok",
            "licencia_a_soporte": False,
            "motivo": None,
        }

        with patch("app.features.verificacion_identidad.ocr_engine.OCRService.procesar_documentos_enrolamiento") as mock_ocr:
            mock_ocr.return_value = mock_ocr_response

            # Simula caso donde Didit falló o fue rechazado
            result = VerificationOrchestrator.evaluate_user_verification(
                user_id="user_fallback_456",
                external_state="rechazada",
                external_payload=None,
                manual_documents=manual_docs,
                user_rut="18.765.432-1",
            )

            assert result.status == "approved"
            assert result.provider == "inhouse_ocr"
            assert result.is_identity_verified is True
            assert result.is_license_verified is True
            assert result.is_liveness_verified is True
            assert result.extracted_rut == "18.765.432-1"
            assert result.extracted_full_name == "Maria Lopez Soto"

    def test_inhouse_fallback_incomplete_docs_does_not_trigger_ocr(self):
        """Si faltan documentos obligatorios en el fallback, no intenta OCR y retorna pendiente."""
        incomplete_docs = {
            "carnet_frontal_url": "https://supabase.co/files/front.jpg",
            # falta carnet_trasero_url y foto_perfil_verificada_url
        }

        result = VerificationOrchestrator.evaluate_user_verification(
            user_id="user_incomplete",
            external_state="pendiente",
            external_payload=None,
            manual_documents=incomplete_docs,
        )

        assert result.status == "pendiente"
        assert result.is_identity_verified is False
        assert result.is_license_verified is False


# ============================================================================
# 2. Pruebas de BackgroundCheckService (ChapiAPI)
# ============================================================================
class TestBackgroundCheckService:

    def test_verify_driver_eligibility_clean_mock(self):
        """En entorno de desarrollo o sin API key, retorna conductor habilitado y limpio."""
        result = BackgroundCheckService.verify_driver_eligibility("12.345.678-5")
        assert isinstance(result, BackgroundCheckResult)
        assert result.is_eligible is True
        assert result.criminal_record_clean is True
        assert result.driver_record_clean is True
        assert result.has_suspended_license is False

    def test_verify_driver_eligibility_empty_rut(self):
        """Si no se entrega RUT, debe rechazar la elegibilidad de inmediato."""
        result = BackgroundCheckService.verify_driver_eligibility("")
        assert result.is_eligible is False
        assert "RUT no proporcionado" in result.rejection_reasons


# ============================================================================
# 3. Pruebas de Endpoints en Inglés (/api/v1/enrolment/*)
# ============================================================================
class TestEnrolmentEndpoints:

    def test_enrolment_endpoints_registered_in_app(self):
        """Verifica que las rutas en inglés estén expuestas en el OpenAPI schema."""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        paths = schema.get("paths", {})

        # Endpoints en inglés obligatorios
        assert "/api/v1/enrolment/external-verification/session" in paths
        assert "/api/v1/enrolment/complete" in paths
        assert "/api/v1/enrolment/process-documents" in paths
        assert "/api/v1/enrolment/send-to-review" in paths

        # Endpoints legacy deben seguir presentes para compatibilidad
        assert "/api/v1/enrolamiento/completar" in paths
        assert "/api/v1/enrolamiento/procesar-documentos" in paths

    def test_complete_enrolment_english_endpoint(self, usuario_factory, auth_as):
        """El endpoint en inglés /enrolment/complete procesa el enrolamiento exitosamente."""
        nuevo_usuario = usuario_factory(roles_activos=["cliente"], rut=None, nombre=None, estado_documentos="pendiente")
        c = auth_as(nuevo_usuario)
        resp = c.post(
            "/api/v1/enrolment/complete",
            json={
                "nombre": "Cliente English",
                "rut": "15.987.654-3",
                "email": "cliente.english@test.cl",
                "telefono": "+56912345678",
                "tarjeta_token": "tok-test-visa",
                "tarjeta_ultimos4": "4242",
                "tarjeta_marca": "visa",
                "carnet_frontal_url": "https://ejemplo.com/carnet_front.jpg",
                "foto_perfil_verificada_url": "https://ejemplo.com/selfie.jpg",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["estado_documentos"] == "verificado"
        assert "cliente" in data["roles_activos"]
