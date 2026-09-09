"""
Data models and schemas for the identity and document verification subsystem.
"""
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any

# ============================================================================
# Resultado unificado de verificación de identidad y documentos
# Permite desacoplar el origen (Didit vs OCR Casero) del resto del sistema
# ============================================================================
@dataclass
class VerificationResult:
    status: str  # "approved" | "declined" | "in_review" | "pending"
    provider: str  # "didit" | "inhouse_ocr" | "manual_admin"
    is_identity_verified: bool
    is_license_verified: bool
    is_liveness_verified: bool
    extracted_full_name: Optional[str] = None
    extracted_rut: Optional[str] = None
    extracted_birth_date: Optional[str] = None
    extracted_license_category: Optional[str] = None
    extracted_license_expiration: Optional[str] = None
    verified_avatar_url: Optional[str] = None
    front_card_url: Optional[str] = None
    back_card_url: Optional[str] = None
    license_url: Optional[str] = None
    reasons: List[str] = field(default_factory=list)
    raw_payload: Dict[str, Any] = field(default_factory=dict)
