"""Add is_sponsorship field to TicketPackage

Revision ID: sponsorship_001
Revises: 5f531d2c8eb9
Create Date: 2026-01-10 17:45:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "sponsorship_001"
down_revision = "5f531d2c8eb9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_sponsorship column to ticket_packages table
    op.add_column(
        "ticket_packages",
        sa.Column("is_sponsorship", sa.Boolean(), nullable=False, server_default="false"),
    )
    # Create index on is_sponsorship
    op.create_index(
        op.f("ix_ticket_packages_is_sponsorship"),
        "ticket_packages",
        ["is_sponsorship"],
        unique=False,
    )


def downgrade() -> None:
    # Drop the index
    op.drop_index(op.f("ix_ticket_packages_is_sponsorship"), table_name="ticket_packages")
    # Drop the column
    op.drop_column("ticket_packages", "is_sponsorship")
