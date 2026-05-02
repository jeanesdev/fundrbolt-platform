"""Add revenue generator tables

Revision ID: 042_rg_001
Revises: 052_paddle_raise_goals
Create Date: 2026-05-01 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "042_rg_001"
down_revision: str | Sequence[str] | None = "052_paddle_raise_goals"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    winner_method_enum = postgresql.ENUM(
        "random_draw",
        "manual",
        name="revenue_generator_winner_method",
        create_type=True,
    )
    winner_method_enum.create(op.get_bind())

    op.create_table(
        "revenue_generator_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_per_entry", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "is_visible",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "is_open_for_entries",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
        sa.Column(
            "display_order",
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
        sa.CheckConstraint(
            "price_per_entry > 0",
            name="ck_revenue_generator_items_price_positive",
        ),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_revenue_generator_items_event_id",
        "revenue_generator_items",
        ["event_id"],
    )

    op.create_table(
        "revenue_generator_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "revenue_generator_item_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "registration_guest_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("bidder_number", sa.Integer(), nullable=False),
        sa.Column("amount_paid", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "recorded_by_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "purchased_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
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
        sa.ForeignKeyConstraint(
            ["revenue_generator_item_id"],
            ["revenue_generator_items.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["registration_guest_id"],
            ["registration_guests.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(["recorded_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_revenue_generator_entries_item_id",
        "revenue_generator_entries",
        ["revenue_generator_item_id"],
    )
    op.create_index(
        "ix_revenue_generator_entries_event_id",
        "revenue_generator_entries",
        ["event_id"],
    )

    op.create_table(
        "revenue_generator_winner_selections",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "revenue_generator_item_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("winning_entry_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("winner_name", sa.String(255), nullable=False),
        sa.Column("bidder_number", sa.Integer(), nullable=False),
        sa.Column(
            "selection_method",
            sa.Enum(
                "random_draw",
                "manual",
                name="revenue_generator_winner_method",
            ),
            nullable=False,
        ),
        sa.Column(
            "selected_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "selected_by_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
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
        sa.ForeignKeyConstraint(
            ["revenue_generator_item_id"],
            ["revenue_generator_items.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["winning_entry_id"],
            ["revenue_generator_entries.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(["selected_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_revenue_generator_winner_selections_item_id",
        "revenue_generator_winner_selections",
        ["revenue_generator_item_id"],
    )


def downgrade() -> None:
    op.drop_table("revenue_generator_winner_selections")
    op.drop_table("revenue_generator_entries")
    op.drop_table("revenue_generator_items")
    op.execute("DROP TYPE IF EXISTS revenue_generator_winner_method")
