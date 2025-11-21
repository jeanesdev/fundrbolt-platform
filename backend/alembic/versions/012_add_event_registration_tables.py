"""Add event registration, guest, and meal selection tables

Revision ID: 012
Revises: dd0d2a81dcff
Create Date: 2025-11-21 04:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "012"
down_revision = "dd0d2a81dcff"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create registration_status enum type
    registration_status = postgresql.ENUM(
        "pending", "confirmed", "cancelled", "waitlisted", name="registration_status"
    )
    registration_status.create(op.get_bind())

    # Create event_registrations table
    op.create_table(
        "event_registrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="confirmed",
            comment="Registration status",
        ),
        sa.Column(
            "ticket_type",
            sa.String(length=100),
            nullable=True,
            comment="Type of ticket (future use: VIP, General, etc.)",
        ),
        sa.Column(
            "number_of_guests",
            sa.Integer(),
            nullable=False,
            server_default="1",
            comment="Number of guests (including registrant)",
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "event_id", name="uq_user_event_registration"),
        comment="Event registrations linking donors to events",
    )

    # Create indexes for event_registrations
    op.create_index("ix_event_registrations_user_id", "event_registrations", ["user_id"])
    op.create_index("ix_event_registrations_event_id", "event_registrations", ["event_id"])
    op.create_index("ix_event_registrations_status", "event_registrations", ["status"])
    op.create_index(
        "idx_user_event_status", "event_registrations", ["user_id", "event_id", "status"]
    )

    # Create registration_guests table
    op.create_table(
        "registration_guests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("registration_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Guest's user account (if created)",
        ),
        sa.Column("name", sa.String(length=255), nullable=True, comment="Guest's full name"),
        sa.Column("email", sa.String(length=255), nullable=True, comment="Guest's email address"),
        sa.Column("phone", sa.String(length=20), nullable=True, comment="Guest's phone number"),
        sa.Column(
            "invited_by_admin",
            sa.Boolean(),
            nullable=False,
            server_default="false",
            comment="Whether admin sent registration link to this guest",
        ),
        sa.Column(
            "invitation_sent_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="When admin sent registration link",
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["registration_id"], ["event_registrations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        comment="Guest information for event registrations",
    )

    # Create indexes for registration_guests
    op.create_index(
        "ix_registration_guests_registration_id", "registration_guests", ["registration_id"]
    )
    op.create_index("ix_registration_guests_user_id", "registration_guests", ["user_id"])
    op.create_index("ix_registration_guests_email", "registration_guests", ["email"])

    # Create meal_selections table
    op.create_table(
        "meal_selections",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("registration_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "guest_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Guest who made selection (NULL = registrant)",
        ),
        sa.Column("food_option_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["registration_id"], ["event_registrations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["guest_id"], ["registration_guests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["food_option_id"], ["food_options.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("registration_id", "guest_id", name="uq_registration_guest_meal"),
        comment="Meal selections for event attendees",
    )

    # Create indexes for meal_selections
    op.create_index("ix_meal_selections_registration_id", "meal_selections", ["registration_id"])
    op.create_index("ix_meal_selections_guest_id", "meal_selections", ["guest_id"])
    op.create_index("ix_meal_selections_food_option_id", "meal_selections", ["food_option_id"])
    op.create_index(
        "idx_registration_guest_meal", "meal_selections", ["registration_id", "guest_id"]
    )


def downgrade() -> None:
    # Drop meal_selections table
    op.drop_index("idx_registration_guest_meal", table_name="meal_selections")
    op.drop_index("ix_meal_selections_food_option_id", table_name="meal_selections")
    op.drop_index("ix_meal_selections_guest_id", table_name="meal_selections")
    op.drop_index("ix_meal_selections_registration_id", table_name="meal_selections")
    op.drop_table("meal_selections")

    # Drop registration_guests table
    op.drop_index("ix_registration_guests_email", table_name="registration_guests")
    op.drop_index("ix_registration_guests_user_id", table_name="registration_guests")
    op.drop_index("ix_registration_guests_registration_id", table_name="registration_guests")
    op.drop_table("registration_guests")

    # Drop event_registrations table
    op.drop_index("idx_user_event_status", table_name="event_registrations")
    op.drop_index("ix_event_registrations_status", table_name="event_registrations")
    op.drop_index("ix_event_registrations_event_id", table_name="event_registrations")
    op.drop_index("ix_event_registrations_user_id", table_name="event_registrations")
    op.drop_table("event_registrations")

    # Drop enum type
    op.execute("DROP TYPE registration_status")
