"""add donations and donation labels tables

Revision ID: c28d0a1b9e6f
Revises: 8b0a3f19d7c2
Create Date: 2026-02-25 00:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "c28d0a1b9e6f"
down_revision = "8b0a3f19d7c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    donation_status = postgresql.ENUM(
        "active",
        "voided",
        name="donation_status",
        create_type=False,
    )
    donation_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "donations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("donor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("is_paddle_raise", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("status", donation_status, nullable=False, server_default="active"),
        sa.Column("voided_at", sa.TIMESTAMP(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["donor_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.CheckConstraint("amount > 0", name="ck_donations_amount_positive"),
        sa.CheckConstraint("status IN ('active', 'voided')", name="ck_donations_status"),
    )
    op.create_index("ix_donations_event_id", "donations", ["event_id"])
    op.create_index("ix_donations_donor_user_id", "donations", ["donor_user_id"])
    op.create_index("ix_donations_is_paddle_raise", "donations", ["is_paddle_raise"])
    op.create_index("ix_donations_status", "donations", ["status"])
    op.create_index(
        "ix_donations_event_status_created_at",
        "donations",
        ["event_id", "status", "created_at"],
    )

    op.create_table(
        "donation_labels",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("retired_at", sa.TIMESTAMP(timezone=True), nullable=True),
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
    )
    op.create_index("ix_donation_labels_event_id", "donation_labels", ["event_id"])
    op.create_index("ix_donation_labels_is_active", "donation_labels", ["is_active"])
    op.create_index(
        "uq_donation_labels_event_name_ci",
        "donation_labels",
        ["event_id", "name"],
        unique=True,
    )

    op.create_table(
        "donation_label_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("donation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("label_id", postgresql.UUID(as_uuid=True), nullable=False),
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
        sa.ForeignKeyConstraint(["donation_id"], ["donations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["label_id"], ["donation_labels.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("donation_id", "label_id", name="uq_donation_label_assignments_pair"),
    )
    op.create_index(
        "ix_donation_label_assignments_donation_id",
        "donation_label_assignments",
        ["donation_id"],
    )
    op.create_index(
        "ix_donation_label_assignments_label_id",
        "donation_label_assignments",
        ["label_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_donation_label_assignments_label_id", table_name="donation_label_assignments")
    op.drop_index(
        "ix_donation_label_assignments_donation_id",
        table_name="donation_label_assignments",
    )
    op.drop_table("donation_label_assignments")

    op.drop_index("uq_donation_labels_event_name_ci", table_name="donation_labels")
    op.drop_index("ix_donation_labels_is_active", table_name="donation_labels")
    op.drop_index("ix_donation_labels_event_id", table_name="donation_labels")
    op.drop_table("donation_labels")

    op.drop_index("ix_donations_event_status_created_at", table_name="donations")
    op.drop_index("ix_donations_status", table_name="donations")
    op.drop_index("ix_donations_is_paddle_raise", table_name="donations")
    op.drop_index("ix_donations_donor_user_id", table_name="donations")
    op.drop_index("ix_donations_event_id", table_name="donations")
    op.drop_table("donations")

    op.execute("DROP TYPE donation_status")
