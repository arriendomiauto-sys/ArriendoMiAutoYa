from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

es_sqlite = settings.DATABASE_URL.startswith("sqlite")

connect_args = {}
engine_kwargs = {}
if es_sqlite:
    connect_args["check_same_thread"] = False
    # sqlite `:memory:` da una base vacía distinta por conexión: sin un pool
    # de conexión única, `create_all()` en una conexión y las queries en otra
    # no se ven (típico en tests y en el dev server multi-hilo). StaticPool
    # comparte la conexión — inofensivo también para un archivo sqlite local.
    from sqlalchemy.pool import StaticPool
    engine_kwargs["poolclass"] = StaticPool
else:
    # Postgres (Supabase / Render): las conexiones ociosas se cierran del
    # lado del servidor / pgbouncer. pre_ping descarta las muertas antes de
    # usarlas y recycle las renueva antes de que expiren.
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 280

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=settings.DEBUG and es_sqlite,
    **engine_kwargs,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
