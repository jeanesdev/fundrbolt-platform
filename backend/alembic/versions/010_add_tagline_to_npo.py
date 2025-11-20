"""add tagline to npo

Revision ID: 010
Revises: 009b
Create Date: 2025-11-01

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "010"
down_revision: str | None = "009b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add tagline column to npos table."""

    # Add tagline column
    op.add_column(
        "npos",
        sa.Column(
            "tagline",
            sa.String(255),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Remove tagline column from npos table."""

    # Drop column
    op.drop_column("npos", "tagline")
