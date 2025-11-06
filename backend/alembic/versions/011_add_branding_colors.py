"""Add background_color and accent_color to npo_branding

Revision ID: 011
Revises: 010
Create Date: 2025-11-02 21:15:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add background_color column
    op.add_column(
        "npo_branding",
        sa.Column(
            "background_color",
            sa.String(length=7),
            nullable=True,
            comment="Background color in hex format (default white)",
        ),
    )

    # Add accent_color column
    op.add_column(
        "npo_branding",
        sa.Column(
            "accent_color",
            sa.String(length=7),
            nullable=True,
            comment="Accent/highlight color in hex format",
        ),
    )

    # Set default background color to white for existing records
    op.execute(
        "UPDATE npo_branding SET background_color = '#FFFFFF' WHERE background_color IS NULL"
    )


def downgrade() -> None:
    op.drop_column("npo_branding", "accent_color")
    op.drop_column("npo_branding", "background_color")
