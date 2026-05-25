"""add must_change_password to users

Revision ID: 0e231ed1bd15
Revises: social_auth_003
Create Date: 2026-05-25 09:51:34.549191

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "0e231ed1bd15"
down_revision = "social_auth_003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "must_change_password")
