"""Add profile_picture_url to users table

Revision ID: 6d803d2bd0f1
Revises: b581d537bb64
Create Date: 2025-11-19 08:18:38.729363

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "6d803d2bd0f1"
down_revision = "b581d537bb64"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add profile_picture_url column to users table
    op.add_column("users", sa.Column("profile_picture_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    # Remove profile_picture_url column from users table
    op.drop_column("users", "profile_picture_url")
