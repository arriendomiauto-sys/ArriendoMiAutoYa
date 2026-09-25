"""un celular = una cuenta: índice único parcial en usuarios.telefono

Revision ID: b3f7c2e84a16
Revises: a8d3e6f20c91
Create Date: 2026-09-25
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b3f7c2e84a16"
down_revision: Union[str, None] = "a8d3e6f20c91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDICE = "uq_usuarios_telefono"


def upgrade() -> None:
    bind = op.get_bind()
    # Idempotente: en producción el índice lo crea schema_sync al arrancar la API.
    if INDICE in {i["name"] for i in sa.inspect(bind).get_indexes("usuarios")}:
        return
    # Con celulares repetidos el índice no se puede crear. No se borra ni se
    # modifica ninguna cuenta desde acá: se avisa y hay que resolverlos a mano.
    duplicados = bind.execute(
        sa.text(
            "SELECT telefono, COUNT(*) FROM usuarios WHERE telefono IS NOT NULL "
            "GROUP BY telefono HAVING COUNT(*) > 1"
        )
    ).fetchall()
    if duplicados:
        raise RuntimeError(
            f"No se puede crear {INDICE}: hay {len(duplicados)} celulares en más de una cuenta. "
            "Resuélvelos antes de migrar (ver la consulta en esta migración)."
        )
    op.create_index(
        INDICE,
        "usuarios",
        ["telefono"],
        unique=True,
        postgresql_where=sa.text("telefono IS NOT NULL"),
        sqlite_where=sa.text("telefono IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(INDICE, table_name="usuarios")
