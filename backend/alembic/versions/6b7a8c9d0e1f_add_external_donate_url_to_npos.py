"""add_external_donate_url_to_npos

Revision ID: 6b7a8c9d0e1f
Revises: c46f7c8f1b2a
Create Date: 2026-06-18 00:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "6b7a8c9d0e1f"
down_revision = "c46f7c8f1b2a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "npos",
        sa.Column("external_donate_now_url", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("npos", "external_donate_now_url")
