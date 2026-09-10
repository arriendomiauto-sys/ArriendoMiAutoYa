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
    # Secret de firma del JWT del proyecto (Supabase → Settings → API → JWT
    # Secret). Si está seteado y el proyecto firma con HS256, la validación de
    # sesión se hace localmente sin llamar a `/auth/v1/user` en cada request.
    SUPABASE_JWT_SECRET: Optional[str] = None

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

    # Verificación de identidad con proveedor externo (Didit).
    #
    # Apagado por defecto: sin esto, el enrolamiento sigue funcionando con el
    # OCR + control facial in-process de siempre (verificacion_identidad). Al
    # encenderlo, el flujo pasa a una sesión hosted de Didit (foto de cédula +
    # liveness + face match + validación del RUT contra Registro Civil) y el
    # resultado llega por webhook firmado.
    #
    # Se necesita: DIDIT_API_KEY (consola Didit), DIDIT_WORKFLOW_ID (el flujo
    # que define los pasos) y DIDIT_WEBHOOK_SECRET (secret_shared_key del
    # destino de webhook). Plan gratuito: 500 verificaciones/mes.
    VERIFICACION_EXTERNA_HABILITADA: bool = False
    DIDIT_BASE_URL: str = "https://verification.didit.me"
    DIDIT_API_KEY: Optional[str] = None
    DIDIT_WORKFLOW_ID: Optional[str] = None
    DIDIT_WEBHOOK_SECRET: Optional[str] = None
    # A dónde vuelve el usuario tras completar la sesión de Didit. Deep link a
    # la app; si queda vacío, Didit muestra su propia pantalla de cierre.
    DIDIT_CALLBACK_URL: Optional[str] = None

    # Verificación de antecedentes del conductor (ChapiAPI).
    #
    # Sin llave (o en desarrollo) el proveedor responde un mock con
    # antecedentes limpios y licencia sin suspensión, para no bloquear el
    # enrolamiento. Con llave real, se consulta la Hoja de Vida del Conductor
    # y los antecedentes penales por RUT antes de habilitar a la persona.
    CHAPI_API_KEY: Optional[str] = None
    CHAPI_BASE_URL: str = "https://api.chapi.cl/v1"

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
    MERCADOPAGO_WEBHOOK_SECRET: Optional[str] = None
    # Cuando está activo, usa test@testuser.com como pagador para que Mercado Pago
    # permita procesar tarjetas de prueba sin rechazar por comprador no autorizado.
    MERCADOPAGO_TEST_MODE: bool = True

    # ===== BLOQUE TEMPORAL — PAGOS SIMULADOS ==============================
    # Mientras la cuenta de Mercado Pago no esté configurada, esto deja pasar el
    # flujo dando el pago y la retención por aprobados, sin salir a la red.
    # Es SOLO para pruebas: se ignora en producción (ver pagos_simulados.py).
    #
    # Viene ENCENDIDO por defecto a propósito para desarrollo local sin credenciales externas.
    # En producción se mantiene desactivado.
    PAGOS_SIMULADOS: bool = True
    # ======================================================================

    # ===== Pagos automáticos a dueños (transferencias BCI) ================
    # OFF por defecto: encendido, las liquidaciones se transfieren solas.
    BCI_PAYOUTS_HABILITADO: bool = False
    # Mock por defecto: no sale a la red, da las transferencias por acreditadas.
    BCI_PAYOUTS_MOCK: bool = True
    BCI_API_URL: Optional[str] = None
    BCI_API_KEY: Optional[str] = None
    # No intentar transferencias por montos ínfimos (se acumulan / se pagan a mano).
    BCI_PAYOUT_MIN_CLP: int = 1000
    LIQUIDACIONES_INTERVALO_MINUTOS: int = 10
    # ====================================================================

    # Storage Local Directory Fallback
    STORAGE_LOCAL_DIR: str = "./uploads"

    # Respaldo local de los buckets privados (documentos-kyc, checklists,
    # evidencias, documentos-autos). Va en un árbol aparte porque
    # STORAGE_LOCAL_DIR se publica entero como estático en /uploads: un
    # carnet ahí queda legible por cualquiera que tenga la URL.
    STORAGE_LOCAL_PRIVATE_DIR: str = "./uploads_privados"

    # URLs de Producción de la Plataforma
    FRONTEND_URL: str = "https://arriendomiautoya.cl"
    # URL pública de esta API. Mercado Pago la necesita para avisarnos de los
    # pagos: sin webhook, un arrendatario que paga y cierra la app antes de
    # volver deja la reserva colgada en "pendiente" para siempre.
    API_PUBLIC_URL: str = "https://arriendomiautoya.onrender.com"
    ADMIN_PANEL_ORIGIN: Optional[str] = "https://admin.arriendomiautoya.cl"
    PAGO_DEFAULT_RETURN_URL: str = "https://arriendomiautoya.cl/pago/retorno"

    # CORS: orígenes explícitos y seguros permitidos en producción (solo dominios de plataforma)
    CORS_ORIGINS: List[str] = [
        "https://arriendomiautoya.cl",
        "https://www.arriendomiautoya.cl",
        "https://admin.arriendomiautoya.cl",
        "https://arriendatuauto.com",
        "https://www.arriendatuauto.com",
        "https://app.arriendatuauto.com",
        "https://admin.arriendatuauto.com",
        "https://rgxiyidijtoazcrmijly.supabase.co",
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

    @property
    def allowed_cors_origins(self) -> List[str]:
        origins = list(self.CORS_ORIGINS)
        if self.ADMIN_PANEL_ORIGIN and self.ADMIN_PANEL_ORIGIN not in origins:
            origins.append(self.ADMIN_PANEL_ORIGIN)
        # Solo orígenes seguros de la plataforma; rechazar estrictamente localhost y 127.0.0.1
        return [o for o in origins if not ("localhost" in o or "127.0.0.1" in o)]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
