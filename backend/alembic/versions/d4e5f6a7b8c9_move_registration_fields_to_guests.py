"""Move registration status/check-in to guests and add primary flag

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-13 00:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "registration_guests",
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "registration_guests",
        sa.Column("check_in_time", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    op.create_index(
        "uq_registration_guests_primary",
        "registration_guests",
        ["registration_id"],
        unique=True,
        postgresql_where=sa.text("is_primary"),
    )

    op.execute(
        """
        UPDATE registration_guests g
        SET is_primary = TRUE,
            check_in_time = COALESCE(g.check_in_time, r.check_in_time),
            status = COALESCE(NULLIF(g.status, ''), r.status),
            cancellation_reason = COALESCE(g.cancellation_reason, r.cancellation_reason),
            cancellation_note = COALESCE(g.cancellation_note, r.cancellation_note),
            name = COALESCE(g.name, u.first_name || ' ' || u.last_name),
            email = COALESCE(g.email, u.email),
            phone = COALESCE(g.phone, u.phone),
            checked_in = COALESCE(g.checked_in, r.check_in_time IS NOT NULL)
        FROM event_registrations r
        JOIN users u ON u.id = r.user_id
        WHERE g.registration_id = r.id
          AND g.user_id = r.user_id
        """
    )

    op.execute(
        """
        INSERT INTO registration_guests (
            id,
            registration_id,
            user_id,
            name,
            email,
            phone,
            invited_by_admin,
            invitation_sent_at,
            checked_in,
            status,
            cancellation_reason,
            cancellation_note,
            bidder_number,
            table_number,
            bidder_number_assigned_at,
            is_table_captain,
            check_in_time,
            is_primary,
            created_at,
            updated_at
        )
        SELECT
            gen_random_uuid(),
            r.id,
            r.user_id,
            u.first_name || ' ' || u.last_name,
            u.email,
            u.phone,
            FALSE,
            NULL,
            (r.check_in_time IS NOT NULL),
            r.status,
            r.cancellation_reason,
            r.cancellation_note,
            NULL,
            NULL,
            NULL,
            FALSE,
            r.check_in_time,
            TRUE,
            now(),
            now()
        FROM event_registrations r
        JOIN users u ON u.id = r.user_id
        WHERE NOT EXISTS (
            SELECT 1
            FROM registration_guests g
            WHERE g.registration_id = r.id
              AND g.user_id = r.user_id
        )
        """
    )

    op.execute(
        """
        UPDATE meal_selections ms
        SET guest_id = g.id
        FROM registration_guests g
        WHERE ms.guest_id IS NULL
          AND g.registration_id = ms.registration_id
          AND g.is_primary = TRUE
        """
    )

    op.drop_index("idx_user_event_status", table_name="event_registrations")
    op.drop_index("ix_event_registrations_status", table_name="event_registrations")

    op.drop_column("event_registrations", "check_in_time")
    op.drop_column("event_registrations", "cancellation_note")
    op.drop_column("event_registrations", "cancellation_reason")
    op.drop_column("event_registrations", "status")


def downgrade() -> None:
    op.add_column(
        "event_registrations",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="confirmed"),
    )
    op.add_column(
        "event_registrations",
        sa.Column("cancellation_reason", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "event_registrations",
        sa.Column("cancellation_note", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "event_registrations",
        sa.Column("check_in_time", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    op.create_index("ix_event_registrations_status", "event_registrations", ["status"])
    op.create_index(
        "idx_user_event_status",
        "event_registrations",
        ["user_id", "event_id", "status"],
    )

    op.drop_index("uq_registration_guests_primary", table_name="registration_guests")
    op.drop_column("registration_guests", "check_in_time")
    op.drop_column("registration_guests", "is_primary")
