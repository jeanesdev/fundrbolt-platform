"""restore user address and organization fields dropped by 5c1511bffa16

Revision ID: restore_user_addr_001
Revises: ad294d90a064
Create Date: 2026-05-14

These columns exist in the User model but were accidentally dropped by
migration 5c1511bffa16 (add_media_type_mime_type_blob_name_to_*) and
never restored. This migration adds them back.

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "restore_user_addr_001"
down_revision: str | None = "ad294d90a064"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Re-add user address and organization fields that were dropped."""
    # Add organization_name (was dropped by 5c1511bffa16)
    op.add_column(
        "users",
        sa.Column("organization_name", sa.String(255), nullable=True),
    )
    # Add structured address fields (were dropped by 5c1511bffa16)
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
    """Remove the restored columns."""
    op.drop_column("users", "country")
    op.drop_column("users", "postal_code")
    op.drop_column("users", "state")
    op.drop_column("users", "city")
    op.drop_column("users", "address_line2")
    op.drop_column("users", "address_line1")
    op.drop_column("users", "organization_name")
