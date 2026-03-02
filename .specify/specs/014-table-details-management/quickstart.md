# Quickstart Guide: Table Details Management

**Feature**: 014-table-details-management
**Date**: 2026-01-01
**Phase**: 1 (Design & Contracts)

## Overview

This feature adds customizable table management to the event seating system. Event coordinators can set individual table capacities, assign friendly names, and designate table captains. Donors see their table details on their home page once the event starts.

**Key Capabilities**:
- Custom table capacity (1-20 seats, overrides event default)
- Table naming (up to 50 characters, e.g., "VIP Sponsors")
- Table captain designation (one captain per table)
- Real-time capacity enforcement (prevent over-assignment)
- Donor visibility (table info appears at event start)

## Prerequisites

Before implementing this feature, ensure you have:

1. **Completed Feature 012** (Seating Assignments): This feature extends the existing seating system
2. **Database Access**: PostgreSQL 15+ with Alembic migrations configured
3. **Python Environment**: Python 3.11+ with Poetry installed
4. **Node Environment**: Node 22+ with pnpm installed
5. **Running Backend**: FastAPI dev server on `localhost:8000`
6. **Running Admin PWA**: Vite dev server on `localhost:5173`
7. **Running Donor PWA**: Vite dev server on `localhost:5174`

## Quick Setup (5 Minutes)

### 1. Database Migration

```bash
cd backend

# Create migration
poetry run alembic revision --autogenerate -m "Add table customization (Feature 014)"

# Review generated migration in backend/alembic/versions/

# Apply migration
poetry run alembic upgrade head

# Verify tables created
poetry run python -c "
from app.models import EventTable
from app.core.database import SessionLocal
db = SessionLocal()
print(f'EventTable model loaded: {EventTable.__tablename__}')
db.close()
"
```

**Expected Output**:
```
INFO  [alembic.runtime.migration] Running upgrade abc123 -> def456, Add table customization (Feature 014)
EventTable model loaded: event_tables
```

### 2. Backend Models & Services

**Create New Model**:
```bash
cd backend/app/models
touch event_table.py
```

**Key Files to Create/Modify**:
- `backend/app/models/event_table.py` - New EventTable model (150 lines)
- `backend/app/models/registration_guest.py` - Add is_table_captain field (5 lines)
- `backend/app/schemas/event_table.py` - Pydantic schemas (100 lines)
- `backend/app/services/seating_service.py` - Capacity validation logic (50 lines)
- `backend/app/api/v1/endpoints/admin/seating.py` - Table endpoints (200 lines)

**Sample EventTable Model**:
```python
# backend/app/models/event_table.py
from sqlalchemy import UUID, Integer, String, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin

class EventTable(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "event_tables"

    event_id: Mapped[UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    table_number: Mapped[int] = mapped_column(Integer, nullable=False)
    custom_capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    table_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    table_captain_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("registration_guests.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    event: Mapped["Event"] = relationship("Event", back_populates="tables")
    captain: Mapped["RegistrationGuest | None"] = relationship(
        "RegistrationGuest", foreign_keys=[table_captain_id]
    )

    __table_args__ = (
        CheckConstraint(
            "custom_capacity IS NULL OR (custom_capacity >= 1 AND custom_capacity <= 20)",
            name="ck_event_tables_capacity_range",
        ),
        CheckConstraint(
            "table_name IS NULL OR LENGTH(TRIM(table_name)) > 0",
            name="ck_event_tables_name_not_empty",
        ),
    )
```

### 3. Frontend Components

**Admin PWA Components**:
```bash
cd frontend/fundrbolt-admin/src/components/admin/seating
touch TableDetailsPanel.tsx
touch TableCapacityTooltip.tsx
```

**Donor PWA Components**:
```bash
cd frontend/donor-pwa/src/components/events
touch TableAssignmentCard.tsx
touch TableCaptainBadge.tsx
```

**Key Files to Create/Modify**:
- `frontend/fundrbolt-admin/src/components/admin/seating/TableDetailsPanel.tsx` - Edit form (200 lines)
- `frontend/fundrbolt-admin/src/components/admin/seating/TableCapacityTooltip.tsx` - Capacity warning (50 lines)
- `frontend/donor-pwa/src/components/events/TableAssignmentCard.tsx` - Display card (150 lines)
- `frontend/donor-pwa/src/routes/events/$eventSlug/index.tsx` - Add polling logic (30 lines)

### 4. Run Tests

```bash
# Backend tests
cd backend
poetry run pytest app/tests/unit/test_seating_service_validation.py -v
poetry run pytest app/tests/integration/test_table_customization_flows.py -v

# Frontend tests
cd frontend/fundrbolt-admin
pnpm test components/admin/seating

cd ../donor-pwa
pnpm test components/events
```

**Expected Output**:
```
======================== 15 passed in 2.34s ========================
```

## Development Workflow

### Step 1: Implement Backend (Day 1-2)

1. **Create Database Migration**
   - Add event_tables table
   - Add is_table_captain to registration_guests
   - Backfill event_tables for existing events

2. **Create Models & Schemas**
   - EventTable model with relationships
   - Pydantic schemas for validation
   - Update RegistrationGuest model

3. **Add Service Logic**
   - Capacity validation in SeatingService
   - Captain assignment validation
   - Table effective capacity calculation

4. **Create API Endpoints**
   - PATCH /admin/events/{id}/tables/{number}
   - GET /admin/events/{id}/tables
   - Modify PATCH /admin/events/{id}/guests/{id}/seating (add capacity check)
   - Modify GET /donor/events/{slug} (add table_assignment field)

5. **Write Tests**
   - Unit tests for validation logic
   - Integration tests for API flows
   - Contract tests for endpoint schemas

### Step 2: Implement Admin UI (Day 3-4)

1. **Create TableDetailsPanel Component**
   - Form inputs for capacity, name, captain
   - Dropdown to select captain from table guests
   - Save/cancel buttons with optimistic updates

2. **Add Capacity Validation**
   - Disable "Assign to Table" button when full
   - Show tooltip with occupancy count
   - Update counts on guest assignment changes

3. **Integrate with Seating Page**
   - Add popover trigger on table cards
   - Fetch table details on panel open
   - Refresh seating chart after updates

4. **Write Component Tests**
   - Test form validation
   - Test capacity tooltip rendering
   - Test captain dropdown filtering

### Step 3: Implement Donor UI (Day 5)

1. **Create TableAssignmentCard Component**
   - Display table number, name, captain
   - Show "You are the table captain" badge
   - Hide until event starts (check start_datetime)

2. **Add Polling Logic**
   - Fetch event details every 10 seconds
   - Extract table_assignment from response
   - Update UI on changes

3. **Add Captain Badge**
   - Styled indicator for captain status
   - Icon + text for visual distinction

4. **Write Component Tests**
   - Test visibility based on event start
   - Test captain badge rendering
   - Test polling updates

### Step 4: Integration Testing (Day 6)

1. **End-to-End Flow**
   - Coordinator sets table capacity to 6
   - Coordinator assigns 6 guests to table
   - Attempt to assign 7th guest fails with tooltip
   - Coordinator designates guest as captain
   - Donor sees table details after event starts

2. **Edge Cases**
   - Reduce capacity below occupancy (allow, warn)
   - Unassign table captain (clear captain_id)
   - Delete guest who is captain (SET NULL)
   - Event not started (hide table info from donors)

## Common Tasks

### Check Table Capacity

```python
# backend/app/services/seating_service.py
def get_effective_capacity(self, event_id: UUID, table_number: int) -> int:
    """Get effective capacity (custom or event default)."""
    table = db.query(EventTable).filter_by(
        event_id=event_id, table_number=table_number
    ).first()

    if table and table.custom_capacity:
        return table.custom_capacity

    event = db.query(Event).filter_by(id=event_id).first()
    return event.max_guests_per_table
```

### Validate Captain Assignment

```python
def set_table_captain(self, table_id: UUID, captain_id: UUID | None) -> EventTable:
    """Set or clear table captain."""
    table = db.query(EventTable).filter_by(id=table_id).first()

    if captain_id:
        # Validate captain is at this table
        captain = db.query(RegistrationGuest).filter_by(id=captain_id).first()
        if captain.table_number != table.table_number:
            raise ValueError("Captain must be assigned to this table")

        # Clear previous captain (if any)
        if table.table_captain_id:
            prev_captain = db.query(RegistrationGuest).filter_by(
                id=table.table_captain_id
            ).first()
            prev_captain.is_table_captain = False

        # Set new captain
        captain.is_table_captain = True
        table.table_captain_id = captain_id
    else:
        # Clear captain
        if table.table_captain_id:
            captain = db.query(RegistrationGuest).filter_by(
                id=table.table_captain_id
            ).first()
            captain.is_table_captain = False
        table.table_captain_id = None

    db.commit()
    return table
```

### Poll for Table Updates (Donor)

```typescript
// frontend/donor-pwa/src/routes/events/$eventSlug/index.tsx
useEffect(() => {
  const interval = setInterval(async () => {
    const event = await fetchEvent(eventSlug);
    setTableAssignment(event.table_assignment);
  }, 10000); // 10 seconds

  return () => clearInterval(interval);
}, [eventSlug]);
```

## Troubleshooting

### Issue: "Table X not found for event"

**Cause**: Event has table_count=10 but only 8 EventTable rows exist

**Fix**: Run backfill migration to create missing rows
```sql
INSERT INTO event_tables (id, event_id, table_number, created_at, updated_at)
SELECT gen_random_uuid(), :event_id, generate_series(1, :table_count), NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM event_tables WHERE event_id = :event_id AND table_number = :table_number
);
```

### Issue: "Captain must be assigned to this table"

**Cause**: Attempting to set captain who is at different table (or unassigned)

**Fix**: Ensure captain's table_number matches target table:
```python
captain = db.query(RegistrationGuest).filter_by(id=captain_id).first()
assert captain.table_number == table_number, "Captain at different table"
```

### Issue: Donor sees table info before event starts

**Cause**: Frontend not checking event.start_datetime

**Fix**: Add conditional rendering:
```typescript
const showTableInfo = event.has_started && event.table_assignment;
return showTableInfo ? <TableAssignmentCard /> : null;
```

### Issue: Capacity tooltip shows wrong count

**Cause**: Frontend counting guests from stale cache

**Fix**: Refetch seating data after guest assignment:
```typescript
await assignGuestToTable(guestId, tableNumber);
await refetchSeatingChart(); // Refresh counts
```

## Next Steps

After completing this quickstart:

1. **Review API Contracts**: See `contracts/api-contracts.md` for full endpoint specs
2. **Review Data Model**: See `data-model.md` for schema details and query patterns
3. **Implement Tasks**: Generate task breakdown with `/speckit.tasks` command
4. **Write Tests First**: Follow TDD approach, implement tests before features
5. **Iterate on UX**: Test with real coordinators, refine UI based on feedback

## Additional Resources

- **Feature Spec**: `spec.md` - Full requirements and user stories
- **Research Doc**: `research.md` - Design decisions and alternatives
- **Planning Doc**: `plan.md` - Technical context and structure
- **Constitution**: `../.specify/memory/constitution.md` - Project standards

## Support

For questions or issues during implementation:
1. Review existing Feature 012 (Seating Assignments) code for patterns
2. Check constitution for coding standards and best practices
3. Run `/speckit.clarify` if requirements unclear
4. Test incrementally (model → service → API → UI)
