"""plazo de confirmación del dueño y motivo de cancelación de la reserva

Revision ID: b7e2a5c91d04
Revises: a4c1e9d27b30
Create Date: 2026-09-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b7e2a5c91d04"
down_revision: Union[str, None] = "a4c1e9d27b30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ambas nullable: las reservas anteriores a la política quedan sin plazo y el barrido no las toca.
    op.add_column("reservas", sa.Column("confirmar_dueno_antes_de", sa.DateTime(), nullable=True))
    op.add_column("reservas", sa.Column("motivo_cancelacion", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("reservas", "motivo_cancelacion")
    op.drop_column("reservas", "confirmar_dueno_antes_de")
