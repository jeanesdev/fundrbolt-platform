# Data Model: Seating Assignment & Bidder Number Management

**Feature**: 012-seating-assignment
**Date**: 2025-12-11
**Status**: Complete

## Overview

This document defines the database schema changes for implementing table seating assignments and bidder number management. The design extends existing tables from Spec 010 (Event Registration) with minimal changes.

---

## Schema Changes

### 1. Events Table Extensions

**New Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `table_count` | `INTEGER` | `NULL`, `CHECK (table_count > 0)` | Total number of tables available for the event |
| `max_guests_per_table` | `INTEGER` | `NULL`, `CHECK (max_guests_per_table > 0)` | Maximum seating capacity per table |

**Rationale**:
- Nullable to support events without seating assignments (e.g., virtual events, standing-only events)
- **Both fields must be set together** (both NULL or both NOT NULL) - validated in service layer (FR-006a) before seating features are available
- Check constraints prevent invalid configurations (negative or zero values)
- Pydantic schema validation enforces both-or-neither constraint at API layer

**Migration Script (013_add_seating_configuration.py)**:

```python
"""Add seating configuration to events table

Revision ID: 013_add_seating_configuration
Revises: 012_event_registration_and_guests
Create Date: 2025-12-11
"""

from alembic import op
import sqlalchemy as sa

revision = '013_add_seating_configuration'
down_revision = '012_event_registration_and_guests'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add seating configuration columns to events table
    op.add_column('events', sa.Column('table_count', sa.Integer(), nullable=True))
    op.add_column('events', sa.Column('max_guests_per_table', sa.Integer(), nullable=True))

    # Add check constraints
    op.create_check_constraint(
        'ck_events_table_count_positive',
        'events',
        'table_count IS NULL OR table_count > 0'
    )
    op.create_check_constraint(
        'ck_events_max_guests_per_table_positive',
        'events',
        'max_guests_per_table IS NULL OR max_guests_per_table > 0'
    )

def downgrade() -> None:
    # Drop check constraints
    op.drop_constraint('ck_events_max_guests_per_table_positive', 'events', type_='check')
    op.drop_constraint('ck_events_table_count_positive', 'events', type_='check')

    # Drop columns
    op.drop_column('events', 'max_guests_per_table')
    op.drop_column('events', 'table_count')
```

---

### 2. Registration Guests Table Extensions

**New Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `bidder_number` | `INTEGER` | `NULL`, `CHECK (bidder_number >= 100 AND bidder_number <= 999)` | Three-digit bidder number for auction participation |
| `table_number` | `INTEGER` | `NULL`, `CHECK (table_number > 0)` | Assigned table number (NULL = unassigned) |
| `bidder_number_assigned_at` | `TIMESTAMP WITH TIME ZONE` | `NULL` | Timestamp of initial bidder number assignment (for audit trail) |

**Rationale**:
- `bidder_number` range: 100-999 provides 900 unique numbers per event (sufficient for most events)
- Nullable to support guests not participating in auctions or not yet assigned
- `table_number` validated at service layer against `events.table_count`
- `bidder_number_assigned_at` tracks initial assignment for audit purposes (reassignments tracked in audit logs)

**Migration Script (014_add_seating_and_bidder_fields.py)**:

```python
"""Add seating and bidder number fields to registration guests

Revision ID: 014_add_seating_and_bidder_fields
Revises: 013_add_seating_configuration
Create Date: 2025-12-11
"""

from alembic import op
import sqlalchemy as sa

revision = '014_add_seating_and_bidder_fields'
down_revision = '013_add_seating_configuration'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add seating and bidder number columns
    op.add_column('registration_guests', sa.Column('bidder_number', sa.Integer(), nullable=True))
    op.add_column('registration_guests', sa.Column('table_number', sa.Integer(), nullable=True))
    op.add_column(
        'registration_guests',
        sa.Column('bidder_number_assigned_at', sa.TIMESTAMP(timezone=True), nullable=True)
    )

    # Add check constraints
    op.create_check_constraint(
        'ck_registration_guests_bidder_number_range',
        'registration_guests',
        'bidder_number IS NULL OR (bidder_number >= 100 AND bidder_number <= 999)'
    )
    op.create_check_constraint(
        'ck_registration_guests_table_number_positive',
        'registration_guests',
        'table_number IS NULL OR table_number > 0'
    )

    # Create composite index for event-scoped bidder number uniqueness
    # Note: This index includes a subquery to get event_id through registration_id
    # We'll enforce uniqueness in application logic + database trigger
    op.create_index(
        'idx_registration_guests_bidder_number',
        'registration_guests',
        ['registration_id', 'bidder_number'],
        unique=False  # Not unique here because we need event-level uniqueness
    )

    # Create index for table number queries
    op.create_index(
        'idx_registration_guests_table_number',
        'registration_guests',
        ['table_number'],
        unique=False
    )

def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_registration_guests_table_number', table_name='registration_guests')
    op.drop_index('idx_registration_guests_bidder_number', table_name='registration_guests')

    # Drop check constraints
    op.drop_constraint('ck_registration_guests_table_number_positive', 'registration_guests', type_='check')
    op.drop_constraint('ck_registration_guests_bidder_number_range', 'registration_guests', type_='check')

    # Drop columns
    op.drop_column('registration_guests', 'bidder_number_assigned_at')
    op.drop_column('registration_guests', 'table_number')
    op.drop_column('registration_guests', 'bidder_number')
```

---

### 3. Event-Scoped Bidder Number Uniqueness

**Challenge**: Bidder numbers must be unique per event, but `registration_guests` table doesn't have direct `event_id` column (it joins through `event_registrations`).

**Solution**: Database trigger + application-level validation

**Database Trigger (015_bidder_number_uniqueness_trigger.py)**:

```python
"""Add trigger for event-scoped bidder number uniqueness

Revision ID: 015_bidder_number_uniqueness_trigger
Revises: 014_add_seating_and_bidder_fields
Create Date: 2025-12-11
"""

from alembic import op

revision = '015_bidder_number_uniqueness_trigger'
down_revision = '014_add_seating_and_bidder_fields'
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
    op.execute('DROP TRIGGER IF EXISTS trg_check_bidder_number_uniqueness ON registration_guests')

    # Drop function
    op.execute('DROP FUNCTION IF EXISTS check_bidder_number_uniqueness')
```

**Application-Level Validation** (defense in depth):

```python
# backend/app/services/bidder_number_service.py
async def validate_bidder_number_uniqueness(
    db: AsyncSession,
    event_id: UUID,
    bidder_number: int,
    exclude_guest_id: UUID | None = None
) -> None:
    """
    Validate that bidder number is unique within event.
    Raises ValueError if number is already in use.
    """
    query = (
        select(RegistrationGuest.id)
        .join(EventRegistration)
        .where(
            EventRegistration.event_id == event_id,
            RegistrationGuest.bidder_number == bidder_number
        )
    )

    if exclude_guest_id:
        query = query.where(RegistrationGuest.id != exclude_guest_id)

    result = await db.execute(query)
    existing_guest = result.scalar_one_or_none()

    if existing_guest:
        raise ValueError(
            f"Bidder number {bidder_number} is already assigned to another guest in this event"
        )
```

---

## SQLAlchemy Model Updates

### Event Model Updates

```python
# backend/app/models/event.py
from sqlalchemy import Integer, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column

class Event(Base):
    __tablename__ = "events"

    # ... existing fields ...

    # New seating configuration fields
    table_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_guests_per_table: Mapped[int | None] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        CheckConstraint('table_count IS NULL OR table_count > 0', name='ck_events_table_count_positive'),
        CheckConstraint('max_guests_per_table IS NULL OR max_guests_per_table > 0', name='ck_events_max_guests_per_table_positive'),
        # ... existing constraints ...
    )

    @property
    def has_seating_configuration(self) -> bool:
        """Check if event has seating configuration enabled."""
        return self.table_count is not None and self.max_guests_per_table is not None

    @property
    def total_seating_capacity(self) -> int | None:
        """Calculate total seating capacity if configured."""
        if self.has_seating_configuration:
            return self.table_count * self.max_guests_per_table
        return None
```

### RegistrationGuest Model Updates

```python
# backend/app/models/registration_guest.py
from sqlalchemy import Integer, CheckConstraint, Index, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

class RegistrationGuest(Base):
    __tablename__ = "registration_guests"

    # ... existing fields ...

    # New seating and bidder number fields
    bidder_number: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True
    )
    table_number: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True
    )
    bidder_number_assigned_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            'bidder_number IS NULL OR (bidder_number >= 100 AND bidder_number <= 999)',
            name='ck_registration_guests_bidder_number_range'
        ),
        CheckConstraint(
            'table_number IS NULL OR table_number > 0',
            name='ck_registration_guests_table_number_positive'
        ),
        Index('idx_registration_guests_bidder_number', 'registration_id', 'bidder_number'),
        Index('idx_registration_guests_table_number', 'table_number'),
        # ... existing indexes and constraints ...
    )

    @property
    def has_bidder_number(self) -> bool:
        """Check if guest has been assigned a bidder number."""
        return self.bidder_number is not None

    @property
    def has_table_assignment(self) -> bool:
        """Check if guest has been assigned a table."""
        return self.table_number is not None

    @property
    def is_seated(self) -> bool:
        """Check if guest is fully seated (has both bidder number and table)."""
        return self.has_bidder_number and self.has_table_assignment
```

---

## Pydantic Schema Updates

### Request Schemas

```python
# backend/app/schemas/seating.py
from pydantic import BaseModel, Field, validator
from uuid import UUID

class EventSeatingConfigRequest(BaseModel):
    """Request schema for configuring event seating."""
    table_count: int = Field(..., gt=0, description="Total number of tables")
    max_guests_per_table: int = Field(..., gt=0, description="Maximum guests per table")

    @validator('table_count')
    def validate_table_count(cls, v):
        if v > 1000:  # Reasonable upper limit
            raise ValueError("Table count cannot exceed 1000")
        return v

    @validator('max_guests_per_table')
    def validate_max_guests(cls, v):
        if v > 50:  # Reasonable upper limit
            raise ValueError("Max guests per table cannot exceed 50")
        return v

class TableAssignmentRequest(BaseModel):
    """Request schema for assigning guest(s) to a table."""
    table_number: int = Field(..., gt=0, description="Target table number")

class BulkTableAssignmentRequest(BaseModel):
    """Request schema for assigning multiple guests to tables."""
    assignments: list[dict[str, int]] = Field(
        ...,
        description="List of {guest_id: UUID, table_number: int} assignments"
    )

class BidderNumberAssignmentRequest(BaseModel):
    """Request schema for manually assigning a bidder number."""
    bidder_number: int = Field(..., ge=100, le=999, description="Three-digit bidder number")
```

### Response Schemas

```python
# backend/app/schemas/seating.py
from datetime import datetime

class BidderNumberResponse(BaseModel):
    """Response schema for bidder number assignment."""
    guest_id: UUID
    bidder_number: int
    assigned_at: datetime

    class Config:
        from_attributes = True

class TableAssignmentResponse(BaseModel):
    """Response schema for table assignment."""
    guest_id: UUID
    table_number: int
    bidder_number: int | None

    class Config:
        from_attributes = True

class SeatingInfoResponse(BaseModel):
    """Response schema for donor PWA seating information display."""
    my_info: dict = Field(
        ...,
        description="Current user's seating info (bidder_number [null if not checked in], table_number, full_name, checked_in)"
    )
    tablemates: list[dict] = Field(
        ...,
        description="List of guests at the same table"
    )
    table_capacity: dict = Field(
        ...,
        description="Current and maximum capacity for the table"
    )

class AutoAssignResponse(BaseModel):
    """Response schema for auto-assignment operation."""
    assigned_count: int
    assignments: list[TableAssignmentResponse]
    unassigned_count: int = 0
    warnings: list[str] = []  # e.g., "3 parties could not be assigned due to capacity"
```

---

## Query Patterns

### Common Queries

```python
# Get all unassigned guests for an event
async def get_unassigned_guests(db: AsyncSession, event_id: UUID):
    query = (
        select(RegistrationGuest)
        .join(EventRegistration)
        .where(
            EventRegistration.event_id == event_id,
            EventRegistration.status == RegistrationStatus.CONFIRMED,
            RegistrationGuest.table_number.is_(None)
        )
        .options(selectinload(RegistrationGuest.registration))
    )
    result = await db.execute(query)
    return result.scalars().all()

# Get table occupancy count
async def get_table_occupancy(
    db: AsyncSession,
    event_id: UUID,
    table_number: int
) -> int:
    query = (
        select(func.count(RegistrationGuest.id))
        .join(EventRegistration)
        .where(
            EventRegistration.event_id == event_id,
            RegistrationGuest.table_number == table_number
        )
    )
    result = await db.execute(query)
    return result.scalar_one()

# Get all guests at a specific table
async def get_guests_at_table(
    db: AsyncSession,
    event_id: UUID,
    table_number: int
):
    query = (
        select(RegistrationGuest)
        .join(EventRegistration)
        .where(
            EventRegistration.event_id == event_id,
            RegistrationGuest.table_number == table_number
        )
        .options(
            selectinload(RegistrationGuest.registration).selectinload(EventRegistration.user)
        )
    )
    result = await db.execute(query)
    return result.scalars().all()

# Get donor seating info with check-in status (for donor PWA)
async def get_donor_seating_info(
    db: AsyncSession,
    user_id: UUID,
    event_id: UUID
):
    """
    Get seating info for donor. Bidder number only returned if checked in.
    """
    query = (
        select(RegistrationGuest, EventRegistration)
        .join(EventRegistration)
        .where(
            EventRegistration.user_id == user_id,
            EventRegistration.event_id == event_id,
            EventRegistration.status == RegistrationStatus.CONFIRMED
        )
    )
    result = await db.execute(query)
    guest, registration = result.first()

    # Only include bidder_number if checked in
    bidder_number = guest.bidder_number if guest.check_in_time is not None else None

    return {
        "bidder_number": bidder_number,
        "table_number": guest.table_number,
        "checked_in": guest.check_in_time is not None,
        # ... other fields
    }

# Get available bidder numbers for an event
async def get_available_bidder_numbers(
    db: AsyncSession,
    event_id: UUID,
    limit: int = 10
) -> list[int]:
    """Get list of available bidder numbers (100-999)."""
    query = (
        select(RegistrationGuest.bidder_number)
        .join(EventRegistration)
        .where(
            EventRegistration.event_id == event_id,
            RegistrationGuest.bidder_number.isnot(None)
        )
    )
    result = await db.execute(query)
    used_numbers = {row[0] for row in result.fetchall()}

    available = []
    for num in range(100, 1000):
        if num not in used_numbers:
            available.append(num)
            if len(available) >= limit:
                break

    return available
```

---

## Performance Considerations

### Indexes

1. **`idx_registration_guests_bidder_number`**: Composite index on `(registration_id, bidder_number)`
   - Speeds up uniqueness checks
   - Supports queries filtering by bidder number within a registration

2. **`idx_registration_guests_table_number`**: Single-column index on `table_number`
   - Speeds up table occupancy queries
   - Supports queries fetching all guests at a table

3. **Existing index on `registration_id` (foreign key)**: Supports joins to `event_registrations`

### Query Optimization

- **Batch operations**: Use `executemany()` for bulk table assignments
- **Eager loading**: Use `selectinload()` for related registration and user data to avoid N+1 queries
- **Caching**: Cache event seating configuration (table_count, max_guests_per_table) in Redis during drag-and-drop operations

---

## Migration Sequence

Execute migrations in order:

1. **013_add_seating_configuration.py**: Add `table_count` and `max_guests_per_table` to `events` table
2. **014_add_seating_and_bidder_fields.py**: Add `bidder_number`, `table_number`, `bidder_number_assigned_at` to `registration_guests` table
3. **015_bidder_number_uniqueness_trigger.py**: Add database trigger for event-scoped bidder number uniqueness

**Rollback**: Migrations include `downgrade()` functions to safely revert changes.

---

## Data Integrity Rules

1. **Bidder Number Uniqueness**: Enforced by database trigger + application validation
2. **Table Number Range**: Validated at service layer against `events.table_count`
3. **Table Capacity**: Validated at service layer against `events.max_guests_per_table`
4. **Seating Configuration Atomicity**: Both `table_count` and `max_guests_per_table` must be set together (service layer validation)

---

## Audit Trail

Seating-related events logged to `audit_logs` table:

- `bidder_number_assigned`: Initial automatic assignment
- `bidder_number_reassigned`: Manual reassignment with conflict resolution
- `table_assigned`: Guest assigned to table
- `table_unassigned`: Guest removed from table
- `seating_auto_assigned`: Auto-assignment operation completed

**Audit Log Schema** (existing table, no changes needed):

```python
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100))  # Action type
    resource_type: Mapped[str] = mapped_column(String(100))  # e.g., "registration_guest"
    resource_id: Mapped[UUID] = mapped_column(nullable=True)  # Guest ID
    details: Mapped[dict] = mapped_column(JSON)  # Event-specific details
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
```

---

## Summary

### Tables Modified
- ✅ `events`: Added `table_count`, `max_guests_per_table`
- ✅ `registration_guests`: Added `bidder_number`, `table_number`, `bidder_number_assigned_at`

### New Database Objects
- ✅ Check constraints: 4 new constraints for value range validation
- ✅ Indexes: 2 new indexes for query optimization
- ✅ Trigger: Event-scoped bidder number uniqueness enforcement

### No New Tables
Schema design extends existing tables with minimal changes, following Constitution principle of simplicity.

---

## Next Steps

1. ✅ Data model complete
2. → Proceed to Phase 1: Generate API contracts
3. → Generate quickstart.md
4. → Update agent context file
