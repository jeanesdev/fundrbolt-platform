"""Add event_id to npo_donations for upcoming-event association

Revision ID: 044_npo_donations_event_id
Revises: 043b_add_donate_now_tables
Create Date: 2026-04-21
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "044_npo_donations_event_id"
down_revision = "043b_add_donate_now_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add nullable event_id FK to npo_donations."""
    op.add_column(
        "npo_donations",
        sa.Column(
            "event_id",
            UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_npo_donations_event_id", "npo_donations", ["event_id"])


def downgrade() -> None:
    """Remove event_id from npo_donations."""
    op.drop_index("ix_npo_donations_event_id", table_name="npo_donations")
    op.drop_column("npo_donations", "event_id")
