"""Add image fields to revenue_generator_items.

Revision ID: rg_add_image_fields
Revises: 8f06629e5670
Create Date: 2026-05-02

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "rg_add_image_fields"
down_revision: str | None = "8f06629e5670"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "revenue_generator_items",
        sa.Column("image_url", sa.Text(), nullable=True),
    )
    op.add_column(
        "revenue_generator_items",
        sa.Column("image_blob_name", sa.String(512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("revenue_generator_items", "image_blob_name")
    op.drop_column("revenue_generator_items", "image_url")
