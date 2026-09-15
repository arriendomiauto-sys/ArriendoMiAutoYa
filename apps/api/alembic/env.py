import logging
import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Alembic no agrega el dir de trabajo al sys.path: se deja a la vista el
# paquete `app/` (raíz = apps/api, un nivel arriba de alembic/env.py), igual
# que hace pytest.ini con `pythonpath = .`.
_RAIZ_PROYECTO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _RAIZ_PROYECTO not in sys.path:
    sys.path.insert(0, _RAIZ_PROYECTO)

# ----------------------------------------------------------------
# Metadatos del esquema para `alembic autogenerate`.
#
# Ojo: `Base.metadata` solo conoce los modelos que estén IMPORTADOS al llegar
# aquí. El patrón del proyecto es que todos los modelos viven en
# `app/models/entities.py` (basta importar ese módulo para registrarlos en
# `Base.metadata`). Si más adelante se suman modelos en `app/features/*`,
# hay que importarlos acá también (igual que `app/main.py` importa los
# routers de cada feature) para que `autogenerate` los incluya.
#
# Los imports de modelos no se usan por valor: existen solo por su efecto
# secundario (registrar las tablas en `Base.metadata`), por eso el noqa.
# ----------------------------------------------------------------
import app.core.database as dbs  # noqa: F401  (Base declarativa del proyecto)
import app.models.entities       # noqa: F401  (registra todos los modelos)
from app.core.config import settings  # noqa: E402
from app.core.database import Base     # noqa: E402

# La URL de conexión viene del Settings de la app (mismo origen que
# app/core/database.py), no de alembic.ini. `set_main_option` interpreta
# `%(...)s` como interpolación: se escapan los `%` por si el DATABASE_URL
# trae un password con caracteres especiales (p. ej. `%40@`).
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option(
    "sqlalchemy.url",
    settings.DATABASE_URL.replace("%", "%%"),
)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Genera el SQL sin abrir una conexión (alembic upgrade head --sql)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Conecta a la base y ejecuta las migraciones pendientes."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()