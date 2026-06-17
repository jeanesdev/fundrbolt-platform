"""add_slide_name_to_cause_section_slide_items

Revision ID: c46f7c8f1b2a
Revises: a7cbf1cb8665
Create Date: 2026-06-17 00:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "c46f7c8f1b2a"
down_revision = "a7cbf1cb8665"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "cause_section_slide_items",
        sa.Column("slide_name", sa.String(length=200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("cause_section_slide_items", "slide_name")
