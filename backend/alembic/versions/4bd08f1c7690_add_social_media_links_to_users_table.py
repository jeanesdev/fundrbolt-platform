"""Add social_media_links to users table

Revision ID: 4bd08f1c7690
Revises: 6d803d2bd0f1
Create Date: 2025-11-19 08:34:34.114432

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "4bd08f1c7690"
down_revision = "6d803d2bd0f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add social_media_links column to users table
    op.add_column(
        "users",
        sa.Column(
            "social_media_links",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=True,
            comment="Social media platform URLs (facebook, twitter, instagram, linkedin, youtube, website)",
        ),
    )


def downgrade() -> None:
    # Remove social_media_links column from users table
    op.drop_column("users", "social_media_links")
