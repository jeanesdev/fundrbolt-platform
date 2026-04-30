"""Add branding fields to donate_now_page_configs.

Adds:
- page_logo_url — small square logo for the donate-now page header
- brand_color_primary — hex color override (falls back to NPO branding)
- brand_color_secondary — hex color override (falls back to NPO branding)

Revision ID: 046_add_donate_now_branding
Revises: 045_add_donate_now_media
Create Date: 2026-04-21
"""

import sqlalchemy as sa

from alembic import op

revision = "046_add_donate_now_branding"
down_revision = "045_add_donate_now_media"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "donate_now_page_configs",
        sa.Column("page_logo_url", sa.Text(), nullable=True),
    )
    op.add_column(
        "donate_now_page_configs",
        sa.Column("brand_color_primary", sa.String(7), nullable=True),
    )
    op.add_column(
        "donate_now_page_configs",
        sa.Column("brand_color_secondary", sa.String(7), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("donate_now_page_configs", "brand_color_secondary")
    op.drop_column("donate_now_page_configs", "brand_color_primary")
    op.drop_column("donate_now_page_configs", "page_logo_url")
