"""Add allow_multiple to survey_questions.

Revision ID: survey_004
Revises: survey_003
Create Date: 2025-01-01 00:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

revision = "survey_004"
down_revision = "survey_003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "survey_questions",
        sa.Column(
            "allow_multiple",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("survey_questions", "allow_multiple")
