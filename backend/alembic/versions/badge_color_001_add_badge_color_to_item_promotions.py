"""add_badge_color_to_item_promotions

Revision ID: badge_color_001
Revises: e4f5a6b7c8d9
Create Date: 2026-03-08 20:20:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "badge_color_001"
down_revision = "e4f5a6b7c8d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add badge_color to item_promotions table
    op.add_column(
        "item_promotions",
        sa.Column("badge_color", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("item_promotions", "badge_color")
