"""Add event nudge dismissals and notification log tables.

Revision ID: nudge_001_add_event_nudge_tables
Revises: d64ca012a41f
Create Date: 2026-06-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "nudge_001_add_event_nudge_tables"
down_revision: str | Sequence[str] | None = "d64ca012a41f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Extend notification_type_enum with nudge_alert
    op.execute("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'nudge_alert'")

    # Add nudge_closing_soon_minutes to events table
    op.add_column(
        "events",
        sa.Column(
            "nudge_closing_soon_minutes",
            sa.Integer(),
            nullable=False,
            server_default="20",
            comment="Minutes before close to trigger closing_soon_watchers nudge",
        ),
    )

    # Create event_nudge_dismissals table
    op.create_table(
        "event_nudge_dismissals",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nudge_key", sa.String(length=200), nullable=False),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("action IN ('dismissed', 'actioned')", name="ck_nudge_dismissal_action"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "user_id", "nudge_key", name="uq_event_nudge_dismissals"),
    )
    op.create_index("ix_event_nudge_dismissals_event_id", "event_nudge_dismissals", ["event_id"])
    op.create_index("ix_event_nudge_dismissals_user_id", "event_nudge_dismissals", ["user_id"])
    op.create_index(
        "ix_event_nudge_dismissals_event_user_expires",
        "event_nudge_dismissals",
        ["event_id", "user_id", "expires_at"],
    )

    # Create event_nudge_notification_logs table
    op.create_table(
        "event_nudge_notification_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nudge_key", sa.String(length=200), nullable=False),
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "nudge_key", name="uq_event_nudge_notification_log"),
    )
    op.create_index(
        "ix_event_nudge_notification_logs_event_id",
        "event_nudge_notification_logs",
        ["event_id"],
    )


def downgrade() -> None:
    op.drop_table("event_nudge_notification_logs")
    op.drop_table("event_nudge_dismissals")
    op.drop_column("events", "nudge_closing_soon_minutes")
    # Note: Cannot remove enum values in PostgreSQL without recreating the type
