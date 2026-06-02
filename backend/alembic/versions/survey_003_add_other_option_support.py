"""Add is_other to survey_question_options and other_text to survey_answers.

Revision ID: survey_003
Revises: survey_002
Create Date: 2025-01-01 00:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

revision = "survey_003"
down_revision = "survey_002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "survey_question_options",
        sa.Column(
            "is_other",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "survey_answers",
        sa.Column("other_text", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("survey_answers", "other_text")
    op.drop_column("survey_question_options", "is_other")
