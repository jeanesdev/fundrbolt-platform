"""add icon_url to npo_branding

Revision ID: branding_001_add_icon_url
Revises: ros_003_multi_interval
Create Date: 2026-05-04

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "branding_001_add_icon_url"
down_revision: str | None = "ros_003_multi_interval"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "npo_branding",
        sa.Column(
            "icon_url",
            sa.String(length=500),
            nullable=True,
            comment="Azure Blob Storage URL for NPO square icon",
        ),
    )


def downgrade() -> None:
    op.drop_column("npo_branding", "icon_url")
