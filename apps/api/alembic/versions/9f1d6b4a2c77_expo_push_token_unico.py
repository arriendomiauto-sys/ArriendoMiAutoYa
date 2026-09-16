"""expo_push_token_unico

Revision ID: 9f1d6b4a2c77
Revises: 7c92a5e1f3b0
Create Date: 2026-09-16 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text as sa_text


revision: str = '9f1d6b4a2c77'
down_revision: Union[str, None] = '7c92a5e1f3b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """`expo_push_token` no tenía restricción de unicidad: en un dispositivo
    compartido, si un usuario cerraba sesión sin limpiar su token, el
    siguiente usuario que se logueaba en ese mismo dispositivo terminaba con
    el MISMO token registrado en su propia cuenta — dos filas con el mismo
    token, y un push dirigido al primer usuario llegaba al dispositivo del
    segundo. Antes de poder exigir unicidad hay que limpiar los duplicados
    que ya puedan existir: se deja el token en NULL en todas las filas que lo
    compartan (no hay forma confiable de saber cuál de las dos cuentas es la
    dueña real hoy) — el dueño real lo vuelve a registrar solo, en su
    próximo login (PUT /usuarios/me/push-token corre automático al abrir la
    app logueada).
    """
    op.execute(
        """
        UPDATE usuarios
        SET expo_push_token = NULL
        WHERE expo_push_token IS NOT NULL
          AND expo_push_token IN (
              SELECT expo_push_token FROM usuarios
              WHERE expo_push_token IS NOT NULL
              GROUP BY expo_push_token
              HAVING COUNT(*) > 1
          )
        """
    )
    op.create_index(
        "uq_usuarios_expo_push_token",
        "usuarios",
        ["expo_push_token"],
        unique=True,
        postgresql_where=sa_text("expo_push_token IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_usuarios_expo_push_token", table_name="usuarios")
