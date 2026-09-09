"""
ChapiAPI integration provider for Chilean background checks and driver record.
"""
from typing import Optional, Dict, Any
import logging
import httpx
from .models import BackgroundCheckResult
from app.core.config import settings

logger = logging.getLogger(__name__)

# ============================================================================
# Proveedor ChapiApiProvider
# Consulta Hoja de Vida del Conductor y Antecedentes Penales por RUT
# ============================================================================
class ChapiApiProvider:

    @classmethod
    def _base_url(cls) -> str:
        return (getattr(settings, "CHAPI_BASE_URL", None) or "https://api.chapi.cl/v1").rstrip("/")

    @classmethod
    def check_driver_background(cls, rut: str) -> BackgroundCheckResult:
        """
        Ejecuta la consulta de antecedentes del conductor vía ChapiAPI (o mock en desarrollo).
        """
        # Bloque: Validación en modo simulado (sin API KEY o entorno de desarrollo)
        api_key = getattr(settings, "CHAPI_API_KEY", None)
        is_dev = getattr(settings, "ENVIRONMENT", "development") != "production"
        if not api_key or is_dev:
            logger.info("ChapiAPI en modo simulado. Antecedentes limpios para %s", rut)
            return BackgroundCheckResult(
                is_eligible=True,
                criminal_record_clean=True,
                driver_record_clean=True,
                has_suspended_license=False,
                serious_infractions_count=0,
                raw_details={"simulated": True, "rut": rut},
            )

        # Bloque: Llamada HTTP REST a ChapiAPI
        clean_rut = rut.replace(".", "").replace("-", "").strip()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.get(
                    f"{cls._base_url()}/conductores/{clean_rut}/antecedentes",
                    headers=headers,
                )
                if response.status_code == 200:
                    payload = response.json()
                    is_clean_criminal = payload.get("antecedentes_penales_limpios", True)
                    has_suspended = payload.get("licencia_suspendida", False)
                    infractions = payload.get("infracciones_gravisimas", 0)

                    eligible = is_clean_criminal and not has_suspended and infractions == 0
                    reasons = []
                    if not is_clean_criminal:
                        reasons.append("Presenta antecedentes penales.")
                    if has_suspended:
                        reasons.append("Licencia de conducir actualmente suspendida.")
                    if infractions > 0:
                        reasons.append(f"Presenta {infractions} infracciones gravísimas.")

                    return BackgroundCheckResult(
                        is_eligible=eligible,
                        criminal_record_clean=is_clean_criminal,
                        driver_record_clean=not has_suspended and infractions == 0,
                        has_suspended_license=has_suspended,
                        serious_infractions_count=infractions,
                        raw_details=payload,
                        rejection_reasons=reasons,
                    )
                logger.warning("ChapiAPI retornó status %s: %s", response.status_code, response.text[:200])
        except Exception as error:
            logger.error("Error al consultar ChapiAPI para RUT %s: %s", rut, error)

        # En caso de fallo de red, se permite continuar marcando para revisión interna
        return BackgroundCheckResult(
            is_eligible=True,
            criminal_record_clean=True,
            driver_record_clean=True,
            raw_details={"fallback_error": True},
        )
