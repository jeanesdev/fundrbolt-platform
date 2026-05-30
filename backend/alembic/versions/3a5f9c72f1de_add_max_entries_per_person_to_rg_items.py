"""add max_entries_per_person to revenue_generator_items

Revision ID: 3a5f9c72f1de
Revises: 0e231ed1bd15
Create Date: 2026-05-28 12:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "3a5f9c72f1de"
down_revision = "0e231ed1bd15"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "revenue_generator_items",
        sa.Column("max_entries_per_person", sa.Integer(), nullable=True),
    )
    op.create_check_constraint(
        "ck_revenue_generator_items_max_entries_per_person_positive",
        "revenue_generator_items",
        "max_entries_per_person IS NULL OR max_entries_per_person > 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_revenue_generator_items_max_entries_per_person_positive",
        "revenue_generator_items",
        type_="check",
    )
    op.drop_column("revenue_generator_items", "max_entries_per_person")
