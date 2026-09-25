"""garantía (hold) propia por auto, sobrescribe la de la categoría

Revision ID: f4a9c2d71e58
Revises: e2b7c4f19a35
Create Date: 2026-09-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f4a9c2d71e58"
down_revision: Union[str, None] = "e2b7c4f19a35"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotente: en producción la columna ya la crea schema_sync al arrancar la API.
    columnas = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("autos")}
    if "garantia_clp" not in columnas:
        op.add_column("autos", sa.Column("garantia_clp", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("autos", "garantia_clp")
