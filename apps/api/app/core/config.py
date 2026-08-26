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

    # Celery & Redis
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
