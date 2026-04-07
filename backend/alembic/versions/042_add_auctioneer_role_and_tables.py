"""Add auctioneer role with commission and settings tables

Revision ID: 042_add_auctioneer_role
Revises: 041_add_npo_hashtag
Create Date: 2026-04-04
"""

import uuid

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic.
revision = "042_add_auctioneer_role"
down_revision = "041_add_npo_hashtag"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Update roles check constraint to include auctioneer
    op.drop_constraint("role_name_valid", "roles", type_="check")
    op.create_check_constraint(
        "role_name_valid",
        "roles",
        "name IN ('super_admin', 'npo_admin', 'event_coordinator', 'staff', 'donor', 'auctioneer')",
    )

    # 2. Seed auctioneer role row
    op.execute(
        sa.text(
            "INSERT INTO roles (id, name, description, scope, created_at, updated_at) "
            "VALUES (gen_random_uuid(), 'auctioneer', "
            "'Professional auctioneer with commission tracking', "
            "'npo', NOW(), NOW())"
        )
    )

    # 2. Add AUCTIONEER to member_role enum
    op.execute(sa.text("ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'auctioneer'"))

    # 3. Add event_id to invitations (for auctioneer event-scoped invitations)
    op.add_column(
        "invitations",
        sa.Column(
            "event_id",
            UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="SET NULL"),
            nullable=True,
            comment="Event ID for event-scoped invitations (e.g., auctioneer)",
        ),
    )

    # 4. Add live_auction_start_datetime to events
    op.add_column(
        "events",
        sa.Column(
            "live_auction_start_datetime",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When the live auction starts (for countdown timers)",
        ),
    )

    # 4. Map auction_close_datetime — column already exists from migration 032,
    #    no DDL needed; the SQLAlchemy model mapping handles it.

    # 5. Create auctioneer_item_commissions table
    op.create_table(
        "auctioneer_item_commissions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "auctioneer_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "auction_item_id",
            UUID(as_uuid=True),
            sa.ForeignKey("auction_items.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "commission_percent",
            sa.Numeric(5, 2),
            nullable=False,
        ),
        sa.Column(
            "flat_fee",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "auctioneer_user_id",
            "auction_item_id",
            name="uq_auctioneer_item_commission",
        ),
        sa.CheckConstraint(
            "commission_percent >= 0 AND commission_percent <= 100",
            name="ck_commission_percent_range",
        ),
        sa.CheckConstraint(
            "flat_fee >= 0",
            name="ck_flat_fee_nonnegative",
        ),
    )

    # 6. Create auctioneer_event_settings table
    op.create_table(
        "auctioneer_event_settings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "auctioneer_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "event_id",
            UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "live_auction_percent",
            sa.Numeric(5, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "paddle_raise_percent",
            sa.Numeric(5, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "silent_auction_percent",
            sa.Numeric(5, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "auctioneer_user_id",
            "event_id",
            name="uq_auctioneer_event_settings",
        ),
        sa.CheckConstraint(
            "live_auction_percent >= 0 AND live_auction_percent <= 100",
            name="ck_live_auction_percent_range",
        ),
        sa.CheckConstraint(
            "paddle_raise_percent >= 0 AND paddle_raise_percent <= 100",
            name="ck_paddle_raise_percent_range",
        ),
        sa.CheckConstraint(
            "silent_auction_percent >= 0 AND silent_auction_percent <= 100",
            name="ck_silent_auction_percent_range",
        ),
    )


def downgrade() -> None:
    op.drop_table("auctioneer_event_settings")
    op.drop_table("auctioneer_item_commissions")
    op.drop_column("events", "live_auction_start_datetime")
    op.drop_column("invitations", "event_id")
    op.execute(sa.text("DELETE FROM roles WHERE name = 'auctioneer'"))
    # Restore original check constraint
    op.drop_constraint("role_name_valid", "roles", type_="check")
    op.create_check_constraint(
        "role_name_valid",
        "roles",
        "name IN ('super_admin', 'npo_admin', 'event_coordinator', 'staff', 'donor')",
    )
    # Note: Cannot remove enum value in PostgreSQL
