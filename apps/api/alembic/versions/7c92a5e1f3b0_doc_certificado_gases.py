"""doc_certificado_gases

Revision ID: 7c92a5e1f3b0
Revises: 531582144e8a
Create Date: 2026-09-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '7c92a5e1f3b0'
down_revision: Union[str, None] = '531582144e8a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """El certificado de emisión de gases pasa de ser un marcador OCR dentro
    de la revisión técnica a un documento propio, obligatorio para publicar."""
    op.add_column('autos', sa.Column('doc_certificado_gases_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('autos', 'doc_certificado_gases_url')
