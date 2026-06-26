"""Add silent auction extension policy and per-item extension state tables.

Revision ID: 051_silent_auction_ext
Revises: auction_001_add_display_fields
Create Date: 2026-06-25 12:00:00.000000
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "051_silent_auction_ext"
down_revision = "auction_001_add_display_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "silent_auction_extension_policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "auto_extension_enabled",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
        sa.Column(
            "trigger_window_minutes",
            sa.Integer(),
            nullable=False,
            server_default="3",
        ),
        sa.Column(
            "extension_duration_minutes",
            sa.Integer(),
            nullable=False,
            server_default="3",
        ),
        sa.Column(
            "max_total_extension_minutes",
            sa.Integer(),
            nullable=False,
            server_default="30",
        ),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id"),
        sa.CheckConstraint("trigger_window_minutes > 0", name="ck_saep_trigger_window_positive"),
        sa.CheckConstraint(
            "extension_duration_minutes BETWEEN 1 AND 10",
            name="ck_saep_extension_duration_range",
        ),
        sa.CheckConstraint(
            "max_total_extension_minutes BETWEEN 0 AND 60",
            name="ck_saep_max_total_extension_range",
        ),
    )
    op.create_index(
        "ix_silent_auction_extension_policies_event_id",
        "silent_auction_extension_policies",
        ["event_id"],
    )

    op.create_table(
        "silent_auction_item_extension_states",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("auction_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("original_close_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("effective_close_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "total_extension_minutes_applied",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["auction_item_id"], ["auction_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "auction_item_id", name="uq_saies_event_item"),
        sa.CheckConstraint(
            "total_extension_minutes_applied >= 0",
            name="ck_saies_total_extension_nonnegative",
        ),
    )
    op.create_index(
        "ix_silent_auction_item_extension_states_event_id",
        "silent_auction_item_extension_states",
        ["event_id"],
    )
    op.create_index(
        "ix_silent_auction_item_extension_states_auction_item_id",
        "silent_auction_item_extension_states",
        ["auction_item_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_silent_auction_item_extension_states_auction_item_id",
        table_name="silent_auction_item_extension_states",
    )
    op.drop_index(
        "ix_silent_auction_item_extension_states_event_id",
        table_name="silent_auction_item_extension_states",
    )
    op.drop_table("silent_auction_item_extension_states")

    op.drop_index(
        "ix_silent_auction_extension_policies_event_id",
        table_name="silent_auction_extension_policies",
    )
    op.drop_table("silent_auction_extension_policies")
