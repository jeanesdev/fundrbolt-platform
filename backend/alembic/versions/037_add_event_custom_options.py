"""Add event-level custom options support.

Makes ticket_package_id nullable and adds event_id FK to
custom_ticket_options so options can be attached to an event
(universal) rather than a specific ticket package.

Revision ID: 037_event_custom_options
Revises: 036_backup_password_support
Create Date: 2026-03-19 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "037_event_custom_options"
down_revision: str = "036_backup_password_support"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Make ticket_package_id nullable
    op.alter_column(
        "custom_ticket_options",
        "ticket_package_id",
        existing_type=UUID(),
        nullable=True,
    )

    # Add event_id FK
    op.add_column(
        "custom_ticket_options",
        sa.Column("event_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_custom_ticket_options_event_id",
        "custom_ticket_options",
        ["event_id"],
    )
    op.create_foreign_key(
        "fk_custom_ticket_options_event_id",
        "custom_ticket_options",
        "events",
        ["event_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Exactly one of ticket_package_id or event_id must be set
    op.create_check_constraint(
        "check_custom_option_owner",
        "custom_ticket_options",
        "(ticket_package_id IS NOT NULL AND event_id IS NULL) OR (ticket_package_id IS NULL AND event_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("check_custom_option_owner", "custom_ticket_options", type_="check")

    op.drop_constraint(
        "fk_custom_ticket_options_event_id", "custom_ticket_options", type_="foreignkey"
    )
    op.drop_index("ix_custom_ticket_options_event_id", table_name="custom_ticket_options")
    op.drop_column("custom_ticket_options", "event_id")

    # Delete any rows that have NULL ticket_package_id before making it NOT NULL again
    op.execute("DELETE FROM custom_ticket_options WHERE ticket_package_id IS NULL")
    op.alter_column(
        "custom_ticket_options",
        "ticket_package_id",
        existing_type=UUID(),
        nullable=False,
    )
