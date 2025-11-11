"""add user organization fields

Revision ID: 008
Revises: 007
Create Date: 2025-10-30

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "008"
down_revision: str | None = "007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add organization_name and organization_address columns to users table."""
    op.add_column(
        "users",
        sa.Column("organization_name", sa.String(255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("organization_address", sa.Text(), nullable=True),
    )

    # Add index for organization_name to support filtering/searching
    op.create_index(
        "idx_users_organization_name",
        "users",
        ["organization_name"],
        postgresql_where=sa.text("organization_name IS NOT NULL"),
    )


def downgrade() -> None:
    """Remove organization fields from users table."""
    op.drop_index("idx_users_organization_name", table_name="users")
    op.drop_column("users", "organization_address")
    op.drop_column("users", "organization_name")
