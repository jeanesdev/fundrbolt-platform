"""Add donate_back to survey_responses and survey_donate_back enum value.

Revision ID: survey_005
Revises: survey_004
Create Date: 2025-01-01 00:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

revision = "survey_005"
down_revision = "survey_004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add donate_back column to survey_responses
    op.add_column(
        "survey_responses",
        sa.Column(
            "donate_back",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # Add survey_donate_back value to the checkout_item_source_type_enum
    op.execute(
        "ALTER TYPE checkout_item_source_type_enum ADD VALUE IF NOT EXISTS 'survey_donate_back'"
    )


def downgrade() -> None:
    op.drop_column("survey_responses", "donate_back")
    # Note: PostgreSQL does not support removing enum values; the
    # 'survey_donate_back' value is intentionally left in place.
