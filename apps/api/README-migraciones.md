# Migraciones de base de datos (Alembic)

Estado actual: **hay infraestructura de Alembic lista, pero aún no hay ninguna
migración generada** (la carpeta `alembic/versions/` solo tiene el `.gitkeep`).
Hoy el esquema se sigue creando/sincronizando en runtime.

## Estado actual (runtime sync, vigente a la fecha)

La app arranca y **sincroniza el esquema sola** en `app/main.py` (lifespan):

1. `Base.metadata.create_all(bind=engine)` crea tablas que no existan.
2. `sync_missing_columns()` agrega `ALTER TABLE ADD COLUMN` para columnas nuevas.
3. `reconcile_check_constraints()` recrea las CHECK de Postgres que quedaron viejas.
4. `backfill_*` reparan datos históricos (defaults NULL, cuentas de cobro).

Todo esto vive en `app/core/schema_sync.py` (y amigos). Es **aditivo**: no
borra columnas, no renombra, no cambia tipos, no trackea nada. Funciona para
desarrollo y tests, pero es frágil en producción:

- No hay historial de quién cambió qué ni cuándo.
- No permite rollback limpio.
- `create_all`/`ADD COLUMN` no modelan borrados ni cambios destructivos.
- Un deploy en producción con un schema distinto al que asume el código puede
  quedar medio-migrado.

**Por ahora no se desactiva el runtime sync**: desarrollo y tests dependen de él.
Este README documenta el plan para reemplazarlo de a poco.

## Infraestructura Alembic creada

```
apps/api/
├── alembic.ini            # script_location = alembic; SQLAlchemy.url NO se declara acá
├── alembic/
│   ├── env.py             # URL desde app.core.config.settings.DATABASE_URL + target_metadata
│   ├── script.py.mako     # template de revisiones
│   └── versions/          # aquí van las migraciones (hoy solo .gitkeep)
```

- La URL de conexión la **inyecta `alembic/env.py`** desde
  `app.core.config.settings.DATABASE_URL` (la misma fuente que
  `app/core/database.py`), **no** desde `alembic.ini`. Así no se duplica la
  cadena ni se versionan credenciales.
- `env.py` importa `app.core.database` y **todos los modelos** de
  `app/models/entities.py` para poblar `target_metadata`
  (`Base.metadata`) → `alembic autogenerate` ve el esquema completo. Cuando se
  sumen modelos en `app/features/*`, hay que importarlos ahí también (se
  documenta en un comentario dentro del propio `env.py`).
- `alembic.ini` NO lleva `seed` ni scripts de datos: solo migraciones de esquema.

## Plan de adopción (baseline → control)

1. **Generar la baseline** (una sola vez, contra un entorno seguro):

   ```powershell
   # Desde apps/api, contra el SQLite local de desarrollo:
   alembic revision --autogenerate -m "baseline esquema inicial"
   ```

   Antes de eso hay que `alembic stamp` la cabecera vacía para que Alembic
   sepa que el esquema ya existe y no intente re-crear tablas. El flujo
   recomendado cuando haya un schema vigente:

   ```powershell
   alembic stamp head            # marca el punto actual como "ya migrado"
   alembic revision --autogenerate -m "baseline esquema inicial"
   # revisar a mano el archivo generado en alembic/versions/ y ajustar
   # lo que el autogenerate no infiera (CHECKs, índices, defaults)
   alembic upgrade head          # aplicar en el entorno de dev
   ```

   El primer commit de migración debe revisarse a mano: `autogenerate` no
   siempre capta CHECK constraints, índices no-únicos, ni la semántica exacta
   de ciertos defaults.

2. **En deploy**: correr `alembic upgrade head` antes (o como parte) de arrancar
   la API. Ejemplo con Render/Railway: añadir un paso de release
   (`alembic upgrade head && uvicorn ...`).

3. **Desactivar el runtime sync cuando haya control**: una vez que la baseline
   y las migraciones cubran el esquema vigente y el equipo confíe en el flujo,
   desactivar la llamada a `sync_missing_columns()`/`create_all()` del lifespan
   de `app/main.py` y reemplazar los `backfill_*` por datos dentro de
   migraciones de datos (o `upgrade` idempotentes). Importante: **no** tocar
   `app/main.py` ni `app/core/schema_sync.py` en esta primera etapa; el cambio
   de régimen se hace en una iteración separada, con la baseline ya committeada.

## Comandos útiles

```powershell
# Desde apps/api
alembic history                     # lista migraciones (hoy vacía)
alembic current                     # revisión actual de la DB

# Generar un esqueleto de revisión vacío (sin tocar la DB real):
alembic revision -m "descripcion"

# Generar migración autogenerate (solo cuando el entorno sea seguro/local):
alembic revision --autogenerate -m "descripcion"

# Aplicar / revertir
alembic upgrade head
alembic downgrade -1

# Verboso para ver qué haría SIN conectar a la DB (offline):
alembic upgrade head --sql
```

> Ojo con la baseline contra producción: validar `--sql` en local con el
> SQLite antes de tocar Postgres de Supabase.

## Nota sobre .gitignore

El repo ignora `*.md` en la raíz (línea `*.md` del `.gitignore`). Si este
README debe quedar versionado, conviene permitirlo explícitamente, p. ej.:

```
!apps/api/README-migraciones.md
```
