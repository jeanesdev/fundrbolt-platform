"""add bid_increment to auction_items

Revision ID: babe721dff11
Revises: 84e917d5b254
Create Date: 2025-11-17 07:41:28.495122

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "babe721dff11"
down_revision = "84e917d5b254"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add bid_increment column with default value
    op.add_column(
        "auction_items",
        sa.Column(
            "bid_increment",
            sa.Numeric(precision=10, scale=2),
            nullable=False,
            server_default="50.00",
        ),
    )

    # Add check constraint for positive bid_increment
    op.create_check_constraint(
        "ck_auction_items_bid_increment_positive", "auction_items", "bid_increment > 0"
    )


def downgrade() -> None:
    # Remove check constraint
    op.drop_constraint("ck_auction_items_bid_increment_positive", "auction_items", type_="check")

    # Remove column
    op.drop_column("auction_items", "bid_increment")
