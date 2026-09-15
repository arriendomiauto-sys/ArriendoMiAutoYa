"""licencia_didit

Revision ID: d3f8a1c9b247
Revises: c1d400bb56cd
Create Date: 2026-09-15 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd3f8a1c9b247'
down_revision: Union[str, None] = 'c1d400bb56cd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Columnas de la sesión Didit de verificación de licencia (workflow separado del de identidad)."""
    op.add_column('usuarios', sa.Column('licencia_verificacion_externa_ref', sa.String(), nullable=True))
    op.add_column('usuarios', sa.Column('licencia_verificacion_externa_estado', sa.String(), nullable=True))
    op.add_column('usuarios', sa.Column('licencia_verificacion_externa_actualizada', sa.DateTime(), nullable=True))
    op.create_index(
        op.f('ix_usuarios_licencia_verificacion_externa_ref'),
        'usuarios', ['licencia_verificacion_externa_ref'], unique=False,
    )

    op.add_column('conductores_adicionales', sa.Column('licencia_verificacion_externa_ref', sa.String(), nullable=True))
    op.add_column('conductores_adicionales', sa.Column('licencia_verificacion_externa_estado', sa.String(), nullable=True))
    op.add_column('conductores_adicionales', sa.Column('licencia_verificacion_externa_actualizada', sa.DateTime(), nullable=True))
    op.create_index(
        op.f('ix_conductores_adicionales_licencia_verificacion_externa_ref'),
        'conductores_adicionales', ['licencia_verificacion_externa_ref'], unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_conductores_adicionales_licencia_verificacion_externa_ref'),
        table_name='conductores_adicionales',
    )
    op.drop_column('conductores_adicionales', 'licencia_verificacion_externa_actualizada')
    op.drop_column('conductores_adicionales', 'licencia_verificacion_externa_estado')
    op.drop_column('conductores_adicionales', 'licencia_verificacion_externa_ref')

    op.drop_index(op.f('ix_usuarios_licencia_verificacion_externa_ref'), table_name='usuarios')
    op.drop_column('usuarios', 'licencia_verificacion_externa_actualizada')
    op.drop_column('usuarios', 'licencia_verificacion_externa_estado')
    op.drop_column('usuarios', 'licencia_verificacion_externa_ref')
