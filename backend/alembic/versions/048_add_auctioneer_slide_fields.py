"""Add auctioneer slide presentation fields and paddle raise levels.

Revision ID: 048_auctioneer_slide_fields
Revises: 047_sw_review_state
Create Date: 2026-04-30
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "048_auctioneer_slide_fields"
down_revision = "047_sw_review_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "auction_items",
        sa.Column("slide_presentation_html", sa.Text(), nullable=True),
    )
    op.add_column(
        "auction_items",
        sa.Column(
            "slide_presentation_layout",
            sa.String(length=20),
            nullable=False,
            server_default="below_image",
        ),
    )
    op.create_check_constraint(
        "ck_auction_items_slide_presentation_layout",
        "auction_items",
        "slide_presentation_layout IN ('on_image', 'left_of_image', 'right_of_image', 'below_image')",
    )

    op.add_column(
        "auctioneer_event_settings",
        sa.Column(
            "paddle_raise_levels",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[10000, 5000, 2500, 1000, 500, 250, 100, 50]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("auctioneer_event_settings", "paddle_raise_levels")
    op.drop_constraint(
        "ck_auction_items_slide_presentation_layout",
        "auction_items",
        type_="check",
    )
    op.drop_column("auction_items", "slide_presentation_layout")
    op.drop_column("auction_items", "slide_presentation_html")
