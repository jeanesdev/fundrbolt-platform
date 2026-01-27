"""Add external_id to auction_items

Revision ID: c8e2f7b4b9a1
Revises: sponsorship_001
Create Date: 2026-01-26 12:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "c8e2f7b4b9a1"
down_revision = "sponsorship_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("auction_items", sa.Column("external_id", sa.String(length=200), nullable=True))
    op.add_column("auction_items", sa.Column("category", sa.String(length=100), nullable=True))
    op.execute("UPDATE auction_items SET external_id = id::text WHERE external_id IS NULL")
    op.alter_column("auction_items", "external_id", nullable=False)
    op.create_index(
        op.f("ix_auction_items_external_id"),
        "auction_items",
        ["external_id"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_auction_items_event_external_id",
        "auction_items",
        ["event_id", "external_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_auction_items_event_external_id", "auction_items", type_="unique")
    op.drop_index(op.f("ix_auction_items_external_id"), table_name="auction_items")
    op.drop_column("auction_items", "category")
    op.drop_column("auction_items", "external_id")
