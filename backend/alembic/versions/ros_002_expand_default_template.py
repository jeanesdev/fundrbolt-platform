"""Expand default run-of-show template with more event items.

Revision ID: ros_002_expand_default_template
Revises: ros_001_add_run_of_show_tables
Create Date: 2026-05-04

Replaces the minimal "3-Hour Gala" system default template with a
more comprehensive template covering check-in, cocktail hour, dinner,
keynote, live/silent auction, and end-of-show milestones.
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "ros_002_expand_default_template"
down_revision = "ros_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$
        DECLARE
            tmpl_id UUID;
        BEGIN
            -- Find the existing system default template
            SELECT id INTO tmpl_id
            FROM run_of_show_templates
            WHERE is_system_default = TRUE
            LIMIT 1;

            IF tmpl_id IS NULL THEN
                -- Template was never seeded; create it now
                tmpl_id := gen_random_uuid();
                INSERT INTO run_of_show_templates (id, npo_id, name, is_system_default, created_by)
                VALUES (tmpl_id, NULL, 'Fundraising Gala', TRUE, NULL);
            ELSE
                -- Rename to more descriptive name and clear old items
                UPDATE run_of_show_templates SET name = 'Fundraising Gala' WHERE id = tmpl_id;
            END IF;

            -- Remove all existing template items
            DELETE FROM run_of_show_template_items WHERE template_id = tmpl_id;

            -- Insert expanded item set
            -- offset_minutes is relative to event start (event_datetime)
            -- Typical layout: event_datetime = when check-in / doors open
            INSERT INTO run_of_show_template_items
                (id, template_id, title, description, offset_minutes, donor_visible_default, auctioneer_visible_default, display_order)
            VALUES
                (gen_random_uuid(), tmpl_id, 'Check-in Opens',               'Registration desk opens for guests.',                                     0,   TRUE,  TRUE,  0),
                (gen_random_uuid(), tmpl_id, 'Cocktail Hour Begins',          'Guests mingle; silent auction opens.',                                   5,   TRUE,  TRUE,  1),
                (gen_random_uuid(), tmpl_id, 'Silent Auction Opens',          'Silent auction items available for bidding.',                             5,   TRUE,  TRUE,  2),
                (gen_random_uuid(), tmpl_id, 'Sponsor Recognition (Pre-Show)','Brief acknowledgment of major sponsors during cocktail hour.',           30,  TRUE,  TRUE,  3),
                (gen_random_uuid(), tmpl_id, 'Guests Take Seats',             'Guests move from cocktail area to dinner tables.',                       55,  TRUE,  TRUE,  4),
                (gen_random_uuid(), tmpl_id, 'Welcome & Opening Remarks',     'Executive director or emcee opens the program.',                         60,  TRUE,  TRUE,  5),
                (gen_random_uuid(), tmpl_id, 'Mission Moment / Video',        'Impactful story or video reinforcing the cause.',                        70,  TRUE,  TRUE,  6),
                (gen_random_uuid(), tmpl_id, 'Keynote Speaker',               'Featured speaker addresses the audience.',                               75,  TRUE,  TRUE,  7),
                (gen_random_uuid(), tmpl_id, 'Dinner Service Begins',         'First course served; program continues.',                                90,  TRUE,  TRUE,  8),
                (gen_random_uuid(), tmpl_id, 'Silent Auction Closes',         'Silent auction bidding window closes.',                                  100, FALSE, TRUE,  9),
                (gen_random_uuid(), tmpl_id, 'Live Auction Begins',           'Auctioneer takes the stage for live lot bidding.',                       115, TRUE,  TRUE,  10),
                (gen_random_uuid(), tmpl_id, 'Fund-a-Need / Paddle Raise',    'Direct appeal; donors raise paddles to give at various levels.',         145, TRUE,  TRUE,  11),
                (gen_random_uuid(), tmpl_id, 'Live Auction Closes',           'Final hammer falls; live auction concludes.',                            165, FALSE, TRUE,  12),
                (gen_random_uuid(), tmpl_id, 'Award Presentations',           'Recognize volunteers, sponsors, or community partners.',                 170, TRUE,  TRUE,  13),
                (gen_random_uuid(), tmpl_id, 'Closing Remarks',               'Thank donors, announce totals raised, and close the program.',           180, TRUE,  TRUE,  14),
                (gen_random_uuid(), tmpl_id, 'Checkout Opens',                'Guests proceed to checkout to pay and collect items.',                   185, TRUE,  TRUE,  15),
                (gen_random_uuid(), tmpl_id, 'End of Show',                   'Event concludes; guests depart.',                                        195, TRUE,  TRUE,  16);
        END $$;
    """)


def downgrade() -> None:
    op.execute("""
        DO $$
        DECLARE
            tmpl_id UUID;
        BEGIN
            SELECT id INTO tmpl_id
            FROM run_of_show_templates
            WHERE is_system_default = TRUE
            LIMIT 1;

            IF tmpl_id IS NOT NULL THEN
                UPDATE run_of_show_templates SET name = '3-Hour Gala' WHERE id = tmpl_id;

                DELETE FROM run_of_show_template_items WHERE template_id = tmpl_id;

                INSERT INTO run_of_show_template_items
                    (id, template_id, title, offset_minutes, donor_visible_default, auctioneer_visible_default, display_order)
                VALUES
                    (gen_random_uuid(), tmpl_id, 'Doors Open', 0, TRUE, TRUE, 0),
                    (gen_random_uuid(), tmpl_id, 'Welcome Reception / Cocktail Hour', 15, TRUE, TRUE, 1),
                    (gen_random_uuid(), tmpl_id, 'Guests Take Seats', 60, TRUE, TRUE, 2),
                    (gen_random_uuid(), tmpl_id, 'Opening Remarks', 70, TRUE, TRUE, 3),
                    (gen_random_uuid(), tmpl_id, 'Sponsor Recognition', 80, TRUE, TRUE, 4),
                    (gen_random_uuid(), tmpl_id, 'Dinner Service Begins', 90, TRUE, TRUE, 5),
                    (gen_random_uuid(), tmpl_id, 'Silent Auction Closes', 95, FALSE, TRUE, 6),
                    (gen_random_uuid(), tmpl_id, 'Live Auction Begins', 100, TRUE, TRUE, 7),
                    (gen_random_uuid(), tmpl_id, 'Fund-a-Need / Paddle Raise', 120, TRUE, TRUE, 8),
                    (gen_random_uuid(), tmpl_id, 'Live Auction Closes', 150, FALSE, TRUE, 9),
                    (gen_random_uuid(), tmpl_id, 'Award Presentation / Mission Moment', 155, TRUE, TRUE, 10),
                    (gen_random_uuid(), tmpl_id, 'Closing Remarks', 165, TRUE, TRUE, 11),
                    (gen_random_uuid(), tmpl_id, 'Checkout Opens', 170, TRUE, TRUE, 12),
                    (gen_random_uuid(), tmpl_id, 'Event Concludes', 180, TRUE, TRUE, 13);
            END IF;
        END $$;
    """)
