"""Make donation labels global and seed default labels.

Revision ID: a3d4f5b6c7d8
Revises: 9f3c1a7d2b4e
Create Date: 2026-02-26 00:00:00.000000
"""

from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "a3d4f5b6c7d8"
down_revision = "9f3c1a7d2b4e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "donation_labels",
        "event_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )

    op.execute(
        """
        INSERT INTO donation_labels (id, event_id, name, is_active, retired_at, created_at, updated_at)
        SELECT '8f97b6b7-f4e6-4e6f-b968-7e9e24840a11'::uuid, NULL, 'Last Leader', TRUE, NULL, NOW(), NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM donation_labels WHERE lower(name) = lower('Last Leader')
        )
        """
    )

    op.execute(
        """
        INSERT INTO donation_labels (id, event_id, name, is_active, retired_at, created_at, updated_at)
        SELECT '95db94f9-9f9d-4174-bfb5-21e31a563a17'::uuid, NULL, 'Head or Tails', TRUE, NULL, NOW(), NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM donation_labels WHERE lower(name) = lower('Head or Tails')
        )
        """
    )

    op.execute(
        """
        INSERT INTO donation_labels (id, event_id, name, is_active, retired_at, created_at, updated_at)
        SELECT '03cb22ef-5dfb-47f7-ae74-e8f541cf16f8'::uuid, NULL, 'Table Raise', TRUE, NULL, NOW(), NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM donation_labels WHERE lower(name) = lower('Table Raise')
        )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM donation_labels
        WHERE id IN (
            '8f97b6b7-f4e6-4e6f-b968-7e9e24840a11',
            '95db94f9-9f9d-4174-bfb5-21e31a563a17',
            '03cb22ef-5dfb-47f7-ae74-e8f541cf16f8'
        )
        """
    )

    op.alter_column(
        "donation_labels",
        "event_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
