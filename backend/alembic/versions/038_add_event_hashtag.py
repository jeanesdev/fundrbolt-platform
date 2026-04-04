"""Add hashtag column to events table

Revision ID: 038_add_event_hashtag
Revises: 037a001_add_checklist_tables
Create Date: 2026-04-03
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "038_add_event_hashtag"
down_revision = "037a001_add_checklist_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column(
            "hashtag",
            sa.String(100),
            nullable=True,
            comment="Social media hashtag for event sharing (e.g., '#GalaForGood2026')",
        ),
    )


def downgrade() -> None:
    op.drop_column("events", "hashtag")
