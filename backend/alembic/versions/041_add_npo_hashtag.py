"""Add hashtag column to npos table

Revision ID: 041_add_npo_hashtag
Revises: 040_add_is_monthly_paddle
Create Date: 2026-04-04
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "041_add_npo_hashtag"
down_revision = "040_add_is_monthly_paddle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "npos",
        sa.Column(
            "hashtag",
            sa.String(100),
            nullable=True,
            comment="Social media hashtag for the organization (e.g., '#HelpingHands')",
        ),
    )


def downgrade() -> None:
    op.drop_column("npos", "hashtag")
