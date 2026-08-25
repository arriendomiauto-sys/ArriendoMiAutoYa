from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.core.seed import seed_demo_data

import os
from fastapi.staticfiles import StaticFiles

from app.routers import (
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
    usuarios
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Crear tablas automáticamente si es SQLite local
    Base.metadata.create_all(bind=engine)
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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir archivos estáticos locales de respaldo (Uploads)
os.makedirs(settings.STORAGE_LOCAL_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.STORAGE_LOCAL_DIR), name="uploads")

# Incluir routers
api_prefix = settings.API_V1_STR
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
