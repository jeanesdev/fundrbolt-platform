"""Add display fields to auction items.

Revision ID: auction_001_add_display_fields
Revises: 9e1a7a4bb2c1
Create Date: 2026-06-22 09:00:00.000000
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "auction_001_add_display_fields"
down_revision = "9e1a7a4bb2c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new boolean columns with default False
    op.add_column(
        "auction_items",
        sa.Column(
            "display_starting_bid",
            sa.Boolean(),
            nullable=False,
            server_default="false",
            default=False,
        ),
    )
    op.add_column(
        "auction_items",
        sa.Column(
            "display_fair_market_value",
            sa.Boolean(),
            nullable=False,
            server_default="false",
            default=False,
        ),
    )


def downgrade() -> None:
    # Drop new columns
    op.drop_column("auction_items", "display_fair_market_value")
    op.drop_column("auction_items", "display_starting_bid")
