"""Add survey_invitation to notification_type_enum.

Revision ID: survey_002
Revises: survey_001
Create Date: 2025-01-01 00:00:00.000000

"""

from alembic import op

revision = "survey_002"
down_revision = "survey_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'survey_invitation'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values without recreating the type.
    # The value is kept in the enum; existing rows with this type would prevent removal anyway.
    pass
