"""add_auction_bid_tables

Revision ID: c1f1c2d3e4f5
Revises: c8e2f7b4b9a1
Create Date: 2026-02-02 12:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "c1f1c2d3e4f5"
down_revision = "c8e2f7b4b9a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auction_bids",
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
        sa.Column(
            "auction_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auction_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("bidder_number", sa.Integer(), nullable=False),
        sa.Column("bid_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("max_bid", sa.Numeric(10, 2), nullable=True),
        sa.Column("bid_type", sa.String(20), nullable=False),
        sa.Column("bid_status", sa.String(20), nullable=False),
        sa.Column("transaction_status", sa.String(20), nullable=False),
        sa.Column("placed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "source_bid_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auction_bids.id", ondelete="SET NULL"),
            nullable=True,
        ),
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
        sa.CheckConstraint("bid_amount >= 0", name="ck_auction_bids_amount_nonnegative"),
        sa.CheckConstraint(
            "max_bid IS NULL OR max_bid >= bid_amount",
            name="ck_auction_bids_max_bid_min",
        ),
        sa.CheckConstraint(
            "bid_type IN ('regular', 'buy_now', 'proxy_auto')",
            name="ck_auction_bids_bid_type",
        ),
        sa.CheckConstraint(
            "bid_status IN ('active', 'outbid', 'winning', 'cancelled', 'withdrawn')",
            name="ck_auction_bids_bid_status",
        ),
        sa.CheckConstraint(
            "transaction_status IN ('pending', 'processing', 'processed', 'failed', 'refunded')",
            name="ck_auction_bids_transaction_status",
        ),
    )

    op.create_index("idx_auction_bids_event_id", "auction_bids", ["event_id"])
    op.create_index("idx_auction_bids_item_id", "auction_bids", ["auction_item_id"])
    op.create_index("idx_auction_bids_user_id", "auction_bids", ["user_id"])
    op.create_index("idx_auction_bids_bidder_number", "auction_bids", ["bidder_number"])
    op.create_index("idx_auction_bids_bid_status", "auction_bids", ["bid_status"])
    op.create_index(
        "idx_auction_bids_transaction_status",
        "auction_bids",
        ["transaction_status"],
    )
    op.create_index(
        "idx_auction_bids_event_item_placed",
        "auction_bids",
        ["event_id", "auction_item_id", "placed_at"],
    )
    op.create_index(
        "idx_auction_bids_event_user_placed",
        "auction_bids",
        ["event_id", "user_id", "placed_at"],
    )
    op.create_index("idx_auction_bids_source_bid_id", "auction_bids", ["source_bid_id"])

    op.create_table(
        "auction_bid_actions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "bid_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auction_bids.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "actor_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("action_type", sa.String(30), nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("metadata", postgresql.JSON(), nullable=True),
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
        sa.CheckConstraint(
            "action_type IN ('mark_winning', 'adjust_amount', 'cancel', 'override_payment')",
            name="ck_auction_bid_actions_action_type",
        ),
    )
    op.create_index("idx_auction_bid_actions_bid_id", "auction_bid_actions", ["bid_id"])
    op.create_index(
        "idx_auction_bid_actions_actor_id",
        "auction_bid_actions",
        ["actor_user_id"],
    )

    op.create_table(
        "paddle_raise_contributions",
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
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("bidder_number", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("tier_name", sa.String(100), nullable=False),
        sa.Column("placed_at", sa.DateTime(timezone=True), nullable=False),
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
        sa.CheckConstraint("amount >= 0", name="ck_paddle_raise_amount_nonnegative"),
    )
    op.create_index(
        "idx_paddle_raise_event_id",
        "paddle_raise_contributions",
        ["event_id"],
    )
    op.create_index(
        "idx_paddle_raise_user_id",
        "paddle_raise_contributions",
        ["user_id"],
    )
    op.create_index(
        "idx_paddle_raise_bidder_number",
        "paddle_raise_contributions",
        ["bidder_number"],
    )


def downgrade() -> None:
    op.drop_index("idx_paddle_raise_bidder_number", table_name="paddle_raise_contributions")
    op.drop_index("idx_paddle_raise_user_id", table_name="paddle_raise_contributions")
    op.drop_index("idx_paddle_raise_event_id", table_name="paddle_raise_contributions")
    op.drop_table("paddle_raise_contributions")

    op.drop_index("idx_auction_bid_actions_actor_id", table_name="auction_bid_actions")
    op.drop_index("idx_auction_bid_actions_bid_id", table_name="auction_bid_actions")
    op.drop_table("auction_bid_actions")

    op.drop_index("idx_auction_bids_source_bid_id", table_name="auction_bids")
    op.drop_index("idx_auction_bids_event_user_placed", table_name="auction_bids")
    op.drop_index("idx_auction_bids_event_item_placed", table_name="auction_bids")
    op.drop_index("idx_auction_bids_transaction_status", table_name="auction_bids")
    op.drop_index("idx_auction_bids_bid_status", table_name="auction_bids")
    op.drop_index("idx_auction_bids_bidder_number", table_name="auction_bids")
    op.drop_index("idx_auction_bids_user_id", table_name="auction_bids")
    op.drop_index("idx_auction_bids_item_id", table_name="auction_bids")
    op.drop_index("idx_auction_bids_event_id", table_name="auction_bids")
    op.drop_table("auction_bids")
