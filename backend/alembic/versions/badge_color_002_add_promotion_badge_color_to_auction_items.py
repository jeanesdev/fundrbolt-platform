"""add_promotion_badge_color_to_auction_items

Revision ID: badge_color_002
Revises: badge_color_001
Create Date: 2026-03-08 20:25:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "badge_color_002"
down_revision = "badge_color_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add denormalized badge_color to auction_items table (for fast reads)
    op.add_column(
        "auction_items",
        sa.Column("promotion_badge_color", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("auction_items", "promotion_badge_color")
