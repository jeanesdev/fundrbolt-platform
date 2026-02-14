"""add_checkin_and_transfer_audit_tables

Revision ID: 7b9d467bc7e1
Revises: c1f1c2d3e4f5
Create Date: 2026-02-07 20:58:06.411597

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7b9d467bc7e1'
down_revision = 'c1f1c2d3e4f5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create checkin_records table for immutable audit log of check-in actions
    op.create_table(
        'checkin_records',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('event_id', sa.UUID(), nullable=False),
        sa.Column('registration_id', sa.UUID(), nullable=True, comment='Registration guest ID being checked in'),
        sa.Column('action', sa.String(20), nullable=False, comment='check_in or check_out'),
        sa.Column('acted_by_user_id', sa.UUID(), nullable=False, comment='User who performed the action'),
        sa.Column('acted_at', sa.DateTime(timezone=True), nullable=False, comment='Timestamp of action'),
        sa.Column('reason', sa.Text(), nullable=True, comment='Required for check_out actions'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['registration_id'], ['registration_guests.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['acted_by_user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_checkin_records_event', 'checkin_records', ['event_id'])
    op.create_index('idx_checkin_records_registration', 'checkin_records', ['registration_id'])
    op.create_index('idx_checkin_records_acted_at', 'checkin_records', ['acted_at'])

    # Create ticket_transfer_records table for audit log of ticket ownership changes
    op.create_table(
        'ticket_transfer_records',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('event_id', sa.UUID(), nullable=False),
        sa.Column('registration_id', sa.UUID(), nullable=True),
        sa.Column('from_donor_id', sa.UUID(), nullable=True, comment='Original donor (user_id)'),
        sa.Column('to_donor_id', sa.UUID(), nullable=False, comment='New donor (user_id)'),
        sa.Column('transferred_by_user_id', sa.UUID(), nullable=False, comment='User who performed the transfer'),
        sa.Column('transferred_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['registration_id'], ['registration_guests.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['from_donor_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['to_donor_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['transferred_by_user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_ticket_transfer_records_event', 'ticket_transfer_records', ['event_id'])
    op.create_index('idx_ticket_transfer_records_registration', 'ticket_transfer_records', ['registration_id'])
    op.create_index('idx_ticket_transfer_records_transferred_at', 'ticket_transfer_records', ['transferred_at'])

    # Add check-in timestamp fields to registration_guests table
    op.add_column('registration_guests', sa.Column('checked_in_at', sa.DateTime(timezone=True), nullable=True, comment='Timestamp when guest was checked in'))
    op.add_column('registration_guests', sa.Column('checked_out_at', sa.DateTime(timezone=True), nullable=True, comment='Timestamp when guest was checked out'))
    op.create_index('idx_registration_guests_checked_in_at', 'registration_guests', ['checked_in_at'])


def downgrade() -> None:
    # Remove indexes and columns from registration_guests
    op.drop_index('idx_registration_guests_checked_in_at', table_name='registration_guests')
    op.drop_column('registration_guests', 'checked_out_at')
    op.drop_column('registration_guests', 'checked_in_at')

    # Drop ticket_transfer_records table
    op.drop_index('idx_ticket_transfer_records_transferred_at', table_name='ticket_transfer_records')
    op.drop_index('idx_ticket_transfer_records_registration', table_name='ticket_transfer_records')
    op.drop_index('idx_ticket_transfer_records_event', table_name='ticket_transfer_records')
    op.drop_table('ticket_transfer_records')

    # Drop checkin_records table
    op.drop_index('idx_checkin_records_acted_at', table_name='checkin_records')
    op.drop_index('idx_checkin_records_registration', table_name='checkin_records')
    op.drop_index('idx_checkin_records_event', table_name='checkin_records')
    op.drop_table('checkin_records')
