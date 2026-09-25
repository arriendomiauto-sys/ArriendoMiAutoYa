"""cuándo se pidió al arrendatario renovar la garantía que vence antes del arriendo

Revision ID: a8d3e6f20c91
Revises: f4a9c2d71e58
Create Date: 2026-09-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a8d3e6f20c91"
down_revision: Union[str, None] = "f4a9c2d71e58"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotente: en producción la columna ya la crea schema_sync al arrancar la API.
    columnas = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("reservas")}
    if "garantia_renovacion_pedida_en" not in columnas:
        op.add_column("reservas", sa.Column("garantia_renovacion_pedida_en", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("reservas", "garantia_renovacion_pedida_en")
