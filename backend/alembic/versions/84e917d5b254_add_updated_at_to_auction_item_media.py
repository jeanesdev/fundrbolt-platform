"""add_updated_at_to_auction_item_media

Revision ID: 84e917d5b254
Revises: 5e3098959c73
Create Date: 2025-11-15 13:41:52.878936

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "84e917d5b254"
down_revision = "5e3098959c73"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add updated_at column to auction_item_media table
    op.add_column(
        "auction_item_media",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    # Remove updated_at column from auction_item_media table
    op.drop_column("auction_item_media", "updated_at")
