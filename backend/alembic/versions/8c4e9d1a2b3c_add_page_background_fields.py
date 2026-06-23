"""add page background fields

Revision ID: 8c4e9d1a2b3c
Revises: 7f9a1c2d3e4b
Create Date: 2026-06-19 06:40:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8c4e9d1a2b3c"
down_revision: str | Sequence[str] | None = "7f9a1c2d3e4b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column(
            "page_background_style",
            sa.String(length=16),
            nullable=True,
            comment="Donor page background style: solid, gradient, or image",
        ),
    )
    op.add_column(
        "events",
        sa.Column(
            "page_background_image_url",
            sa.String(length=500),
            nullable=True,
            comment="Optional image URL used when donor page background style is image",
        ),
    )
    op.create_check_constraint(
        "check_page_background_style",
        "events",
        "page_background_style IS NULL OR page_background_style IN ('solid', 'gradient', 'image')",
    )


def downgrade() -> None:
    op.drop_constraint("check_page_background_style", "events", type_="check")
    op.drop_column("events", "page_background_image_url")
    op.drop_column("events", "page_background_style")
