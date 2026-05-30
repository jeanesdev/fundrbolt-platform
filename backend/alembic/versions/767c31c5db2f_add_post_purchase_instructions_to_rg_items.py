"""add post_purchase_instructions to revenue_generator_items

Revision ID: 767c31c5db2f
Revises: 3a5f9c72f1de
Create Date: 2026-05-28 13:10:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "767c31c5db2f"
down_revision = "3a5f9c72f1de"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "revenue_generator_items",
        sa.Column("post_purchase_instructions", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("revenue_generator_items", "post_purchase_instructions")
