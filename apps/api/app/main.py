from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.core.schema_sync import sync_missing_columns
from app.core.seed import seed_demo_data
from app.core.limiter import limiter

import os
from fastapi.staticfiles import StaticFiles

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
    notificaciones,
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
    os.makedirs(settings.STORAGE_LOCAL_DIR, exist_ok=True)
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()
    yield

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

# CORS: solo orígenes conocidos (ver settings.CORS_ORIGINS). Las apps
# mobile no envían Origin (no son navegador), así que esto solo afecta a
# apps/web y a Expo en modo web durante desarrollo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir archivos estáticos locales de respaldo (Uploads)
os.makedirs(settings.STORAGE_LOCAL_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.STORAGE_LOCAL_DIR), name="uploads")

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
app.include_router(notificaciones.router, prefix=api_prefix)

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
