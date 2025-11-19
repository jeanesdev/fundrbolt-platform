"""restructure user address fields

Revision ID: 009b
Revises: 008b
Create Date: 2025-10-30

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "009b"
down_revision: str | None = "008b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Replace organization_address with structured address fields."""
    # Remove the old organization_address column
    op.drop_column("users", "organization_address")

    # Add structured address fields
    op.add_column(
        "users",
        sa.Column("address_line1", sa.String(255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("address_line2", sa.String(255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("city", sa.String(100), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("state", sa.String(100), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("postal_code", sa.String(20), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("country", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    """Revert to single organization_address field."""
    op.drop_column("users", "country")
    op.drop_column("users", "postal_code")
    op.drop_column("users", "state")
    op.drop_column("users", "city")
    op.drop_column("users", "address_line2")
    op.drop_column("users", "address_line1")

    op.add_column(
        "users",
        sa.Column("organization_address", sa.Text(), nullable=True),
    )
