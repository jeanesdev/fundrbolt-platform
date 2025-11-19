"""Add search optimization indexes and tsvector columns

Revision ID: b581d537bb64
Revises: 05a6b636797a
Create Date: 2025-11-19 07:27:21.302114

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "b581d537bb64"
down_revision = "05a6b636797a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add search optimization indexes and tsvector columns for full-text search."""

    # 1. Add tsvector columns for full-text search
    # Users table: search on first_name, last_name, email
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS search_vector tsvector
        GENERATED ALWAYS AS (
            setweight(to_tsvector('english', coalesce(first_name, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(last_name, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(email, '')), 'B')
        ) STORED;
    """)

    # NPOs table: search on name, mission_statement, description
    op.execute("""
        ALTER TABLE npos
        ADD COLUMN IF NOT EXISTS search_vector tsvector
        GENERATED ALWAYS AS (
            setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(mission_statement, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(description, '')), 'C')
        ) STORED;
    """)

    # Events table: search on name, description
    op.execute("""
        ALTER TABLE events
        ADD COLUMN IF NOT EXISTS search_vector tsvector
        GENERATED ALWAYS AS (
            setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(description, '')), 'B')
        ) STORED;
    """)

    # 2. Create GIN indexes on tsvector columns for fast full-text search (T007 + T073)
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_users_search_vector ON users USING gin (search_vector);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_npos_search_vector ON npos USING gin (search_vector);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_events_search_vector ON events USING gin (search_vector);"
    )

    # 3. Add B-tree indexes for common query patterns (T007)
    # Events by NPO and datetime - these columns definitely exist
    op.execute("CREATE INDEX IF NOT EXISTS idx_events_npo_id ON events (npo_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_events_event_datetime ON events (event_datetime);")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_events_npo_id_datetime ON events (npo_id, event_datetime);"
    )

    # NPO members - table and columns exist
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'npo_members') THEN
                CREATE INDEX IF NOT EXISTS idx_npo_members_npo_id ON npo_members (npo_id);
                CREATE INDEX IF NOT EXISTS idx_npo_members_user_id ON npo_members (user_id);
            END IF;
        END$$;
    """)


def downgrade() -> None:
    """Remove search optimization indexes and tsvector columns."""

    # Drop B-tree indexes
    op.execute("DROP INDEX IF EXISTS idx_events_npo_id_datetime;")
    op.execute("DROP INDEX IF EXISTS idx_events_event_datetime;")
    op.execute("DROP INDEX IF EXISTS idx_events_npo_id;")
    op.execute("DROP INDEX IF EXISTS idx_npo_members_user_id;")
    op.execute("DROP INDEX IF EXISTS idx_npo_members_npo_id;")

    # Drop GIN indexes
    op.execute("DROP INDEX IF EXISTS idx_events_search_vector;")
    op.execute("DROP INDEX IF EXISTS idx_npos_search_vector;")
    op.execute("DROP INDEX IF EXISTS idx_users_search_vector;")

    # Drop tsvector columns
    op.execute("ALTER TABLE events DROP COLUMN IF EXISTS search_vector;")
    op.execute("ALTER TABLE npos DROP COLUMN IF EXISTS search_vector;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS search_vector;")
