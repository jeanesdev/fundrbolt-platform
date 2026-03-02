"""Add trigger for event-scoped bidder number uniqueness

Revision ID: 015_bidder_number_uniqueness_trigger
Revises: 014_add_seating_and_bidder_fields
Create Date: 2025-12-11

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "b9c1d2e3f4a5"
down_revision = "a7b4c5d6e8f9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create function to check bidder number uniqueness within event
    op.execute("""
        CREATE OR REPLACE FUNCTION check_bidder_number_uniqueness()
        RETURNS TRIGGER AS $$
        DECLARE
            event_id_var UUID;
            existing_count INTEGER;
        BEGIN
            -- Skip check if bidder_number is NULL
            IF NEW.bidder_number IS NULL THEN
                RETURN NEW;
            END IF;

            -- Get event_id for this guest
            SELECT event_id INTO event_id_var
            FROM event_registrations
            WHERE id = NEW.registration_id;

            -- Check if this bidder number is already used in this event
            SELECT COUNT(*) INTO existing_count
            FROM registration_guests rg
            JOIN event_registrations er ON rg.registration_id = er.id
            WHERE er.event_id = event_id_var
              AND rg.bidder_number = NEW.bidder_number
              AND rg.id != NEW.id; -- Exclude current row (for updates)

            IF existing_count > 0 THEN
                RAISE EXCEPTION
                    'Bidder number % is already assigned to another guest in this event',
                    NEW.bidder_number
                USING ERRCODE = '23505'; -- Unique violation error code
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Create trigger to run before INSERT or UPDATE
    op.execute("""
        CREATE TRIGGER trg_check_bidder_number_uniqueness
        BEFORE INSERT OR UPDATE OF bidder_number
        ON registration_guests
        FOR EACH ROW
        EXECUTE FUNCTION check_bidder_number_uniqueness();
    """)


def downgrade() -> None:
    # Drop trigger
    op.execute("DROP TRIGGER IF EXISTS trg_check_bidder_number_uniqueness ON registration_guests")

    # Drop function
    op.execute("DROP FUNCTION IF EXISTS check_bidder_number_uniqueness")
