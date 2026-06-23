"""add action card background fields

Revision ID: 7f9a1c2d3e4b
Revises: 6b7a8c9d0e1f
Create Date: 2026-06-18 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7f9a1c2d3e4b"
down_revision: str | None = "6b7a8c9d0e1f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column(
            "action_card_background_style",
            sa.String(length=16),
            nullable=True,
            comment="Donor action card background style: solid, gradient, or image",
        ),
    )
    op.add_column(
        "events",
        sa.Column(
            "action_card_background_image_url",
            sa.String(length=500),
            nullable=True,
            comment="Optional image URL used when donor action card background style is image",
        ),
    )
    op.add_column(
        "events",
        sa.Column(
            "action_card_background_opacity",
            sa.Float(),
            nullable=True,
            comment="Opacity for donor action card backgrounds (0.0 transparent - 1.0 opaque)",
        ),
    )

    op.create_check_constraint(
        "check_action_card_background_style",
        "events",
        "action_card_background_style IS NULL OR action_card_background_style IN ('solid', 'gradient', 'image')",
    )
    op.create_check_constraint(
        "check_action_card_background_opacity",
        "events",
        "action_card_background_opacity IS NULL OR (action_card_background_opacity >= 0 AND action_card_background_opacity <= 1)",
    )


def downgrade() -> None:
    op.drop_constraint("check_action_card_background_opacity", "events", type_="check")
    op.drop_constraint("check_action_card_background_style", "events", type_="check")
    op.drop_column("events", "action_card_background_opacity")
    op.drop_column("events", "action_card_background_image_url")
    op.drop_column("events", "action_card_background_style")
