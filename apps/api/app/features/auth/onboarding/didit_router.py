"""
Enrolment and KYC endpoints (English version).
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.core.limiter import limiter
from app.models.entities import Usuario, TicketSoporte
from app.features.auth.login.service import get_current_user
from app.features.auth.verification import VerificationOrchestrator
from app.features.auth.didit import didit as verificacion_didit
from app.schemas.schemas import (
    UserEnrolamiento,
    UserOut,
    EnrolamientoARevision,
    CompletarLicencia,
    SesionVerificacionExternaOut,
)
from app.features.auth.onboarding import router as legacy_enrolamiento

# Router principal con prefijo en inglés
router = APIRouter(prefix="/enrolment", tags=["Client Enrolment"])


# ============================================================================
# Endpoint: Crear sesión de verificación externa (Didit)
# ============================================================================
@router.post(
    "/external-verification/session",
    response_model=SesionVerificacionExternaOut,
    summary="Creates an external identity verification session (Didit)",
)
@limiter.limit("10/minute")
def create_external_verification_session(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Delegates to the existing Didit session creation logic.
    """
    return legacy_enrolamiento.crear_sesion_verificacion_externa(
        request=request, db=db, current_user=current_user
    )

# ============================================================================
# Endpoint: Procesar documentos con OCR casero
# ============================================================================
@router.post("/process-documents", summary="Extracts ID and license data via in-house OCR")
def process_documents(payload: UserEnrolamiento):
    return legacy_enrolamiento.procesar_documentos_ocr(payload=payload)

# ============================================================================
# Endpoint: Enviar a revisión manual
# ============================================================================
@router.post("/send-to-review", summary="Sends enrolment to manual support review")
@limiter.limit("5/minute")
def send_to_review(
    request: Request,
    payload: EnrolamientoARevision,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return legacy_enrolamiento.enviar_enrolamiento_a_revision(
        request=request, payload=payload, db=db, current_user=current_user
    )

# ============================================================================
# Endpoint: Completar enrolamiento (Didit primario con Fallback casero)
# ============================================================================
@router.post("/complete", response_model=UserOut, summary="Completes enrolment with hold charge")
@limiter.limit("10/minute")
def complete_enrolment(
    request: Request,
    payload: UserEnrolamiento,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Completa el enrolamiento aceptando tanto el veredicto de Didit como el
    fallback casero de OCR (lógica en `legacy_enrolamiento.completar_enrolamiento`,
    que ya consulta a Didit y, si no, corre el OCR). Tras verificar la
    identidad, dispara en background la verificación de antecedentes del
    conductor con ChapiAPI.
    """
    # Bloque: Delegación en la lógica de enrolamiento (Didit + OCR + hold).
    # completar_enrolamiento ya dispara su propia verificación de
    # antecedentes en background cuando corresponde — no hace falta
    # repetirla acá.
    return legacy_enrolamiento.completar_enrolamiento(
        request=request, payload=payload, background_tasks=background_tasks,
        db=db, current_user=current_user
    )

# ============================================================================
# Endpoint: Completar solo licencia
# ============================================================================
@router.post("/complete-license", response_model=UserOut, summary="Validates driver license only")
def complete_license(
    request: Request,
    payload: CompletarLicencia,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return legacy_enrolamiento.completar_licencia(
        request=request, payload=payload, background_tasks=background_tasks,
        db=db, current_user=current_user
    )
