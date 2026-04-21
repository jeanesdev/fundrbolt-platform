"""Add npo slug column

Revision ID: 043a_add_npo_slug
Revises: 042_add_auctioneer_role
Create Date: 2026-04-20
"""

import re

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "043a_add_npo_slug"
down_revision = "042_add_auctioneer_role"
branch_labels = None
depends_on = None


def _slugify(name: str) -> str:
    """Generate URL-safe slug from NPO name."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:100]


def upgrade() -> None:
    """Add slug column to npos table, backfill from name, add unique index."""
    # Add nullable column first to allow backfill
    op.add_column(
        "npos",
        sa.Column("slug", sa.String(100), nullable=True),
    )

    # Backfill slug from name using Python-side slugify
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, name FROM npos")).fetchall()
    seen_slugs: set[str] = set()
    for row in rows:
        base_slug = re.sub(r"[^a-z0-9]+", "-", row.name.lower()).strip("-")[:100]
        slug = base_slug
        counter = 1
        while slug in seen_slugs:
            suffix = f"-{counter}"
            slug = base_slug[: 100 - len(suffix)] + suffix
            counter += 1
        seen_slugs.add(slug)
        conn.execute(
            sa.text("UPDATE npos SET slug = :slug WHERE id = :id"),
            {"slug": slug, "id": str(row.id)},
        )

    # Make the column NOT NULL and add unique constraint
    op.alter_column("npos", "slug", nullable=False)
    op.create_unique_constraint("uq_npos_slug", "npos", ["slug"])
    op.create_index("ix_npos_slug", "npos", ["slug"], unique=True)


def downgrade() -> None:
    """Remove slug column from npos."""
    op.drop_index("ix_npos_slug", table_name="npos")
    op.drop_constraint("uq_npos_slug", "npos", type_="unique")
    op.drop_column("npos", "slug")
