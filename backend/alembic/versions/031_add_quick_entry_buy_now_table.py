"""add quick_entry_buy_now_bids table

Revision ID: b1c2d3e4f5a6
Revises: a3d4f5b6c7d8
Create Date: 2026-02-27 12:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5a6"
down_revision = "a3d4f5b6c7d8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quick_entry_buy_now_bids",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
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
        sa.ForeignKeyConstraint(["item_id"], ["auction_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["donor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["entered_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.CheckConstraint("amount > 0", name="ck_quick_entry_buy_now_bids_amount_positive"),
        sa.CheckConstraint(
            "bidder_number > 0",
            name="ck_quick_entry_buy_now_bids_bidder_number_positive",
        ),
    )
    op.create_index(
        "ix_quick_entry_buy_now_bids_event_id", "quick_entry_buy_now_bids", ["event_id"]
    )
    op.create_index("ix_quick_entry_buy_now_bids_item_id", "quick_entry_buy_now_bids", ["item_id"])
    op.create_index(
        "ix_quick_entry_buy_now_bids_bidder_number", "quick_entry_buy_now_bids", ["bidder_number"]
    )
    op.create_index(
        "ix_quick_entry_buy_now_bids_donor_user_id", "quick_entry_buy_now_bids", ["donor_user_id"]
    )
    op.create_index(
        "ix_quick_entry_buy_now_bids_entered_at", "quick_entry_buy_now_bids", ["entered_at"]
    )


def downgrade() -> None:
    op.drop_table("quick_entry_buy_now_bids")
