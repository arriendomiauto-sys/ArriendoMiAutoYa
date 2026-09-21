"""aviso de llegada de cada parte al punto de encuentro (base de la multa por no presentación)

Revision ID: c5d8f0a3b917
Revises: b7e2a5c91d04
Create Date: 2026-09-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c5d8f0a3b917"
down_revision: Union[str, None] = "b7e2a5c91d04"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reservas", sa.Column("llegada_cliente_en", sa.DateTime(), nullable=True))
    op.add_column("reservas", sa.Column("llegada_dueno_en", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("reservas", "llegada_dueno_en")
    op.drop_column("reservas", "llegada_cliente_en")
