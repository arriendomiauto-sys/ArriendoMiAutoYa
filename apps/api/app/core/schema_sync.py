"""
Sincronizador de esquema mínimo, sin Alembic.

El proyecto no tiene historial de migraciones: en local se regenera el
SQLite borrando el archivo, pero contra Postgres (Supabase) eso no sirve.
`Base.metadata.create_all()` crea tablas nuevas pero NUNCA agrega columnas
a tablas que ya existen, así que al sumar un campo al modelo el primer
`SELECT` revienta con "column ... does not exist".

Esto recorre los modelos y hace `ALTER TABLE ADD COLUMN` para cada columna
que falte en la tabla real. Es aditivo: no borra ni renombra ni cambia
tipos — solo cubre el caso de "agregué un campo al modelo".
"""
import logging

from sqlalchemy import inspect, text
from sqlalchemy.schema import CreateColumn

from app.core.database import Base, engine

logger = logging.getLogger(__name__)


def sync_missing_columns() -> None:
    inspector = inspect(engine)
    tablas_existentes = set(inspector.get_table_names())

    for tabla in Base.metadata.sorted_tables:
        if tabla.name not in tablas_existentes:
            continue  # create_all() ya la crea completa

        cols_reales = {c["name"] for c in inspector.get_columns(tabla.name)}

        for col in tabla.columns:
            if col.name in cols_reales:
                continue

            col_ddl = str(CreateColumn(col).compile(engine)).strip()

            # No se puede agregar NOT NULL sin default a una tabla con filas:
            # se agrega como NULL para no romper el arranque.
            forzar_nullable = (not col.nullable) and col.default is None and col.server_default is None
            if forzar_nullable:
                col_ddl = col_ddl.replace(" NOT NULL", "")

            sql = f'ALTER TABLE "{tabla.name}" ADD COLUMN {col_ddl}'
            try:
                with engine.begin() as conn:
                    conn.execute(text(sql))
                logger.warning(
                    "schema_sync: agregada columna %s.%s%s",
                    tabla.name, col.name, " (como NULL)" if forzar_nullable else "",
                )
            except Exception as e:
                logger.error("schema_sync: no se pudo agregar %s.%s: %s", tabla.name, col.name, e)
