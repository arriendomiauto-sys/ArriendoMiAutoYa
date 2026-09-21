"""claves de los recordatorios de la política de reservas ya enviados

Revision ID: d6e9a1b4c028
Revises: c5d8f0a3b917
Create Date: 2026-09-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d6e9a1b4c028"
down_revision: Union[str, None] = "c5d8f0a3b917"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reservas", sa.Column("recordatorios_politica", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("reservas", "recordatorios_politica")
