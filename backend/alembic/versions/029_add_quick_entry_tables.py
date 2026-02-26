"""add quick entry tables

Revision ID: 9f3c1a7d2b4e
Revises: c28d0a1b9e6f
Create Date: 2026-02-25 12:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "9f3c1a7d2b4e"
down_revision = "c28d0a1b9e6f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    quick_entry_bid_status = postgresql.ENUM(
        "active",
        "deleted",
        "winning",
        name="quick_entry_bid_status",
        create_type=False,
    )
    quick_entry_bid_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "quick_entry_live_bids",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bidder_number", sa.Integer(), nullable=False),
        sa.Column("donor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("status", quick_entry_bid_status, nullable=False, server_default="active"),
        sa.Column("accepted_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("entered_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["item_id"], ["auction_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["donor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["entered_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["deleted_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint("amount > 0", name="ck_quick_entry_live_bids_amount_positive"),
        sa.CheckConstraint(
            "bidder_number > 0",
            name="ck_quick_entry_live_bids_bidder_number_positive",
        ),
    )
    op.create_index("ix_quick_entry_live_bids_event_id", "quick_entry_live_bids", ["event_id"])
    op.create_index("ix_quick_entry_live_bids_item_id", "quick_entry_live_bids", ["item_id"])
    op.create_index(
        "ix_quick_entry_live_bids_bidder_number",
        "quick_entry_live_bids",
        ["bidder_number"],
    )
    op.create_index(
        "ix_quick_entry_live_bids_accepted_at",
        "quick_entry_live_bids",
        ["accepted_at"],
    )
    op.create_index("ix_quick_entry_live_bids_status", "quick_entry_live_bids", ["status"])

    op.create_table(
        "quick_entry_paddle_raise_donations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bidder_number", sa.Integer(), nullable=False),
        sa.Column("donor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("entered_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("entered_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["donor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["entered_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.CheckConstraint(
            "amount > 0",
            name="ck_quick_entry_paddle_raise_donations_amount_positive",
        ),
        sa.CheckConstraint(
            "bidder_number > 0",
            name="ck_quick_entry_paddle_raise_donations_bidder_number_positive",
        ),
    )
    op.create_index(
        "ix_quick_entry_paddle_raise_donations_event_id",
        "quick_entry_paddle_raise_donations",
        ["event_id"],
    )
    op.create_index(
        "ix_quick_entry_paddle_raise_donations_bidder_number",
        "quick_entry_paddle_raise_donations",
        ["bidder_number"],
    )
    op.create_index(
        "ix_quick_entry_paddle_raise_donations_entered_at",
        "quick_entry_paddle_raise_donations",
        ["entered_at"],
    )

    op.create_table(
        "quick_entry_donation_label_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("donation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("label_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("custom_label_text", sa.String(length=80), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["donation_id"],
            ["quick_entry_paddle_raise_donations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["label_id"], ["donation_labels.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_quick_entry_donation_label_links_donation_id",
        "quick_entry_donation_label_links",
        ["donation_id"],
    )
    op.create_index(
        "ix_quick_entry_donation_label_links_label_id",
        "quick_entry_donation_label_links",
        ["label_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_quick_entry_donation_label_links_label_id",
        table_name="quick_entry_donation_label_links",
    )
    op.drop_index(
        "ix_quick_entry_donation_label_links_donation_id",
        table_name="quick_entry_donation_label_links",
    )
    op.drop_table("quick_entry_donation_label_links")

    op.drop_index(
        "ix_quick_entry_paddle_raise_donations_entered_at",
        table_name="quick_entry_paddle_raise_donations",
    )
    op.drop_index(
        "ix_quick_entry_paddle_raise_donations_bidder_number",
        table_name="quick_entry_paddle_raise_donations",
    )
    op.drop_index(
        "ix_quick_entry_paddle_raise_donations_event_id",
        table_name="quick_entry_paddle_raise_donations",
    )
    op.drop_table("quick_entry_paddle_raise_donations")

    op.drop_index("ix_quick_entry_live_bids_status", table_name="quick_entry_live_bids")
    op.drop_index("ix_quick_entry_live_bids_accepted_at", table_name="quick_entry_live_bids")
    op.drop_index(
        "ix_quick_entry_live_bids_bidder_number",
        table_name="quick_entry_live_bids",
    )
    op.drop_index("ix_quick_entry_live_bids_item_id", table_name="quick_entry_live_bids")
    op.drop_index("ix_quick_entry_live_bids_event_id", table_name="quick_entry_live_bids")
    op.drop_table("quick_entry_live_bids")

    op.execute("DROP TYPE IF EXISTS quick_entry_bid_status")
