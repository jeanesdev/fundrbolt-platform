"""add deleted_at to npo

Revision ID: 009
Revises: 008
Create Date: 2025-10-31

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "009"
down_revision: str | None = "008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add deleted_at column to npos table for soft delete functionality."""

    # Add deleted_at column
    op.add_column(
        "npos",
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=True,
            default=None,
        ),
    )

    # Add index on deleted_at for queries that filter soft-deleted records
    op.create_index(
        "ix_npos_deleted_at",
        "npos",
        ["deleted_at"],
        unique=False,
    )


def downgrade() -> None:
    """Remove deleted_at column from npos table."""

    # Drop index
    op.drop_index("ix_npos_deleted_at", table_name="npos")

    # Drop column
    op.drop_column("npos", "deleted_at")
