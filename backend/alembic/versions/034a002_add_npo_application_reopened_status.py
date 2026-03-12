"""Add under_revision NPOStatus and reopened ApplicationStatus values.

Revision ID: 034a002_add_npo_application_reopened_status
Revises: 034a001_add_onboarding_sessions
Create Date: 2025-01-01 00:00:00.000000

US4 — Admin can re-open a rejected NPO application for applicant revision.
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers
revision = "034a002_npo_reopened"
down_revision = "034a001_add_onboarding_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add 'under_revision' to npo_status enum and 'reopened' to application_status enum."""
    # PostgreSQL's ALTER TYPE … ADD VALUE must run outside a transaction block.
    # We use get_bind() directly to execute the DDL.
    bind = op.get_bind()
    bind.execute(sa.text("ALTER TYPE npo_status ADD VALUE IF NOT EXISTS 'under_revision'"))
    bind.execute(sa.text("ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'reopened'"))


def downgrade() -> None:
    """Postgres does not support removing enum values — downgrade is a no-op."""
    # Enum value removal is not supported by PostgreSQL.
    # Manual steps: recreate the enum without the values if a full rollback is required.
    pass
