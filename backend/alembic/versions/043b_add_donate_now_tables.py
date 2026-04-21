"""Add donate-now tables: donate_now_page_configs, donation_tiers, npo_donations, support_wall_entries

Revision ID: 043b_add_donate_now_tables
Revises: 043a_add_npo_slug
Create Date: 2026-04-20
"""

import uuid

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic.
revision = "043b_add_donate_now_tables"
down_revision = "043a_add_npo_slug"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create donate-now page tables."""
    # 1. donate_now_page_configs
    op.create_table(
        "donate_now_page_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "npo_id",
            UUID(as_uuid=True),
            sa.ForeignKey("npos.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True,
        ),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("donate_plea_text", sa.String(500), nullable=True),
        sa.Column("hero_media_url", sa.Text(), nullable=True),
        sa.Column(
            "hero_transition_style",
            sa.String(50),
            nullable=False,
            server_default="documentary_style",
        ),
        sa.Column(
            "processing_fee_pct",
            sa.Numeric(5, 4),
            nullable=False,
            server_default="0.0290",
        ),
        sa.Column("npo_info_text", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # 2. donation_tiers
    op.create_table(
        "donation_tiers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "config_id",
            UUID(as_uuid=True),
            sa.ForeignKey("donate_now_page_configs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("impact_statement", sa.String(200), nullable=True),
        sa.Column("display_order", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("amount_cents > 0", name="ck_donation_tiers_amount_positive"),
    )

    # 3. npo_donations (named npo_donations to avoid conflict with existing donations table)
    op.create_table(
        "npo_donations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "config_id",
            UUID(as_uuid=True),
            sa.ForeignKey("donate_now_page_configs.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "npo_id",
            UUID(as_uuid=True),
            sa.ForeignKey("npos.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "donor_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("covers_processing_fee", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("processing_fee_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_charged_cents", sa.Integer(), nullable=False),
        sa.Column("is_monthly", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("recurrence_start", sa.Date(), nullable=True),
        sa.Column("recurrence_end", sa.Date(), nullable=True),
        sa.Column(
            "recurrence_status",
            sa.String(20),
            nullable=True,
            comment="active | cancelled | completed",
        ),
        sa.Column("next_charge_date", sa.Date(), nullable=True, index=True),
        sa.Column(
            "payment_profile_id",
            UUID(as_uuid=True),
            sa.ForeignKey("payment_profiles.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "payment_transaction_id",
            UUID(as_uuid=True),
            sa.ForeignKey("payment_transactions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
            comment="pending | captured | declined | cancelled",
        ),
        sa.Column("idempotency_key", sa.String(100), nullable=True, unique=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.CheckConstraint("amount_cents > 0", name="ck_npo_donations_amount_positive"),
        sa.CheckConstraint(
            "recurrence_status IN ('active', 'cancelled', 'completed')",
            name="ck_npo_donations_recurrence_status",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'captured', 'declined', 'cancelled')",
            name="ck_npo_donations_status",
        ),
    )
    op.create_index("ix_npo_donations_npo_status", "npo_donations", ["npo_id", "status"])

    # 4. support_wall_entries
    op.create_table(
        "support_wall_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "donation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("npo_donations.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "npo_id",
            UUID(as_uuid=True),
            sa.ForeignKey("npos.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("is_anonymous", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("show_amount", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("message", sa.String(200), nullable=True),
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_support_wall_entries_npo_hidden_created",
        "support_wall_entries",
        ["npo_id", "is_hidden", "created_at"],
    )


def downgrade() -> None:
    """Drop donate-now tables."""
    op.drop_index("ix_support_wall_entries_npo_hidden_created", table_name="support_wall_entries")
    op.drop_table("support_wall_entries")
    op.drop_index("ix_npo_donations_npo_status", table_name="npo_donations")
    op.drop_table("npo_donations")
    op.drop_table("donation_tiers")
    op.drop_table("donate_now_page_configs")
