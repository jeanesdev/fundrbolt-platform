"""Add missing event fields: tagline, venue_city, venue_state, venue_zip, background_color, accent_color

Revision ID: 9ee8000056a7
Revises: afd211422425
Create Date: 2025-11-10 21:34:46.246791

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "9ee8000056a7"
down_revision = "afd211422425"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add tagline field
    op.add_column(
        "events",
        sa.Column(
            "tagline",
            sa.String(length=200),
            nullable=True,
            comment="Short tagline for event (max 200 characters)",
        ),
    )

    # Add venue location fields
    op.add_column(
        "events",
        sa.Column(
            "venue_city", sa.String(length=100), nullable=True, comment="City where event is held"
        ),
    )
    op.add_column(
        "events",
        sa.Column(
            "venue_state",
            sa.String(length=50),
            nullable=True,
            comment="State/Province where event is held",
        ),
    )
    op.add_column(
        "events",
        sa.Column(
            "venue_zip",
            sa.String(length=20),
            nullable=True,
            comment="ZIP/Postal code where event is held",
        ),
    )

    # Add additional branding color fields
    op.add_column(
        "events",
        sa.Column(
            "background_color",
            sa.String(length=7),
            nullable=True,
            comment="Hex color code for background (e.g., #FFFFFF)",
        ),
    )
    op.add_column(
        "events",
        sa.Column(
            "accent_color",
            sa.String(length=7),
            nullable=True,
            comment="Hex color code for accents (e.g., #FF5733)",
        ),
    )


def downgrade() -> None:
    # Remove columns in reverse order
    op.drop_column("events", "accent_color")
    op.drop_column("events", "background_color")
    op.drop_column("events", "venue_zip")
    op.drop_column("events", "venue_state")
    op.drop_column("events", "venue_city")
    op.drop_column("events", "tagline")
