# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

class Settings(BaseSettings):
    PROJECT_NAME: str = "Arrienda Tu Auto API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "supersecretkey-for-local-dev-change-in-production"

    # Database
    DATABASE_URL: str = "sqlite:///./rentacar_dev.db"

    # Supabase
    SUPABASE_URL: str = "https://your-project.supabase.co"
    SUPABASE_ANON_KEY: str = "your-supabase-anon-key-placeholder"
    SUPABASE_SERVICE_ROLE_KEY: str = "your-supabase-service-role-key-placeholder"
    SUPABASE_STORAGE_BUCKET: str = "arrienda-tu-auto-files"

    # Business Rules
    HOLD_ENROLAMIENTO_CLP: int = 800000
    SEGURO_DEDUCIBLE_UF: int = 15
    VALOR_UF_CLP: int = 37500
    COMISION_PLATAFORMA_PORCENTAJE: float = 0.20

    # OCR & Google Cloud Vision
    USE_OCR_MOCK: bool = False
    GOOGLE_CLOUD_VISION_API_KEY: Optional[str] = None
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None

    # Microservicio de OCR (apps/ocr). Si OCR_SERVICE_URL está seteada, el
    # enrolamiento delega el procesamiento de documentos a ese servicio vía
    # HTTP. Si queda vacía, el backend usa un mock local (dev / tests).
    OCR_SERVICE_URL: Optional[str] = None
    OCR_SERVICE_KEY: str = "dev-ocr-key"
    OCR_HTTP_TIMEOUT: float = 45.0

    # Google Maps
    GOOGLE_MAPS_API_KEY: str = "placeholder-maps-key"

    # Transbank Webpay Plus (Sandbox / Producción)
    TBK_COMMERCE_CODE: str = "597055555532"
    TBK_API_KEY: str = "579B532A7440BBAB610796F8393E2D5E"
    TBK_ENVIRONMENT: str = "INTEGRACION" # INTEGRACION | PRODUCCION

    # Storage Local Directory Fallback
    STORAGE_LOCAL_DIR: str = "./uploads"

    # CORS: orígenes explícitos permitidos (dev: web local + Expo web).
    # Agregar aquí el dominio de producción de apps/web cuando exista.
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8081",
        "http://localhost:19006",
    ]

    # Rate limiting (slowapi/limits). "memory://" alcanza para un solo
    # proceso (dev, o un único worker uvicorn). En producción con más de un
    # worker/proceso, apuntar a Redis (ya usado por Celery) para que el
    # límite se comparta entre procesos, ej: "redis://localhost:6379/1".
    RATE_LIMIT_STORAGE_URI: str = "memory://"
    RATE_LIMIT_DEFAULT: str = "200/minute"

    # Celery & Redis
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
