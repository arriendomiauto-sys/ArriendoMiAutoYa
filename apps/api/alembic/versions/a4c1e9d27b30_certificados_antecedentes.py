"""certificados de antecedentes + anotaciones/encargo del auto

Revision ID: a4c1e9d27b30
Revises: 9f1d6b4a2c77
Create Date: 2026-09-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a4c1e9d27b30"
down_revision: Union[str, None] = "9f1d6b4a2c77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "certificados_antecedentes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("sujeto_tipo", sa.String(), nullable=False),
        sa.Column("sujeto_id", sa.String(), nullable=False),
        sa.Column("tipo", sa.String(), nullable=False),
        sa.Column("archivo_url", sa.String(), nullable=True),
        sa.Column("sha256", sa.String(), nullable=True),
        sa.Column("rut_detectado", sa.String(), nullable=True),
        sa.Column("patente_detectada", sa.String(), nullable=True),
        sa.Column("folio", sa.String(), nullable=True),
        sa.Column("codigo_verificacion", sa.String(), nullable=True),
        sa.Column("emitido_en", sa.DateTime(), nullable=True),
        sa.Column("estado", sa.String(), nullable=False, server_default="revision"),
        sa.Column("contenido_ok", sa.Boolean(), server_default=sa.false()),
        sa.Column("motivo", sa.Text(), nullable=True),
        sa.Column("resultado_json", sa.JSON(), nullable=True),
        sa.Column("consentimiento_en", sa.DateTime(), nullable=True),
        sa.Column("subido_por_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("revisado_por_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("revisado_en", sa.DateTime(), nullable=True),
        sa.Column("creado_en", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_certificados_antecedentes_sujeto_id", "certificados_antecedentes", ["sujeto_id"])
    op.create_index("ix_certificados_antecedentes_estado", "certificados_antecedentes", ["estado"])

    op.add_column("autos", sa.Column("doc_anotaciones_vigentes_url", sa.String(), nullable=True))
    op.add_column("autos", sa.Column("encargo_robo_estado", sa.String(), server_default="sin_consultar"))
    op.add_column("autos", sa.Column("encargo_robo_consultado_en", sa.DateTime(), nullable=True))
    op.add_column("autos", sa.Column("encargo_robo_consultado_por", sa.String(), nullable=True))
    op.add_column("autos", sa.Column("anotaciones_aprobadas_en", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("autos", "anotaciones_aprobadas_en")
    op.drop_column("autos", "encargo_robo_consultado_por")
    op.drop_column("autos", "encargo_robo_consultado_en")
    op.drop_column("autos", "encargo_robo_estado")
    op.drop_column("autos", "doc_anotaciones_vigentes_url")
    op.drop_index("ix_certificados_antecedentes_estado", table_name="certificados_antecedentes")
    op.drop_index("ix_certificados_antecedentes_sujeto_id", table_name="certificados_antecedentes")
    op.drop_table("certificados_antecedentes")
