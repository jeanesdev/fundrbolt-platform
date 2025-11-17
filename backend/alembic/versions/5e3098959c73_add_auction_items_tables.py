"""add_auction_items_tables

Revision ID: 5e3098959c73
Revises: 01d76fb1bf69
Create Date: 2025-11-14 07:13:46.646738

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "5e3098959c73"
down_revision = "01d76fb1bf69"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create auction_items table
    op.create_table(
        "auction_items",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("bid_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("auction_type", sa.String(20), nullable=False),
        sa.Column("starting_bid", sa.Numeric(10, 2), nullable=False),
        sa.Column("donor_value", sa.Numeric(10, 2), nullable=True),
        sa.Column("cost", sa.Numeric(10, 2), nullable=True),
        sa.Column("buy_now_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("buy_now_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("quantity_available", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("donated_by", sa.String(200), nullable=True),
        sa.Column(
            "sponsor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sponsors.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("item_webpage", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("display_priority", sa.Integer(), nullable=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("event_id", "bid_number", name="uq_auction_items_event_bid_number"),
        sa.CheckConstraint(
            "auction_type IN ('live', 'silent')", name="ck_auction_items_auction_type"
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'published', 'sold', 'withdrawn')", name="ck_auction_items_status"
        ),
        sa.CheckConstraint("starting_bid >= 0", name="ck_auction_items_starting_bid_nonnegative"),
        sa.CheckConstraint(
            "donor_value IS NULL OR donor_value >= 0",
            name="ck_auction_items_donor_value_nonnegative",
        ),
        sa.CheckConstraint("cost IS NULL OR cost >= 0", name="ck_auction_items_cost_nonnegative"),
        sa.CheckConstraint(
            "buy_now_price IS NULL OR buy_now_price >= starting_bid",
            name="ck_auction_items_buy_now_price_min",
        ),
        sa.CheckConstraint("quantity_available >= 1", name="ck_auction_items_quantity_min"),
        sa.CheckConstraint(
            "(buy_now_enabled = false) OR (buy_now_enabled = true AND buy_now_price IS NOT NULL)",
            name="ck_auction_items_buy_now_consistency",
        ),
    )

    # Create indexes for auction_items
    op.create_index(
        "idx_auction_items_event_id",
        "auction_items",
        ["event_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_auction_items_status",
        "auction_items",
        ["status"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_auction_items_auction_type",
        "auction_items",
        ["auction_type"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_auction_items_sponsor_id",
        "auction_items",
        ["sponsor_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_auction_items_event_status_type",
        "auction_items",
        ["event_id", "status", "auction_type"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_auction_items_bid_number",
        "auction_items",
        ["event_id", "bid_number"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # Create auction_item_media table
    op.create_table(
        "auction_item_media",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "auction_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auction_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("media_type", sa.String(20), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("thumbnail_path", sa.Text(), nullable=True),
        sa.Column("video_url", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("media_type IN ('image', 'video')", name="ck_auction_item_media_type"),
        sa.CheckConstraint("file_size > 0", name="ck_auction_item_media_file_size_positive"),
    )

    # Create indexes for auction_item_media
    op.create_index("idx_auction_item_media_item_id", "auction_item_media", ["auction_item_id"])
    op.create_index(
        "idx_auction_item_media_display_order",
        "auction_item_media",
        ["auction_item_id", "display_order"],
    )


def downgrade() -> None:
    # Drop indexes for auction_item_media
    op.drop_index("idx_auction_item_media_display_order", table_name="auction_item_media")
    op.drop_index("idx_auction_item_media_item_id", table_name="auction_item_media")

    # Drop auction_item_media table
    op.drop_table("auction_item_media")

    # Drop indexes for auction_items
    op.drop_index("idx_auction_items_bid_number", table_name="auction_items")
    op.drop_index("idx_auction_items_event_status_type", table_name="auction_items")
    op.drop_index("idx_auction_items_sponsor_id", table_name="auction_items")
    op.drop_index("idx_auction_items_auction_type", table_name="auction_items")
    op.drop_index("idx_auction_items_status", table_name="auction_items")
    op.drop_index("idx_auction_items_event_id", table_name="auction_items")

    # Drop auction_items table
    op.drop_table("auction_items")
