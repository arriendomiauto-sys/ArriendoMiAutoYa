"""
Verification orchestrator: Didit as primary provider with in-house OCR fallback.
"""
from typing import Optional, Dict, Any
import logging

from .models import VerificationResult
from .storage_sync import persist_verification_assets
from app.features.auth.ocr.ocr_engine import OCRService

logger = logging.getLogger(__name__)

# Documentos mínimos que exige el fallback casero para ni siquiera intentar OCR.
_REQUIRED_FALLBACK_DOCS = ("carnet_frontal_url", "carnet_trasero_url", "foto_perfil_verificada_url")


# ============================================================================
# Clase: VerificationOrchestrator
# Coordina la validación mediante Didit (primario) o el pipeline casero
# (OCR + biometría) como fallback transparente.
# ============================================================================
class VerificationOrchestrator:

    @classmethod
    def evaluate_user_verification(
        cls,
        user_id: str,
        external_state: Optional[str],
        external_payload: Optional[Dict[str, Any]],
        manual_documents: Optional[Dict[str, Any]],
        user_rut: Optional[str] = None,
    ) -> VerificationResult:
        """
        Evalúa el estado del usuario priorizando Didit; si Didit no está
        aprobado pero existen los documentos caseros completos, aplica el
        fallback OCR. Nunca lanza: si nada aplica, devuelve un estado pendiente.
        """
        # 1. Bloque: Camino primario — Didit aprobó la verificación
        if external_state == "aprobada":
            return cls._build_didit_success_result(user_id, external_payload or {})

        # 2. Bloque: Camino de fallback — documentos caseros completos
        docs = manual_documents or {}
        if all(docs.get(field) for field in _REQUIRED_FALLBACK_DOCS):
            return cls._build_fallback_result(user_id, docs, user_rut=user_rut)

        # 3. Bloque: Sin condiciones cumplidas — pendiente / en revisión
        return VerificationResult(
            status=external_state or "pending",
            provider="didit" if external_state else "inhouse_ocr",
            is_identity_verified=False,
            is_license_verified=False,
            is_liveness_verified=False,
            reasons=["Verificación no completada aún"],
        )

    # ------------------------------------------------------------------------
    @classmethod
    def _build_didit_success_result(cls, user_id: str, payload: Dict[str, Any]) -> VerificationResult:
        """
        Construye el resultado aprobado de Didit, rebajando todas las fotos
        temporales del proveedor a Supabase Storage permanente.
        """
        # Bloque: Extracción de los datos normalizados del proveedor
        data = payload.get("datos") or payload.get("data") or {}

        # Bloque: Persistencia permanente de cédula y selfie
        #
        # La licencia de conducir NO se persiste ni se da por verificada acá:
        # Didit todavía no reconoce licencias de conducir de forma confiable
        # (su workflow solo certifica el documento de identidad). Verificarla
        # queda enteramente a cargo del pipeline casero con Google Vision
        # (ver `completar_licencia` / `OCRService`), sin importar si la
        # identidad se resolvió por Didit o por el fallback casero.
        persisted = persist_verification_assets(
            {
                "verified_avatar_url": data.get("foto_url") or data.get("foto_perfil_verificada_url"),
                "front_card_url": data.get("carnet_frontal_url"),
                "back_card_url": data.get("carnet_trasero_url"),
            },
            user_id,
        )

        # Bloque: Armado del resultado unificado
        return VerificationResult(
            status="approved",
            provider="didit",
            is_identity_verified=True,
            is_license_verified=False,
            is_liveness_verified=True,
            extracted_full_name=data.get("nombre_completo") or data.get("nombre"),
            extracted_rut=data.get("rut"),
            extracted_birth_date=data.get("fecha_nacimiento"),
            verified_avatar_url=persisted.get("verified_avatar_url") or data.get("foto_url"),
            front_card_url=persisted.get("front_card_url") or data.get("carnet_frontal_url"),
            back_card_url=persisted.get("back_card_url") or data.get("carnet_trasero_url"),
            raw_payload=payload,
        )

    # ------------------------------------------------------------------------
    @classmethod
    def _build_fallback_result(
        cls, user_id: str, docs: Dict[str, Any], user_rut: Optional[str] = None
    ) -> VerificationResult:
        """
        Ejecuta el pipeline casero de OCR + biometría sobre los documentos que
        el usuario capturó con la cámara.
        """
        # Bloque: Llamada al motor de OCR de enrolamiento
        ocr_result = OCRService.procesar_documentos_enrolamiento(
            carnet_frontal_url=docs.get("carnet_frontal_url"),
            carnet_trasero_url=docs.get("carnet_trasero_url"),
            licencia_url=docs.get("licencia_url"),
            rut_usuario=user_rut or docs.get("rut"),
            selfie_url=docs.get("foto_perfil_verificada_url") or docs.get("selfie_url"),
            selfie_liveness_url=docs.get("selfie_liveness_url"),
            tipo_documento=docs.get("tipo_documento", "rut"),
            pais_documento=docs.get("pais_documento", "CL"),
        )

        # Bloque: Traducción del veredicto del OCR al resultado unificado
        recommended = ocr_result.get("estado_recomendado", "requiere_revision_manual")
        is_ok = recommended == "verificado"

        return VerificationResult(
            status="approved" if is_ok else ("declined" if recommended == "rechazado" else "in_review"),
            provider="inhouse_ocr",
            is_identity_verified=is_ok,
            is_license_verified=is_ok and not ocr_result.get("licencia_a_soporte"),
            is_liveness_verified=ocr_result.get("verificacion_facial") == "ok",
            extracted_full_name=ocr_result.get("nombre_extraido"),
            extracted_rut=ocr_result.get("rut_extraido"),
            verified_avatar_url=docs.get("foto_perfil_verificada_url") or docs.get("selfie_url"),
            front_card_url=docs.get("carnet_frontal_url"),
            back_card_url=docs.get("carnet_trasero_url"),
            license_url=docs.get("licencia_url"),
            reasons=[ocr_result["motivo"]] if ocr_result.get("motivo") else [],
            raw_payload=ocr_result,
        )
