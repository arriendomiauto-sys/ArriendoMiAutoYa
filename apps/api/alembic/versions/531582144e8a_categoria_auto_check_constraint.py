"""categoria_auto_check_constraint

Revision ID: 531582144e8a
Revises: d3f8a1c9b247
Create Date: 2026-09-15 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = '531582144e8a'
down_revision: Union[str, None] = 'd3f8a1c9b247'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """`autos.categoria` solo se validaba como Literal en el schema Pydantic,
    no en la base de datos: una fila insertada por otro camino (script, panel
    admin directo a la BD) podía quedar con un valor libre. Se agrega como
    NOT VALID + VALIDATE aparte para no tomar un lock largo sobre la tabla
    mientras valida las filas existentes.
    """
    op.execute(
        """
        ALTER TABLE autos
        ADD CONSTRAINT ck_auto_categoria_valida
        CHECK (categoria IN ('economico', 'sedan', 'suv', 'camioneta', 'premium'))
        NOT VALID
        """
    )
    op.execute("ALTER TABLE autos VALIDATE CONSTRAINT ck_auto_categoria_valida")


def downgrade() -> None:
    op.execute("ALTER TABLE autos DROP CONSTRAINT ck_auto_categoria_valida")
