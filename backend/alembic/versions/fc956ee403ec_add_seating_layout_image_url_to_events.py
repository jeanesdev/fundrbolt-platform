"""add_seating_layout_image_url_to_events

Revision ID: fc956ee403ec
Revises: b9c1d2e3f4a5
Create Date: 2025-12-12 05:39:11.533820

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "fc956ee403ec"
down_revision = "b9c1d2e3f4a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add seating_layout_image_url column to events table
    op.add_column(
        "events",
        sa.Column(
            "seating_layout_image_url",
            sa.String(length=500),
            nullable=True,
            comment="Azure Blob URL for event space layout image",
        ),
    )


def downgrade() -> None:
    # Remove seating_layout_image_url column from events table
    op.drop_column("events", "seating_layout_image_url")
