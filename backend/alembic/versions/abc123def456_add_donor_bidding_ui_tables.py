"""Add donor bidding UI tables and fields

Revision ID: abc123def456
Revises: 9ee8000056a7
Create Date: 2026-02-07 20:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "abc123def456"
down_revision = "9ee8000056a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new fields to auction_items table
    op.add_column(
        "auction_items",
        sa.Column("current_bid_amount", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "auction_items",
        sa.Column("min_next_bid_amount", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "auction_items",
        sa.Column("bid_count", sa.Integer, nullable=False, server_default="0"),
    )
    op.add_column(
        "auction_items",
        sa.Column("bidding_open", sa.Boolean, nullable=False, server_default="false"),
    )
    op.add_column(
        "auction_items",
        sa.Column("watcher_count", sa.Integer, nullable=False, server_default="0"),
    )
    op.add_column(
        "auction_items",
        sa.Column("promotion_badge", sa.String(50), nullable=True),
    )
    op.add_column(
        "auction_items",
        sa.Column("promotion_notice", sa.Text, nullable=True),
    )

    # Create watch_list_entries table
    op.create_table(
        "watch_list_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auction_items.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("item_id", "user_id", name="uq_watch_list_item_user"),
    )

    # Create item_views table
    op.create_table(
        "item_views",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auction_items.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("view_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("view_duration_seconds", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint("view_duration_seconds >= 0", name="ck_item_views_duration_nonnegative"),
    )

    # Create item_promotions table
    op.create_table(
        "item_promotions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auction_items.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
            unique=True,
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "updated_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("badge_label", sa.String(50), nullable=True),
        sa.Column("notice_message", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Create buy_now_availability table
    op.create_table(
        "buy_now_availability",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auction_items.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
            unique=True,
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "updated_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("remaining_quantity", sa.Integer, nullable=False, server_default="0"),
        sa.Column("override_reason", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "remaining_quantity >= 0", name="ck_buy_now_availability_quantity_nonnegative"
        ),
    )


def downgrade() -> None:
    # Drop tables
    op.drop_table("buy_now_availability")
    op.drop_table("item_promotions")
    op.drop_table("item_views")
    op.drop_table("watch_list_entries")

    # Remove columns from auction_items
    op.drop_column("auction_items", "promotion_notice")
    op.drop_column("auction_items", "promotion_badge")
    op.drop_column("auction_items", "watcher_count")
    op.drop_column("auction_items", "bidding_open")
    op.drop_column("auction_items", "bid_count")
    op.drop_column("auction_items", "min_next_bid_amount")
    op.drop_column("auction_items", "current_bid_amount")
