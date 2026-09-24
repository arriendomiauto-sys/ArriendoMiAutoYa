"""lo que el OCR leyó de cada documento del auto (folio, vencimiento)

Revision ID: e2b7c4f19a35
Revises: d6e9a1b4c028
Create Date: 2026-09-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e2b7c4f19a35"
down_revision: Union[str, None] = "d6e9a1b4c028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("autos", sa.Column("documentos_ocr", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("autos", "documentos_ocr")
