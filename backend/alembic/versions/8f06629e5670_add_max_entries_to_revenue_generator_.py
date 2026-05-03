"""add max_entries to revenue_generator_items

Revision ID: 8f06629e5670
Revises: 042_rg_001
Create Date: 2026-05-02 08:30:00.545319

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "8f06629e5670"
down_revision = "042_rg_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "revenue_generator_items",
        sa.Column("max_entries", sa.Integer(), nullable=True),
    )
    op.create_check_constraint(
        "ck_revenue_generator_items_max_entries_positive",
        "revenue_generator_items",
        "max_entries IS NULL OR max_entries > 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_revenue_generator_items_max_entries_positive",
        "revenue_generator_items",
        type_="check",
    )
    op.drop_column("revenue_generator_items", "max_entries")
