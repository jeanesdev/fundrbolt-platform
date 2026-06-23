"""add cause section border settings

Revision ID: 9e1a7a4bb2c1
Revises: c3f2b39d9d14
Create Date: 2026-06-22 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9e1a7a4bb2c1"
down_revision: str | None = "c3f2b39d9d14"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column("cause_section_border_color", sa.String(length=7), nullable=True),
    )
    op.add_column(
        "events",
        sa.Column("cause_section_border_width", sa.Integer(), nullable=True),
    )
    op.create_check_constraint(
        "check_cause_section_border_color_format",
        "events",
        "cause_section_border_color IS NULL OR cause_section_border_color ~ '^#[0-9A-Fa-f]{6}$'",
    )
    op.create_check_constraint(
        "check_cause_section_border_width_range",
        "events",
        "cause_section_border_width IS NULL OR (cause_section_border_width >= 0 AND cause_section_border_width <= 12)",
    )


def downgrade() -> None:
    op.drop_constraint("check_cause_section_border_width_range", "events", type_="check")
    op.drop_constraint("check_cause_section_border_color_format", "events", type_="check")
    op.drop_column("events", "cause_section_border_width")
    op.drop_column("events", "cause_section_border_color")
