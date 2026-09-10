import asyncio
import os
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.core.schema_sync import (
    sync_missing_columns,
    backfill_null_defaults,
    reconcile_check_constraints,
    backfill_cuentas_cobro,
)
from app.core.limiter import limiter
from app.core.security_headers import SecurityHeadersMiddleware
from app.core.request_limit import RequestSizeLimitMiddleware
from app.features.communications.notifications.reminders_service import iniciar_bucle_recordatorios

# Auth & Identity
from app.features.auth.login.router import router as auth_router
from app.features.auth.users.router import router as users_router
from app.features.auth.onboarding.router import router as onboarding_router
from app.features.auth.onboarding.didit_router import router as didit_onboarding_router

# Vehicles
from app.features.vehicles.catalog.router import router as cars_router
from app.features.vehicles.fleet.router import router as fleet_router

# Bookings
from app.features.bookings.reservations.router import router as bookings_router
from app.features.bookings.delivery.router import router as delivery_router

# Payments
from app.features.payments.router import router as payments_router
from app.features.payments.checkout_router import router as checkout_router

# Communications
from app.features.communications.messages.router import router as messages_router
from app.features.communications.notifications.router import router as notifications_router

# Operations
from app.features.operations.admin.router import router as admin_router
from app.features.operations.disputes.router import router as disputes_router
from app.features.operations.favorites.router import router as favorites_router
from app.features.operations.reviews.router import router as reviews_router
from app.features.operations.support.router import router as support_router

# System
from app.features.system.storage.router import router as storage_router
from app.features.system.webhooks.router import router as webhooks_router

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Crear tablas automáticamente si es SQLite local. create_all() no altera
    # tablas ya existentes: si agregas una columna a un modelo, borra
    # rentacar_dev.db (gitignored, se regenera solo) o quedará desincronizada
    # y todo lo que use TestClient (tests, uvicorn --reload) fallará con
    # "no such column" al chocar contra el schema viejo en disco.
    Base.metadata.create_all(bind=engine)
    # create_all() no altera tablas ya existentes: esto agrega las columnas
    # que se hayan sumado a los modelos (Postgres no se puede "regenerar
    # borrando el archivo" como el SQLite local).
    sync_missing_columns()
    # Recrea las CHECK de Postgres que se quedaron viejas (schema.sql tenía un
    # set de valores y el código sumó estados después, p. ej. reservas.estado
    # 'pendiente_pago'). No-op en SQLite.
    reconcile_check_constraints()
    # Repara los NULL que dejaron las columnas agregadas antes de que
    # sync_missing_columns() emitiera cláusula DEFAULT (un campo Pydantic
    # no-Optional sobre una de esas columnas responde 500).
    backfill_null_defaults()
    # Migra usuario.cuenta_bancaria (JSON) -> tabla cuentas_cobro (idempotente).
    backfill_cuentas_cobro()
    os.makedirs(settings.STORAGE_LOCAL_DIR, exist_ok=True)

    # Recordatorios de entrega/devolución (24h y 2h antes)
    tarea_recordatorios = iniciar_bucle_recordatorios(SessionLocal)

    # Barrido periódico de liquidaciones a dueños (solo si los payouts BCI están activos)
    tarea_liquidaciones = None
    if settings.BCI_PAYOUTS_HABILITADO:
        from app.features.payments.liquidaciones_loop import iniciar_bucle_liquidaciones
        tarea_liquidaciones = iniciar_bucle_liquidaciones(SessionLocal)

    yield

    tarea_recordatorios.cancel()
    if tarea_liquidaciones:
        tarea_liquidaciones.cancel()
    for t in (tarea_recordatorios, tarea_liquidaciones):
        if t:
            try:
                await t
            except asyncio.CancelledError:
                pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend oficial de 'Arrienda Tu Auto' (Marketplace P2P en Los Ángeles, Chile)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Rate limiting: límite global por IP contra abuso/fuerza bruta (además
# protege a Supabase de quedar expuesto a un aluvión de tokens basura, ya
# que get_current_user le hace una llamada real por cada request
# autenticado). Endpoints puntuales de mayor riesgo (subida de archivos,
# publicar auto, crear reserva, completar enrolamiento) tienen además su
# propio límite más estricto, definido en cada router.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Middlewares de Seguridad Global (Cabeceras OWASP y Límite de Tamaño Anti-DoS)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)

# CORS: solo orígenes conocidos (ver settings.CORS_ORIGINS). Las apps
# mobile no envían Origin (no son navegador), así que esto solo afecta a
# apps/web y a Expo en modo web durante desarrollo. El panel admin
# (RentACar-admin, proyecto aparte) se agrega por separado vía
# ADMIN_PANEL_ORIGIN — no vive en CORS_ORIGINS porque es un cliente
# administrativo distinto, no una app de cara al público.
# CORS: solo orígenes oficiales de producción (ver settings.allowed_cors_origins).
_cors_origins = settings.allowed_cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Servir archivos estáticos locales de respaldo (Uploads).
os.makedirs(settings.STORAGE_LOCAL_DIR, exist_ok=True)
os.makedirs(settings.STORAGE_LOCAL_PRIVATE_DIR, exist_ok=True)
for _bucket_publico in ("autos", "general"):
    _dir_publico = os.path.join(settings.STORAGE_LOCAL_DIR, _bucket_publico)
    os.makedirs(_dir_publico, exist_ok=True)
    app.mount(
        f"/uploads/{_bucket_publico}",
        StaticFiles(directory=_dir_publico),
        name=f"uploads-{_bucket_publico}",
    )

# Incluir routers por feature
api_prefix = settings.API_V1_STR
app.include_router(auth_router, prefix=api_prefix)
app.include_router(delivery_router, prefix=api_prefix)
app.include_router(onboarding_router, prefix=api_prefix)
app.include_router(didit_onboarding_router, prefix=api_prefix)
app.include_router(cars_router, prefix=api_prefix)
app.include_router(bookings_router, prefix=api_prefix)
app.include_router(disputes_router, prefix=api_prefix)
app.include_router(support_router, prefix=api_prefix)
app.include_router(admin_router, prefix=api_prefix)
app.include_router(reviews_router, prefix=api_prefix)
app.include_router(payments_router, prefix=api_prefix)
app.include_router(checkout_router, prefix=api_prefix)
app.include_router(storage_router, prefix=api_prefix)
app.include_router(users_router, prefix=api_prefix)
app.include_router(fleet_router, prefix=api_prefix)
app.include_router(messages_router, prefix=api_prefix)
app.include_router(notifications_router, prefix=api_prefix)
app.include_router(favorites_router, prefix=api_prefix)
app.include_router(webhooks_router, prefix=api_prefix)

# Montar servidor Socket.IO para chat en tiempo real
import socketio
from app.features.communications.messages.socketio_server import sio
app.mount("/socket.io", socketio.ASGIApp(sio, socketio_path=""))

# GET + HEAD: Render y los uptime pingers hacen `HEAD /` para el health check;
# sin HEAD explícito respondía 405 y ensuciaba los logs en cada sondeo.
# Fuera del schema OpenAPI: son sondeos, no API.
@app.api_route("/", methods=["GET", "HEAD"], tags=["Health"], include_in_schema=False)
def root():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs"
    }

@app.api_route("/health", methods=["GET", "HEAD"], tags=["Health"], include_in_schema=False)
def health_check():
    return {"status": "healthy"}
