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

    # OCR & Verificación de Identidad / Biometría (Veridas, Google Vision, Mock)
    KYC_PROVIDER: str = "veridas" # "veridas" | "google_vision" | "mock"
    VERIDAS_API_URL: str = "https://api.veridas.com"
    VERIDAS_API_KEY: Optional[str] = None
    VERIDAS_UMBRAL_FACEMATCH: float = 0.70 # Coincidencia facial mínima requerida (0.0 a 1.0)
    VERIDAS_UMBRAL_LIVENESS: float = 0.50 # Prueba de vida pasiva mínima (0.0 a 1.0)

    # Rastreo GPS de la flota. El mercado chileno no tiene un convenio único:
    # se opera con equipo en comodato + suscripción mensual por vehículo, así
    # que el vendor se enchufa por configuración igual que el proveedor KYC.
    GPS_PROVIDER: str = "mock" # "mock" | <vendor cuando se contrate>
    GPS_API_URL: Optional[str] = None
    GPS_API_KEY: Optional[str] = None

    USE_OCR_MOCK: bool = False
    GOOGLE_CLOUD_VISION_API_KEY: Optional[str] = None
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None

    # Google Maps
    GOOGLE_MAPS_API_KEY: str = "placeholder-maps-key"

    # Transbank Webpay Plus (Sandbox / Producción)
    TBK_COMMERCE_CODE: str = "597055555532"
    TBK_API_KEY: str = "579B532A7440BBAB610796F8393E2D5E"
    TBK_ENVIRONMENT: str = "INTEGRACION" # INTEGRACION | PRODUCCION

    # ===== BLOQUE TEMPORAL — PAGOS SIMULADOS ==============================
    # Mientras la cuenta de Transbank no esté configurada, esto deja pasar el
    # flujo dando el pago y la retención por aprobados, sin salir a la red.
    # Es SOLO para pruebas: se ignora en producción (ver pagos_simulados.py).
    # Al configurar la pasarela real, borrar esta opción junto con
    # app/services/pagos_simulados.py y sus dos usos en app/routers/pagos.py.
    PAGOS_SIMULADOS: bool = False
    # ======================================================================

    # Storage Local Directory Fallback
    STORAGE_LOCAL_DIR: str = "./uploads"

    # Respaldo local de los buckets privados (documentos-kyc, checklists,
    # evidencias, documentos-autos). Va en un árbol aparte porque
    # STORAGE_LOCAL_DIR se publica entero como estático en /uploads: un
    # carnet ahí queda legible por cualquiera que tenga la URL.
    STORAGE_LOCAL_PRIVATE_DIR: str = "./uploads_privados"

    # URLs de Producción de la Plataforma
    FRONTEND_URL: str = "https://arriendatuauto.com"
    ADMIN_PANEL_ORIGIN: Optional[str] = "https://admin.arriendatuauto.com"
    WEBPAY_DEFAULT_RETURN_URL: str = "https://arriendatuauto.com/pago/retorno"

    # CORS: orígenes explícitos y seguros permitidos en producción y desarrollo
    CORS_ORIGINS: List[str] = [
        "https://arriendatuauto.com",
        "https://www.arriendatuauto.com",
        "https://app.arriendatuauto.com",
        "https://admin.arriendatuauto.com",
        "https://rgxiyidijtoazcrmijly.supabase.co",
        "http://localhost:3000",
        "http://localhost:8081",
        "http://localhost:19006",
        "http://localhost:3001",
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
