"""Add check-in fields to event registrations and guests

Revision ID: 41727abf4033
Revises: 59619fbfd870
Create Date: 2025-11-22 21:40:23.847949

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "41727abf4033"
down_revision = "59619fbfd870"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add check_in_time to event_registrations
    op.add_column(
        "event_registrations",
        sa.Column(
            "check_in_time",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When the primary registrant checked in at the event",
        ),
    )

    # Add checked_in to registration_guests
    op.add_column(
        "registration_guests",
        sa.Column(
            "checked_in",
            sa.Boolean(),
            nullable=False,
            server_default="false",
            comment="Whether the guest has checked in at the event",
        ),
    )


def downgrade() -> None:
    # Remove checked_in from registration_guests
    op.drop_column("registration_guests", "checked_in")

    # Remove check_in_time from event_registrations
    op.drop_column("event_registrations", "check_in_time")
