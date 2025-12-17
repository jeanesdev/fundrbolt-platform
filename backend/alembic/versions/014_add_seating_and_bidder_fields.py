"""Add seating and bidder number fields to registration guests

Revision ID: 014_add_seating_and_bidder_fields
Revises: 013_add_seating_configuration
Create Date: 2025-12-11

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "a7b4c5d6e8f9"
down_revision = "f8e3a1b2c9d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add seating and bidder number columns
    op.add_column("registration_guests", sa.Column("bidder_number", sa.Integer(), nullable=True))
    op.add_column("registration_guests", sa.Column("table_number", sa.Integer(), nullable=True))
    op.add_column(
        "registration_guests",
        sa.Column("bidder_number_assigned_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    # Add check constraints
    op.create_check_constraint(
        "ck_registration_guests_bidder_number_range",
        "registration_guests",
        "bidder_number IS NULL OR (bidder_number >= 100 AND bidder_number <= 999)",
    )
    op.create_check_constraint(
        "ck_registration_guests_table_number_positive",
        "registration_guests",
        "table_number IS NULL OR table_number > 0",
    )

    # Create composite index for event-scoped bidder number uniqueness
    # Note: This index includes registration_id to help with joins
    # We'll enforce uniqueness in application logic + database trigger
    op.create_index(
        "idx_registration_guests_bidder_number",
        "registration_guests",
        ["registration_id", "bidder_number"],
        unique=False,  # Not unique here because we need event-level uniqueness
    )

    # Create index for table number queries
    op.create_index(
        "idx_registration_guests_table_number",
        "registration_guests",
        ["table_number"],
        unique=False,
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index("idx_registration_guests_table_number", table_name="registration_guests")
    op.drop_index("idx_registration_guests_bidder_number", table_name="registration_guests")

    # Drop check constraints
    op.drop_constraint(
        "ck_registration_guests_table_number_positive", "registration_guests", type_="check"
    )
    op.drop_constraint(
        "ck_registration_guests_bidder_number_range", "registration_guests", type_="check"
    )

    # Drop columns
    op.drop_column("registration_guests", "bidder_number_assigned_at")
    op.drop_column("registration_guests", "table_number")
    op.drop_column("registration_guests", "bidder_number")
