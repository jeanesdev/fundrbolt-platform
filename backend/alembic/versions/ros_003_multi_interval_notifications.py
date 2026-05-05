"""Add multi-interval support to scheduled_run_of_show_notifications.

Removes the one-per-item unique constraint and adds a minutes_before column
so multiple pre-event notification intervals can be scheduled per item.

Revision ID: ros_003_multi_interval_notifications
Revises: ros_002_expand_default_template
Create Date: 2025-01-01 00:00:00.000000
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "ros_003_multi_interval"
down_revision = "ros_002_expand_default_template"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the unique constraint that limited one notification per RoS item
    op.drop_constraint(
        "scheduled_run_of_show_notifications_ros_item_id_key",
        "scheduled_run_of_show_notifications",
        type_="unique",
    )

    # Add minutes_before column (0 = send at the exact scheduled time)
    op.add_column(
        "scheduled_run_of_show_notifications",
        sa.Column(
            "minutes_before",
            sa.Integer,
            nullable=False,
            server_default=sa.text("0"),
        ),
    )


def downgrade() -> None:
    op.drop_column("scheduled_run_of_show_notifications", "minutes_before")

    # Re-add the unique constraint (note: existing data may prevent this if
    # multiple rows share the same ros_item_id)
    op.create_unique_constraint(
        "scheduled_run_of_show_notifications_ros_item_id_key",
        "scheduled_run_of_show_notifications",
        ["ros_item_id"],
    )
