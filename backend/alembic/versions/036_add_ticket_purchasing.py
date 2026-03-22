"""add_ticket_purchasing

Revision ID: 036_tp_001
Revises: None
Create Date: 2026-05-15 00:00:00.000000

Migration plan:
  M1 — ticket_assignments (guest assignment per purchased ticket)
  M2 — ticket_invitations (email invitations with tokens)
  M3 — events.max_tickets_per_donor (per-donor ticket cap)
  M4 — ticket_purchases.sponsorship_sponsor_id (link purchases to sponsors)
  M5 — assigned_tickets.assignment_status (track assignment lifecycle)
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "036_tp_001"
down_revision: str | Sequence[str] | None = "pay033_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add ticket purchasing tables and column additions."""

    # ── M1: ticket_assignments ───────────────────────────────────────────────
    op.create_table(
        "ticket_assignments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "assigned_ticket_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assigned_tickets.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "ticket_purchase_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ticket_purchases.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "assigned_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("guest_name", sa.String(200), nullable=False),
        sa.Column("guest_email", sa.String(254), nullable=False),
        sa.Column(
            "assignee_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "registration_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("event_registrations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="assigned",
        ),
        sa.Column("invitation_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "invitation_count",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column("registered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_by", sa.String(20), nullable=True),
        sa.Column(
            "is_self_assignment",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.CheckConstraint(
            "status IN ('assigned', 'invited', 'registered', 'cancelled')",
            name="check_assignment_status",
        ),
        sa.CheckConstraint(
            "cancelled_by IS NULL OR cancelled_by IN ('guest', 'coordinator', 'purchaser')",
            name="check_cancelled_by",
        ),
    )
    op.create_index(
        "idx_ticket_assignments_purchase",
        "ticket_assignments",
        ["ticket_purchase_id"],
    )
    op.create_index(
        "idx_ticket_assignments_event",
        "ticket_assignments",
        ["event_id"],
    )
    op.create_index(
        "idx_ticket_assignments_assignee",
        "ticket_assignments",
        ["assignee_user_id"],
    )
    op.create_index(
        "idx_ticket_assignments_email_event",
        "ticket_assignments",
        ["guest_email", "event_id"],
    )
    op.create_index(
        "idx_ticket_assignments_status",
        "ticket_assignments",
        ["event_id", "status"],
    )

    # ── M2: ticket_invitations ───────────────────────────────────────────────
    op.create_table(
        "ticket_invitations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "assignment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ticket_assignments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email_address", sa.String(254), nullable=False),
        sa.Column(
            "invitation_token",
            sa.String(500),
            nullable=False,
            unique=True,
        ),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("registered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "idx_ticket_invitations_assignment",
        "ticket_invitations",
        ["assignment_id"],
    )

    # ── M3: events.max_tickets_per_donor ─────────────────────────────────────
    op.add_column(
        "events",
        sa.Column("max_tickets_per_donor", sa.Integer, nullable=True),
    )
    op.create_check_constraint(
        "ck_events_max_tickets_per_donor_gte_1",
        "events",
        "max_tickets_per_donor >= 1",
    )

    # ── M4: ticket_purchases.sponsorship_sponsor_id ──────────────────────────
    op.add_column(
        "ticket_purchases",
        sa.Column(
            "sponsorship_sponsor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sponsors.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_ticket_purchases_sponsorship_sponsor_id",
        "ticket_purchases",
        ["sponsorship_sponsor_id"],
    )

    # ── M5: assigned_tickets.assignment_status ───────────────────────────────
    op.add_column(
        "assigned_tickets",
        sa.Column(
            "assignment_status",
            sa.String(20),
            nullable=False,
            server_default="unassigned",
        ),
    )
    op.create_check_constraint(
        "ck_assigned_tickets_assignment_status",
        "assigned_tickets",
        "assignment_status IN ('unassigned', 'assigned', 'registered')",
    )


def downgrade() -> None:
    """Remove all ticket purchasing tables and column additions."""

    # M5: assigned_tickets.assignment_status
    op.drop_constraint(
        "ck_assigned_tickets_assignment_status",
        "assigned_tickets",
        type_="check",
    )
    op.drop_column("assigned_tickets", "assignment_status")

    # M4: ticket_purchases.sponsorship_sponsor_id
    op.drop_index(
        "ix_ticket_purchases_sponsorship_sponsor_id",
        table_name="ticket_purchases",
    )
    op.drop_column("ticket_purchases", "sponsorship_sponsor_id")

    # M3: events.max_tickets_per_donor
    op.drop_constraint(
        "ck_events_max_tickets_per_donor_gte_1",
        "events",
        type_="check",
    )
    op.drop_column("events", "max_tickets_per_donor")

    # M2: ticket_invitations
    op.drop_table("ticket_invitations")

    # M1: ticket_assignments
    op.drop_table("ticket_assignments")
