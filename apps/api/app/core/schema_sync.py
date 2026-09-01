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

Sobre los defaults
------------------
`Column(..., default=X)` de SQLAlchemy es un default **de Python**: se
aplica al insertar vía ORM y no emite cláusula DEFAULT en el DDL. Por eso
un `ADD COLUMN` dejaba en NULL todas las filas preexistentes, y cualquier
campo Pydantic no-Optional que leyera esa columna respondía 500
(`ResponseValidationError`). Fue exactamente lo que pasó con
`autos.documentos_verificados` en `GET /autos`.

Acá se resuelve en dos frentes:

1. `sync_missing_columns()` emite `DEFAULT <literal>` cuando el modelo
   declara un default estático, así el motor rellena las filas existentes
   en el mismo ALTER.
2. `backfill_null_defaults()` repara el daño ya hecho: rellena los NULL
   que quedaron de columnas agregadas antes de este arreglo.
"""
import json
import logging

from sqlalchemy import inspect, literal, text
from sqlalchemy.schema import CreateColumn
from sqlalchemy.types import JSON, DateTime

from app.core.database import Base, engine

logger = logging.getLogger(__name__)

# Tipos que se aceptan como DEFAULT de tabla. Deja fuera a propósito
# `datetime`/`date`/`UUID`: son valores por fila, no constantes del esquema.
_TIPOS_CONSTANTES = (bool, int, float, str, list, dict)


def _es_json(col) -> bool:
    return isinstance(col.type, JSON)


def _default_estatico(col):
    """
    Valor constante que el modelo usa como default para esta columna, o
    `(False, None)` si no tiene o si no es constante.

    Un callable como `generate_uuid` o `utc_now` también es un default, pero
    devuelve algo distinto en cada llamada: usarlo como DEFAULT del DDL le
    pondría el MISMO uuid/timestamp a todas las filas existentes. Se detecta
    invocándolo dos veces y exigiendo que coincida.
    """
    d = col.default
    if d is None:
        return (False, None)

    # Las PK se generan por fila; nunca corresponde un default de tabla.
    if col.primary_key:
        return (False, None)

    if getattr(d, "is_scalar", False):
        return (True, d.arg)

    if getattr(d, "is_callable", False):
        try:
            # SQLAlchemy envuelve el callable para que reciba el contexto.
            primero = d.arg(None)
            segundo = d.arg(None)
        except Exception:
            return (False, None)

        # Dos compuertas, porque ninguna alcanza sola:
        #
        # - Por tipo: `utc_now` es "dinámico" pero dos llamadas seguidas
        #   pueden devolver lo mismo (la resolución del reloj en Windows es
        #   más gruesa que el microsegundo). Confiar solo en la igualdad
        #   estampaba una fecha fija como DEFAULT de la tabla.
        # - Por igualdad: `generate_uuid` devuelve `str`, que sí es un tipo
        #   constante válido, y solo se descarta porque cambia en cada
        #   llamada.
        if not isinstance(primero, _TIPOS_CONSTANTES):
            return (False, None)
        if primero != segundo:
            return (False, None)

        return (True, primero)

    return (False, None)


def _literal_sql(col, valor) -> str:
    """Renderiza `valor` como literal SQL para el dialecto activo."""
    if _es_json(col):
        valor = json.dumps(valor)
    return str(
        literal(valor).compile(engine, compile_kwargs={"literal_binds": True})
    )


def _clausula_default(col):
    """Fragmento `DEFAULT ...` para el ADD COLUMN, o "" si no aplica."""
    tiene, valor = _default_estatico(col)
    if tiene:
        return f" DEFAULT {_literal_sql(col, valor)}"
    return ""


def _valor_post_alter(col):
    """
    Valor con el que rellenar las filas existentes justo después del ALTER,
    para defaults que no se pueden expresar como literal del DDL.

    Hoy cubre las fechas con default dinámico (`utc_now`). No se resuelve con
    `DEFAULT CURRENT_TIMESTAMP` porque SQLite rechaza el ALTER completo
    ("Cannot add a column with non-constant default") y la columna terminaba
    sin agregarse. A las filas viejas les queda la hora de la migración —una
    aproximación, no el dato real— pero evita dejar en NULL una columna que
    el schema de respuesta declara obligatoria.
    """
    if col.primary_key or col.default is None:
        return (False, None)
    if not isinstance(col.type, DateTime):
        return (False, None)
    if not getattr(col.default, "is_callable", False):
        return (False, None)
    try:
        return (True, col.default.arg(None))
    except Exception:
        return (False, None)


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
            clausula_default = _clausula_default(col)

            # Con un DEFAULT el motor rellena las filas existentes, así que
            # NOT NULL sí se puede mantener. Sin default hay que aflojarlo o
            # el ALTER falla en una tabla con filas.
            forzar_nullable = (
                (not col.nullable)
                and not clausula_default
                and col.server_default is None
            )
            if forzar_nullable:
                col_ddl = col_ddl.replace(" NOT NULL", "")

            # El DEFAULT va antes de NOT NULL para que el DDL sea válido.
            if clausula_default:
                if " NOT NULL" in col_ddl:
                    col_ddl = col_ddl.replace(" NOT NULL", f"{clausula_default} NOT NULL")
                else:
                    col_ddl = f"{col_ddl}{clausula_default}"

            sql = f'ALTER TABLE "{tabla.name}" ADD COLUMN {col_ddl}'
            rellenar, valor_post = _valor_post_alter(col)
            try:
                with engine.begin() as conn:
                    conn.execute(text(sql))
                    if rellenar:
                        conn.execute(
                            text(
                                f'UPDATE "{tabla.name}" SET "{col.name}" = :valor '
                                f'WHERE "{col.name}" IS NULL'
                            ),
                            {"valor": valor_post},
                        )
                logger.warning(
                    "schema_sync: agregada columna %s.%s%s%s%s",
                    tabla.name,
                    col.name,
                    clausula_default,
                    f" (filas existentes rellenadas con {valor_post!r})" if rellenar else "",
                    " (como NULL)" if forzar_nullable and not rellenar else "",
                )
            except Exception as e:
                logger.error("schema_sync: no se pudo agregar %s.%s: %s", tabla.name, col.name, e)


def backfill_null_defaults() -> int:
    """
    Rellena con su default los NULL de columnas que lo declaran en el modelo.

    Repara las columnas agregadas por versiones anteriores de este módulo,
    que hacían ADD COLUMN sin cláusula DEFAULT y dejaban NULL en todas las
    filas previas. Devuelve cuántas columnas se tocaron.
    """
    inspector = inspect(engine)
    tablas_existentes = set(inspector.get_table_names())
    columnas_reparadas = 0

    for tabla in Base.metadata.sorted_tables:
        if tabla.name not in tablas_existentes:
            continue

        cols_reales = {c["name"] for c in inspector.get_columns(tabla.name)}

        for col in tabla.columns:
            if col.name not in cols_reales:
                continue

            tiene, valor = _default_estatico(col)
            if not tiene:
                continue

            if _es_json(col):
                valor = json.dumps(valor)

            try:
                with engine.begin() as conn:
                    # Sonda barata: evita un UPDATE de tabla completa cuando
                    # no hay nada que reparar (el caso normal al arrancar).
                    hay_nulos = conn.execute(
                        text(f'SELECT 1 FROM "{tabla.name}" WHERE "{col.name}" IS NULL LIMIT 1')
                    ).first()
                    if not hay_nulos:
                        continue

                    resultado = conn.execute(
                        text(
                            f'UPDATE "{tabla.name}" SET "{col.name}" = :valor '
                            f'WHERE "{col.name}" IS NULL'
                        ),
                        {"valor": valor},
                    )
                columnas_reparadas += 1
                logger.warning(
                    "schema_sync: %s.%s tenía %s filas en NULL — rellenadas con %r",
                    tabla.name, col.name, resultado.rowcount, valor,
                )
            except Exception as e:
                logger.error(
                    "schema_sync: no se pudo rellenar %s.%s: %s", tabla.name, col.name, e
                )

    return columnas_reparadas
