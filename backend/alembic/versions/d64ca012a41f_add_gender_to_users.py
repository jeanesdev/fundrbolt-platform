"""add_gender_to_users

Revision ID: d64ca012a41f
Revises: survey_005
Create Date: 2026-06-06 08:02:49.016006

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "d64ca012a41f"
down_revision = "survey_005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("gender", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "gender")
