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

    # Mercado Pago.
    #
    # El entorno no se configura aparte: lo dice el propio token. Los de prueba
    # empiezan con `TEST-` y los productivos con `APP_USR-`, así que es
    # imposible creer que estás en sandbox y estar cobrando de verdad.
    MERCADOPAGO_ACCESS_TOKEN: Optional[str] = None
    # Pública por definición: la usa el SDK del cliente para tokenizar la
    # tarjeta sin que el número toque nuestro backend.
    MERCADOPAGO_PUBLIC_KEY: Optional[str] = None
    # Firma los webhooks. Sin esto, cualquiera que conozca la URL podría avisar
    # "el pago 123 fue aprobado" y confirmar reservas gratis.
    MERCADOPAGO_WEBHOOK_SECRET: Optional[str] = None

    # ===== BLOQUE TEMPORAL — PAGOS SIMULADOS ==============================
    # Mientras la cuenta de Mercado Pago no esté configurada, esto deja pasar el
    # flujo dando el pago y la retención por aprobados, sin salir a la red.
    # Es SOLO para pruebas: se ignora en producción (ver pagos_simulados.py).
    #
    # Viene ENCENDIDO por defecto a propósito, porque hoy no hay credenciales
    # reales y sin esto el flujo de reserva queda trancado en "pendiente". Al
    # configurar la pasarela real hay que ponerlo en False y borrar el bloque
    # completo: app/services/pagos_simulados.py y sus usos en
    # app/routers/pagos.py.
    PAGOS_SIMULADOS: bool = True
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
    # URL pública de esta API. Mercado Pago la necesita para avisarnos de los
    # pagos: sin webhook, un arrendatario que paga y cierra la app antes de
    # volver deja la reserva colgada en "pendiente" para siempre.
    API_PUBLIC_URL: str = "https://api.arriendatuauto.com"
    ADMIN_PANEL_ORIGIN: Optional[str] = "https://admin.arriendatuauto.com"
    PAGO_DEFAULT_RETURN_URL: str = "https://arriendatuauto.com/pago/retorno"

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
