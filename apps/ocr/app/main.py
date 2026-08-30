"""
Arrienda Tu Auto — Microservicio de OCR de documentos.

Expone el pipeline de enrolamiento (cédula + licencia + selfie) como HTTP.
El backend lo consume vía OCR_SERVICE_URL; si no está configurado, el
backend cae a un mock local y este servicio no se usa.
"""
import logging

from fastapi import FastAPI, Header, HTTPException, status

from .config import settings
from .engine import OCREngine
from .schemas import DocumentosRequest, OCRResultado, HealthResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.SERVICE_NAME,
    version="1.0.0",
    description="OCR de cédula de identidad y licencia de conducir chilenas.",
)


def _verificar_clave(x_ocr_key: str | None) -> None:
    """Si OCR_SERVICE_KEY está seteada, se exige que el header coincida."""
    if settings.OCR_SERVICE_KEY and x_ocr_key != settings.OCR_SERVICE_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Clave de servicio inválida o ausente.",
        )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    api_key, tiene_creds = OCREngine._credenciales_vision()
    return HealthResponse(
        service=settings.SERVICE_NAME,
        ocr_mock=settings.USE_OCR_MOCK,
        vision_configurado=bool(api_key or tiene_creds),
    )


@app.post("/v1/procesar-documentos", response_model=OCRResultado)
def procesar_documentos(
    payload: DocumentosRequest,
    x_ocr_key: str | None = Header(default=None, alias="X-OCR-Key"),
) -> OCRResultado:
    _verificar_clave(x_ocr_key)

    resultado = OCREngine.procesar_documentos_enrolamiento(
        carnet_frontal_url=payload.carnet_frontal_url,
        carnet_trasero_url=payload.carnet_trasero_url,
        licencia_url=payload.licencia_url,
        rut_usuario=payload.rut_usuario,
        selfie_url=payload.selfie_url,
    )
    return OCRResultado.from_engine(resultado)
