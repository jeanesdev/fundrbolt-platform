"""restore user address and organization fields dropped by 5c1511bffa16

Revision ID: restore_user_addr_001
Revises: ad294d90a064
Create Date: 2026-05-14

These columns exist in the User model but were accidentally dropped by
migration 5c1511bffa16 (add_media_type_mime_type_blob_name_to_*) and
never restored. This migration adds them back.

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "restore_user_addr_001"
down_revision: str | None = "ad294d90a064"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Re-add user address and organization fields that were dropped."""
    # Use IF NOT EXISTS so this is idempotent in case the columns already exist
    # (e.g. if migration 5c1511bffa16 did not actually drop them in a given environment)
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_name VARCHAR(255)"
    )
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255)"
    )
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255)"
    )
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100)")
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)"
    )
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100)")


def downgrade() -> None:
    """Remove the restored columns."""
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS country")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS postal_code")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS state")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS city")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS address_line2")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS address_line1")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS organization_name")
