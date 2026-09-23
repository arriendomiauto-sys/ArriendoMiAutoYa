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
    COMISION_PLATAFORMA_PORCENTAJE: float = 0.15

    # Rastreo GPS de la flota. El mercado chileno no tiene un convenio único:
    # se opera con equipo en comodato + suscripción mensual por vehículo, así
    # que el vendor se enchufa por configuración igual que el proveedor KYC.
    GPS_PROVIDER: str = "mock" # "mock" | <vendor cuando se contrate>
    GPS_API_URL: Optional[str] = None
    GPS_API_KEY: Optional[str] = None

    USE_OCR_MOCK: bool = False
    GOOGLE_CLOUD_VISION_API_KEY: Optional[str] = None
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None

    # Staff (admin/manager/soporte): un email SOLO promueve a uno de estos
    # roles si aparece, exacto y completo, en la lista correspondiente — antes
    # se promovía con que el email CONTUVIERA "admin"/"manager"/"soporte" en
    # cualquier parte (ej. "cualquiera+admin@gmail.com"), lo que permitía
    # autopromoción a admin con solo registrarse. Coma-separado, sin espacios
    # extra, no sensible a mayúsculas.
    STAFF_ADMIN_EMAILS: str = ""
    STAFF_MANAGER_EMAILS: str = ""
    STAFF_SOPORTE_EMAILS: str = ""

    @property
    def staff_admin_emails(self) -> set:
        return {e.strip().lower() for e in self.STAFF_ADMIN_EMAILS.split(",") if e.strip()}

    @property
    def staff_manager_emails(self) -> set:
        return {e.strip().lower() for e in self.STAFF_MANAGER_EMAILS.split(",") if e.strip()}

    @property
    def staff_soporte_emails(self) -> set:
        return {e.strip().lower() for e in self.STAFF_SOPORTE_EMAILS.split(",") if e.strip()}

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

    # Workflow separado de Didit para la licencia de conducir ("Flujo
    # Verificacion Licencias" en la consola): solo OCR, sin liveness ni face
    # match, con el documento "DL" habilitado para prácticamente todos los
    # países. Se crea como una segunda sesión hosted, independiente de la de
    # identidad — comparten API key y webhook secret, no el workflow.
    DIDIT_WORKFLOW_ID_LICENCIA: Optional[str] = None

    # Verificación de antecedentes con certificados oficiales gratuitos del Registro
    # Civil (antecedentes y hoja de vida del conductor para las personas; anotaciones
    # vigentes para los autos). Reemplaza a ChapiAPI, que aprobaba siempre en
    # desarrollo y también cuando fallaba la red.
    #
    # Apagado por defecto para no frenar el desarrollo ni a los usuarios que ya
    # operan: se enciende en producción cuando la cola de revisión del admin esté lista.
    ANTECEDENTES_OBLIGATORIOS: bool = False        # sin antecedentes "limpio" no se puede reservar
    AUTOS_VERIFICADOS_OBLIGATORIOS: bool = False   # un auto sin verificar no se ofrece ni se reserva
    ANTECEDENTES_VIGENCIA_DIAS: int = 30           # antigüedad máxima del certificado al subirlo
    ANTECEDENTES_RETENCION_DIAS: int = 30          # el PDF se purga pasado este plazo (queda el hash y el resultado)
    ANTECEDENTES_PURGA_INTERVALO_HORAS: int = 24   # cada cuánto se buscan PDF vencidos para borrar
    ANTECEDENTES_REVERIFICACION_DIAS: int = 180    # pasado este plazo desde la aprobación hay que volver a verificar

    # Google Maps
    GOOGLE_MAPS_API_KEY: str = "placeholder-maps-key"

    # Versión mínima de app móvil soportada (force update). Cambiarla es un
    # redeploy con la env var actualizada — se elige a propósito en vez de una
    # tabla en DB porque cambia poco y no necesita auditoría ni UI de edición.
    MIN_APP_VERSION: str = "1.0.0"
    # PENDIENTE: reemplazar por la URL real una vez que la app tenga ficha en
    # App Store Connect (todavía no está publicada).
    APP_STORE_URL_IOS: str = "https://apps.apple.com/app/idXXXXXXXXX"
    APP_STORE_URL_ANDROID: str = "https://play.google.com/store/apps/details?id=cl.arriendatuauto.app"

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
    # Cuando está activo, usa test@test.com como pagador para que Mercado Pago
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
    # Cada cuánto se cancelan las reservas `pendiente_pago` vencidas y se sueltan garantías colgadas.
    RESERVAS_BARRIDO_INTERVALO_MINUTOS: int = 5
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

    # ===== Sesión del panel admin (cookie httpOnly del refresh token) ======
    # El refresh token vive en una cookie httpOnly que el navegador manda sola;
    # el panel NO lo persiste en localStorage (XSS no equivale a robo de
    # sesión). El access token sigue yendose por header en el body de login.
    REFRESH_TOKEN_COOKIE_NAME: str = "refresh_token"
    # 60 días = lifetime por defecto del refresh token de Supabase Auth. La
    # cookie se regenera en cada /auth/refresh, así que la expiración real la
    # gobierna Supabase, no este max_age.
    REFRESH_TOKEN_COOKIE_MAX_AGE: int = 60 * 24 * 60 * 60
    # Forzar Secure en la cookie. None => auto: Secure en producción, off en
    # desarrollo local (donde el admin corre sobre http y la Secure rompería
    # la cookie en el navegador).
    AUTH_COOKIE_SECURE: Optional[bool] = None

    @property
    def auth_cookie_secure(self) -> bool:
        if self.AUTH_COOKIE_SECURE is not None:
            return self.AUTH_COOKIE_SECURE
        return self.ENVIRONMENT != "development"

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

    # Envío de contratos firmados por correo (Resend, resend.com). Apagado
    # si falta la API key: firmar_contrato sigue funcionando igual, solo no
    # se manda el correo — mismo criterio best-effort que el push de Expo.
    RESEND_API_KEY: Optional[str] = None
    # Remitente verificado en Resend. Sin un dominio verificado de verdad en
    # la cuenta del cliente, el envío falla igual aunque la API key esté
    # puesta — confirmar el dominio antes de encender esto en producción.
    RESEND_FROM_EMAIL: str = "contratos@arriendomiautoya.cl"
    RESEND_NOTIFICACIONES_EMAIL: str = "notificaciones@arriendomiautoya.cl"

    def advertencias_produccion(self) -> List[str]:
        """
        Config que en desarrollo queda apagada a propósito (verificación de
        antecedentes, identidad Didit) pero que en producción significaría que
        esas verificaciones nunca corren de verdad. No rompe el arranque -- solo
        lo hace ruidoso en los logs, para que no pase inadvertido igual que pasó
        con la licencia de Didit.
        """
        if self.ENVIRONMENT != "production":
            return []
        avisos = []
        if not self.ANTECEDENTES_OBLIGATORIOS:
            avisos.append(
                "ANTECEDENTES_OBLIGATORIOS está apagado: nadie está verificando los "
                "antecedentes ni la hoja de vida de quien arrienda un auto."
            )
        if not self.AUTOS_VERIFICADOS_OBLIGATORIOS:
            avisos.append(
                "AUTOS_VERIFICADOS_OBLIGATORIOS está apagado: un auto con documentos sin "
                "verificar (o con encargo por robo sin consultar) se ofrece y se puede reservar."
            )
        if self.VERIFICACION_EXTERNA_HABILITADA and not (
            self.DIDIT_API_KEY and self.DIDIT_WORKFLOW_ID and self.DIDIT_WEBHOOK_SECRET
        ):
            avisos.append(
                "VERIFICACION_EXTERNA_HABILITADA está en True pero falta DIDIT_API_KEY, "
                "DIDIT_WORKFLOW_ID o DIDIT_WEBHOOK_SECRET: el enrolamiento cae en "
                "silencio al OCR casero de siempre."
            )
        if self.VERIFICACION_EXTERNA_HABILITADA and not self.DIDIT_WORKFLOW_ID_LICENCIA:
            avisos.append(
                "VERIFICACION_EXTERNA_HABILITADA está en True pero falta "
                "DIDIT_WORKFLOW_ID_LICENCIA: la licencia de conducir cae en silencio "
                "a la captura manual con OCR casero."
            )
        return avisos

    @property
    def allowed_cors_origins(self) -> List[str]:
        origins = list(self.CORS_ORIGINS)
        if self.ADMIN_PANEL_ORIGIN and self.ADMIN_PANEL_ORIGIN not in origins:
            origins.append(self.ADMIN_PANEL_ORIGIN)
        # Solo orígenes seguros de la plataforma; rechazar estrictamente localhost y 127.0.0.1
        return [o for o in origins if not ("localhost" in o or "127.0.0.1" in o)]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
