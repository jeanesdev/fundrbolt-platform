"""add usage tag to event media

Revision ID: 4f6a8b9c1d2e
Revises: b1c2d3e4f5a6
Create Date: 2026-03-02 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4f6a8b9c1d2e"
down_revision: str | Sequence[str] | None = "b1c2d3e4f5a6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    usage_tag_enum = sa.Enum(
        "main_event_page_hero",
        "event_layout_map",
        "npo_logo",
        "event_logo",
        name="event_media_usage_tag",
    )
    usage_tag_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "event_media",
        sa.Column(
            "usage_tag",
            usage_tag_enum,
            nullable=False,
            server_default="main_event_page_hero",
        ),
    )


def downgrade() -> None:
    op.drop_column("event_media", "usage_tag")

    usage_tag_enum = sa.Enum(
        "main_event_page_hero",
        "event_layout_map",
        "npo_logo",
        "event_logo",
        name="event_media_usage_tag",
    )
    usage_tag_enum.drop(op.get_bind(), checkfirst=True)
