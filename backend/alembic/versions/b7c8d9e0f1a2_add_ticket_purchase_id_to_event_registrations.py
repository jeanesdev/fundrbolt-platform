"""Add ticket_purchase_id to event_registrations

Revision ID: b7c8d9e0f1a2
Revises: f1a2b3c4d5e6
Create Date: 2026-02-10 00:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "b7c8d9e0f1a2"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "event_registrations",
        sa.Column("ticket_purchase_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_event_registrations_ticket_purchase_id",
        "event_registrations",
        ["ticket_purchase_id"],
    )
    op.create_foreign_key(
        "fk_event_registrations_ticket_purchase_id",
        "event_registrations",
        "ticket_purchases",
        ["ticket_purchase_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_event_registrations_ticket_purchase_id",
        "event_registrations",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_event_registrations_ticket_purchase_id",
        table_name="event_registrations",
    )
    op.drop_column("event_registrations", "ticket_purchase_id")
