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
from app.core.schema_sync import sync_missing_columns, backfill_null_defaults
from app.core.seed import seed_demo_data
from app.core.limiter import limiter
from app.core.security_headers import SecurityHeadersMiddleware
from app.core.request_limit import RequestSizeLimitMiddleware
from app.services.recordatorios import iniciar_bucle_recordatorios

logger = logging.getLogger(__name__)

from app.routers import (
    auth,
    entrega,
    enrolamiento,
    cars,
    reservas,
    disputas,
    soporte,
    admin,
    calificaciones,
    pagos,
    storage,
    usuarios,
    gestion_flota,
    mensajes,
    ws_chat,
    notificaciones,
    favoritos,
)

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
    # Repara los NULL que dejaron las columnas agregadas antes de que
    # sync_missing_columns() emitiera cláusula DEFAULT (un campo Pydantic
    # no-Optional sobre una de esas columnas responde 500).
    backfill_null_defaults()
    os.makedirs(settings.STORAGE_LOCAL_DIR, exist_ok=True)
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()

    # Recordatorios de entrega/devolución (24h y 2h antes). No hay
    # Celery/Redis en este proyecto: es un bucle liviano dentro del propio
    # proceso — ver app/services/recordatorios.py para el porqué y sus
    # límites conocidos.
    tarea_recordatorios = iniciar_bucle_recordatorios(SessionLocal)

    yield

    tarea_recordatorios.cancel()
    try:
        await tarea_recordatorios
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
_cors_origins = list(settings.CORS_ORIGINS)
if settings.ADMIN_PANEL_ORIGIN:
    _cors_origins.append(settings.ADMIN_PANEL_ORIGIN)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir archivos estáticos locales de respaldo (Uploads).
#
# Solo los buckets públicos. El respaldo de los buckets privados
# (documentos-kyc, checklists, evidencias, documentos-autos) vive en
# STORAGE_LOCAL_PRIVATE_DIR y NO se monta acá: se sirve por
# GET /api/v1/storage/local/{bucket}/{archivo_id}, que exige sesión.
# Montar STORAGE_LOCAL_DIR entero dejaba los carnets legibles con solo
# conocer la URL.
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

# Incluir routers
api_prefix = settings.API_V1_STR
app.include_router(auth.router, prefix=api_prefix)
app.include_router(entrega.router, prefix=api_prefix)
app.include_router(enrolamiento.router, prefix=api_prefix)
app.include_router(cars.router, prefix=api_prefix)
app.include_router(reservas.router, prefix=api_prefix)
app.include_router(disputas.router, prefix=api_prefix)
app.include_router(soporte.router, prefix=api_prefix)
app.include_router(admin.router, prefix=api_prefix)
app.include_router(calificaciones.router, prefix=api_prefix)
app.include_router(pagos.router, prefix=api_prefix)
app.include_router(storage.router, prefix=api_prefix)
app.include_router(usuarios.router, prefix=api_prefix)
app.include_router(gestion_flota.router, prefix=api_prefix)
app.include_router(mensajes.router, prefix=api_prefix)
app.include_router(ws_chat.router, prefix=api_prefix)
app.include_router(notificaciones.router, prefix=api_prefix)
app.include_router(favoritos.router, prefix=api_prefix)

# Montar servidor Socket.IO para chat en tiempo real
import socketio
from app.services.socketio_server import sio
app.mount("/socket.io", socketio.ASGIApp(sio, socketio_path=""))

@app.get("/", tags=["Health"])
def root():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs"
    }

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}
