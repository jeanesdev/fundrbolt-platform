# Data Model: Table Details Management

**Feature**: 014-table-details-management
**Date**: 2026-01-01
**Phase**: 1 (Design & Contracts)

## Entity Relationship Diagram

```
┌─────────────────────┐
│      Event          │
│─────────────────────│
│ id: UUID (PK)       │
│ table_count: int?   │◄─────┐
│ max_guests_per_     │      │
│   table: int?       │      │ 1:N (event_id)
└─────────────────────┘      │
                              │
                    ┌─────────┴───────────────┐
                    │   EventTable            │
                    │─────────────────────────│
                    │ id: UUID (PK)           │
                    │ event_id: UUID (FK)     │◄──────┐
                    │ table_number: int       │       │
                    │ custom_capacity: int?   │       │ 1:N (table)
                    │ table_name: str(50)?    │       │
                    │ table_captain_id: UUID?─┼───┐   │
                    │ created_at: datetime    │   │   │
                    │ updated_at: datetime    │   │   │
                    └─────────────────────────┘   │   │
                                                  │   │
┌─────────────────────────────────────────────────┘   │
│ 0..1:1 (captain)                                    │
│                                                     │
▼                                                     │
┌─────────────────────────────────┐                  │
│  RegistrationGuest              │                  │
│─────────────────────────────────│                  │
│ id: UUID (PK)                   │                  │
│ registration_id: UUID (FK)      │                  │
│ table_number: int?              │◄─────────────────┘
│ bidder_number: int?             │     (logical link, no FK)
│ is_table_captain: bool          │◄────┐
│ ... (other fields)              │     │
└─────────────────────────────────┘     │
                                        │
         Note: is_table_captain=true   │
         for guests with matching       │
         table_number referenced by     │
         EventTable.table_captain_id────┘
```

## Schema Definitions

### New Table: event_tables

**Purpose**: Store per-table customizations (capacity, name, captain) for events with seating arrangements

**Columns**:
- `id` (UUID, PK): Primary key, auto-generated
- `event_id` (UUID, FK → events.id, NOT NULL, ON DELETE CASCADE): Event this table belongs to
- `table_number` (INTEGER, NOT NULL): Physical table identifier (1, 2, 3, ...)
- `custom_capacity` (INTEGER, NULL): Override capacity for this specific table (1-20); NULL means use event.max_guests_per_table
- `table_name` (VARCHAR(50), NULL): Optional friendly name (e.g., "VIP Sponsors", "Youth Group")
- `table_captain_id` (UUID, FK → registration_guests.id, NULL, ON DELETE SET NULL): Guest designated as table captain
- `created_at` (TIMESTAMP WITH TIME ZONE, NOT NULL): Record creation timestamp
- `updated_at` (TIMESTAMP WITH TIME ZONE, NOT NULL): Last modification timestamp

**Constraints**:
- `UNIQUE (event_id, table_number)`: Each table number unique within event
- `CHECK (custom_capacity IS NULL OR (custom_capacity >= 1 AND custom_capacity <= 20))`: Capacity range validation
- `CHECK (table_name IS NULL OR LENGTH(TRIM(table_name)) > 0)`: No empty string names (use NULL instead)

**Indexes**:
- `idx_event_tables_event_id` (event_id): Fast event lookups
- `idx_event_tables_captain_id` (table_captain_id): Fast captain reverse lookups
- `idx_event_tables_composite` (event_id, table_number): Unique composite for table queries

**Relationships**:
- `event`: Many-to-One with Event (cascade delete when event deleted)
- `captain`: One-to-One with RegistrationGuest (set null when guest deleted)

### Modified Table: registration_guests

**Purpose**: Track which guests are designated as table captains

**New Columns**:
- `is_table_captain` (BOOLEAN, NOT NULL, DEFAULT FALSE): Flag indicating this guest is captain of their assigned table

**Validation**: No database constraint enforcing consistency between `is_table_captain` and `EventTable.table_captain_id` (application-level validation)

**Indexes**: Add composite index `idx_registration_guests_table_captain` (table_number, is_table_captain) for efficient captain queries

### Existing Table References

**Event** (no modifications):
- `table_count`: Total number of tables (defines how many EventTable rows should exist)
- `max_guests_per_table`: Default capacity used when `EventTable.custom_capacity` is NULL

## State Transitions

### Table Lifecycle

```
┌─────────────┐
│   CREATED   │  Event with table_count > 0 set
│             │  → Create EventTable rows (1..table_count)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ UNCUSTOMIZED│  All fields NULL (using defaults)
│             │  custom_capacity=NULL (uses event.max_guests_per_table)
│             │  table_name=NULL (display as "Table N")
│             │  table_captain_id=NULL (no captain)
└──────┬──────┘
       │
       │ Coordinator sets capacity/name/captain
       ▼
┌─────────────┐
│ CUSTOMIZED  │  One or more fields set
│             │  custom_capacity=8 (overrides event default)
│             │  table_name="VIP Table" (friendly name)
│             │  table_captain_id=<uuid> (captain assigned)
└──────┬──────┘
       │
       │ Coordinator clears customizations
       ▼
┌─────────────┐
│ UNCUSTOMIZED│  Back to defaults (fields set to NULL)
└──────┬──────┘
       │
       │ Event deleted
       ▼
┌─────────────┐
│  DELETED    │  Cascade delete removes EventTable rows
└─────────────┘
```

### Captain Assignment Lifecycle

```
┌─────────────────┐
│ Guest assigned  │  guest.table_number = 5
│ to table        │  guest.is_table_captain = false
└────────┬────────┘
         │
         │ Coordinator designates as captain
         ▼
┌─────────────────┐
│ Captain         │  guest.is_table_captain = true
│ designated      │  event_tables[5].table_captain_id = guest.id
└────────┬────────┘
         │
         ├──────────────────────────────┐
         │                              │
         │ Coordinator changes captain  │ Guest unassigned
         ▼                              ▼
┌─────────────────┐            ┌─────────────────┐
│ Captain         │            │ Captain         │
│ changed         │            │ removed         │
│ old.is_table_   │            │ guest.table_    │
│   captain=false │            │   number=NULL   │
│ new.is_table_   │            │ guest.is_table_ │
│   captain=true  │            │   captain=false │
│ table.captain_  │            │ table.captain_  │
│   id=new.id     │            │   id=NULL       │
└─────────────────┘            └─────────────────┘
```

## Validation Rules

### Capacity Validation

**Rule**: Total guests assigned to table ≤ effective capacity
**Effective Capacity**: `EventTable.custom_capacity ?? Event.max_guests_per_table`

**Enforcement**:
1. **Application Layer**: `SeatingService.assign_guest_to_table()` checks count before INSERT
2. **API Response**: HTTP 409 Conflict with message "Table {N} is full ({occupancy}/{capacity} seats)"
3. **UI Prevention**: Disable assign button when table at capacity, show tooltip with occupancy

**Edge Cases**:
- Coordinator reduces capacity below current occupancy: Allow (coordinator must reassign excess guests manually)
- Event.max_guests_per_table changed: Affects all tables with custom_capacity=NULL
- Race condition (two assigns simultaneously): Last writer wins, may exceed capacity (acceptable risk; coordinator fixes manually)

### Captain Validation

**Rule**: Table captain must be assigned to that table
**Validation**: `registration_guests.table_number == EventTable.table_number`

**Enforcement**:
1. **Application Layer**: `SeatingService.set_table_captain()` validates guest.table_number matches table
2. **API Response**: HTTP 400 Bad Request with message "Captain must be assigned to this table"
3. **Automatic Cleanup**: When guest unassigned (table_number=NULL), set is_table_captain=false AND clear EventTable.table_captain_id

**Edge Cases**:
- Guest reassigned to different table: Clear old table captain (if was captain), do not auto-assign to new table
- Captain guest deleted: EventTable.table_captain_id SET NULL (foreign key cascade)
- Multiple captains per table: Database constraint NOT enforced (one-to-one via FK, application validates uniqueness)

### Name Validation

**Rule**: Table name 1-50 characters (trimmed) or NULL
**Validation**: Pydantic `Field(max_length=50)` + custom validator strips whitespace

**Enforcement**:
1. **Application Layer**: Pydantic schema validates length and rejects empty strings
2. **Database**: CHECK constraint ensures no empty strings stored
3. **API Response**: HTTP 422 Unprocessable Entity with validation errors

**Edge Cases**:
- Empty string: Converted to NULL (no name)
- Whitespace-only: Trimmed to empty, converted to NULL
- Special characters: Allowed (no sanitization beyond HTML escaping for XSS)

## Query Patterns

### Admin Seating Page - Get All Tables for Event

```sql
SELECT
    t.id,
    t.table_number,
    t.custom_capacity,
    t.table_name,
    t.table_captain_id,
    c.first_name AS captain_first_name,
    c.last_name AS captain_last_name,
    COUNT(g.id) AS current_occupancy,
    COALESCE(t.custom_capacity, e.max_guests_per_table) AS effective_capacity
FROM event_tables t
INNER JOIN events e ON t.event_id = e.id
LEFT JOIN registration_guests c ON t.table_captain_id = c.id
LEFT JOIN registration_guests g ON g.table_number = t.table_number
    AND g.registration_id IN (
        SELECT id FROM event_registrations WHERE event_id = :event_id
    )
WHERE t.event_id = :event_id
GROUP BY t.id, t.table_number, t.custom_capacity, t.table_name,
         t.table_captain_id, c.first_name, c.last_name, e.max_guests_per_table
ORDER BY t.table_number ASC;
```

**Performance**: Single query with JOINs, uses indexes on event_id and table_number

### Donor Home Page - Get My Table Details

```sql
SELECT
    g.table_number,
    t.table_name,
    c.first_name AS captain_first_name,
    c.last_name AS captain_last_name,
    (g.id = t.table_captain_id) AS is_me_captain
FROM registration_guests g
LEFT JOIN event_tables t ON t.event_id = :event_id
    AND t.table_number = g.table_number
LEFT JOIN registration_guests c ON t.table_captain_id = c.id
WHERE g.id = :guest_id AND g.table_number IS NOT NULL;
```

**Performance**: Indexed lookups on guest_id and composite (event_id, table_number)

### Assign Guest to Table - Check Capacity

```sql
-- Step 1: Get effective capacity
SELECT
    COALESCE(t.custom_capacity, e.max_guests_per_table) AS effective_capacity
FROM event_tables t
INNER JOIN events e ON t.event_id = e.id
WHERE t.event_id = :event_id AND t.table_number = :table_number;

-- Step 2: Count current occupancy
SELECT COUNT(*) AS current_occupancy
FROM registration_guests g
INNER JOIN event_registrations r ON g.registration_id = r.id
WHERE r.event_id = :event_id AND g.table_number = :table_number;

-- Step 3: If occupancy < capacity, UPDATE registration_guests
UPDATE registration_guests
SET table_number = :table_number, updated_at = NOW()
WHERE id = :guest_id;
```

**Optimization**: Combine steps 1-2 into single query with subquery; use transaction for atomic check-then-update

## Data Integrity

### Foreign Key Constraints

- `event_tables.event_id → events.id` (CASCADE DELETE): Tables deleted when event deleted
- `event_tables.table_captain_id → registration_guests.id` (SET NULL): Captain cleared when guest deleted
- No FK from `registration_guests.table_number` to `event_tables.table_number` (logical link only, allows flexible assignments)

### Consistency Guarantees

**Application-Enforced** (not DB constraints):
- Captain's `table_number` matches `EventTable.table_number`
- Only one guest per table has `is_table_captain=true`
- Table occupancy ≤ effective capacity

**Rationale**: Database constraints would require complex triggers and check constraints; application validation provides better error messages and rollback handling

### Migration Data Integrity

**Backfill Strategy**: Create `EventTable` rows for existing events with `table_count > 0`

```sql
INSERT INTO event_tables (id, event_id, table_number, custom_capacity, table_name, table_captain_id, created_at, updated_at)
SELECT
    gen_random_uuid(),
    e.id,
    generate_series(1, e.table_count),
    NULL,  -- Use event default
    NULL,  -- No name
    NULL,  -- No captain
    NOW(),
    NOW()
FROM events e
WHERE e.table_count IS NOT NULL AND e.table_count > 0;
```

**Verification**: After migration, count `EventTable` rows per event should equal `Event.table_count`

## Assumptions

1. **Table Numbers Immutable**: Once created, table numbers don't change (if event.table_count decreases, orphan tables remain but are unused)
2. **No Table Reordering**: Tables always displayed in ascending numerical order (no custom sort order field)
3. **Captain Uniqueness**: Application ensures one captain per table; no database enforcement
4. **Capacity Changes**: Coordinators responsible for reassigning guests if capacity reduced below occupancy
5. **Name Collisions**: Multiple tables can have identical names (no uniqueness constraint)
6. **Polling Frequency**: Donor UI polls every 10 seconds (no WebSocket push notifications)
7. **Event Start Time**: Existing `Event.start_datetime` field determines when table info becomes visible to donors
