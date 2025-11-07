"""fix_contact_submissions_status_to_enum

Revision ID: 32fe21a12190
Revises: 647c8f40de86
Create Date: 2025-11-07 07:32:15.390606

"""

from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "32fe21a12190"
down_revision = "647c8f40de86"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the enum type
    submission_status = postgresql.ENUM("pending", "processed", "failed", name="submissionstatus")
    submission_status.create(op.get_bind(), checkfirst=True)

    # Drop the default before changing the type
    op.execute("ALTER TABLE contact_submissions ALTER COLUMN status DROP DEFAULT")

    # Alter the column to use the enum type
    op.execute(
        "ALTER TABLE contact_submissions ALTER COLUMN status TYPE submissionstatus USING status::submissionstatus"
    )

    # Set the default back using the enum type
    op.execute(
        "ALTER TABLE contact_submissions ALTER COLUMN status SET DEFAULT 'pending'::submissionstatus"
    )


def downgrade() -> None:
    # Convert back to varchar
    op.execute("ALTER TABLE contact_submissions ALTER COLUMN status TYPE VARCHAR(20)")

    # Drop the enum type
    submission_status = postgresql.ENUM("pending", "processed", "failed", name="submissionstatus")
    submission_status.drop(op.get_bind(), checkfirst=True)
