# Research: Table Details Management

**Feature**: 014-table-details-management
**Date**: 2026-01-01
**Phase**: 0 (Outline & Research)

## Research Questions

### Q1: Database Schema Design - New Table vs Extending Existing

**Question**: Should table customizations (capacity, name, captain) be stored in a new `event_tables` table or as fields on the existing `Event` model?

**Decision**: Create new `EventTable` model with one row per physical table

**Rationale**:
- **Scalability**: Event model already has `table_count` (can be 50-100+ tables per event). Storing per-table data as JSON or separate columns becomes unwieldy
- **Normalization**: Table-specific attributes (name, capacity, captain) naturally belong to individual table entities, not the event
- **Flexibility**: Future features (table positioning, table reservations, table-specific sponsors) easier to add
- **Query Performance**: Filtering/aggregating by table properties (e.g., "show all VIP tables") requires indexed columns, not JSON parsing
- **Audit Trail**: Per-table modifications tracked via updated_at timestamp on EventTable model

**Alternatives Considered**:
- **Alternative A**: Store as JSONB array on Event model (`table_details: [{number: 1, name: "VIP", capacity: 8}, ...]`)
  - **Rejected**: Poor query performance, no foreign key constraints for captain, difficult to validate uniqueness, no individual timestamps
- **Alternative B**: Add columns to Event model for each table (table_1_name, table_1_capacity, ...)
  - **Rejected**: Violates normalization, schema changes required when table_count increases, unmaintainable at scale
- **Alternative C**: Use existing RegistrationGuest table and infer table metadata from assignments
  - **Rejected**: Cannot define table capacity/name for empty tables, captain designation ambiguous (first assigned? explicit flag?)

### Q2: Table Captain Data Model - Boolean Flag vs Separate Table

**Question**: Should table captain designation be a boolean field on `RegistrationGuest` or a foreign key on `EventTable`?

**Decision**: Add `is_table_captain: bool` field to RegistrationGuest model + `table_captain_id: UUID` foreign key to EventTable

**Rationale**:
- **Dual Approach Benefits**:
  - Boolean flag on guest enables fast "am I captain?" queries for donor UI without join
  - Foreign key on table enables fast "who is captain of table X?" queries for admin UI
  - Trade-off: 16 bytes per table (UUID FK) + 1 byte per guest (bool) vs complex JOIN queries on every render
- **Validation**: Database constraint ensures `table_captain_id` references guest actually assigned to that table (check constraint)
- **Consistency**: Alembic migration creates trigger to auto-clear `is_table_captain=False` when guest.table_number changes
- **Performance**: Indexed foreign key supports O(1) lookups, boolean supports "show me all captains" queries without table scan

**Alternatives Considered**:
- **Alternative A**: Boolean flag only (`is_table_captain` on RegistrationGuest)
  - **Rejected**: Admin query "who is captain of table 5?" requires `SELECT * FROM registration_guests WHERE table_number=5 AND is_table_captain=true`, scanning all guests at table
- **Alternative B**: Foreign key only (`table_captain_id` on EventTable)
  - **Rejected**: Donor query "am I captain?" requires JOIN to EventTable, slower than direct boolean check
- **Alternative C**: Separate `TableCaptain` junction table
  - **Rejected**: Over-engineering for 1:1 relationship (one captain per table), adds JOIN complexity for no benefit

### Q3: Capacity Validation - Application Layer vs Database Constraints

**Question**: Should table capacity enforcement happen in API validation layer, database check constraints, or both?

**Decision**: Application layer validation in SeatingService + database check constraints as safety net

**Rationale**:
- **Defense in Depth**: API prevents bad assignments with clear error messages; DB prevents data corruption from rogue queries/migrations
- **User Experience**: Application layer returns HTTP 409 with tooltip-friendly message ("Table 5 is full (6/6 seats)"); DB constraint would raise SQLAlchemy exception
- **Performance**: Application validation checks in-memory count vs capacity before INSERT; DB constraint requires COUNT subquery on every write
- **Flexibility**: Application logic can implement "soft" warnings (90% full) vs hard blocks (100% full); DB constraints binary pass/fail

**Alternatives Considered**:
- **Alternative A**: Database constraints only (CHECK constraint on guest assignment)
  - **Rejected**: Poor UX (generic "constraint violation" errors), difficult to provide actionable feedback to user
- **Alternative B**: Application validation only
  - **Rejected**: Race conditions possible (two coordinators assign simultaneously), no protection against direct DB manipulation
- **Alternative C**: Optimistic locking with version field on EventTable
  - **Rejected**: Solves concurrency but not capacity enforcement; still need validation logic

### Q4: Table Name Uniqueness - Per Event or Global

**Question**: Should table names be unique within an event, or can multiple tables share the same name?

**Decision**: Table names NOT enforced as unique (allow duplicates)

**Rationale**:
- **Real-World Flexibility**: Events may have "VIP Table 1", "VIP Table 2", "VIP Table 3" with identical prefix
- **Cultural Naming**: Some venues name tables by theme ("Rose Table", "Lily Table") - coordinator may prefer numbered variants of same name
- **No Technical Requirement**: Spec doesn't mandate uniqueness; table_number already provides unique identifier
- **Simpler Implementation**: No unique constraint, no validation errors, no UX to handle "name already taken"

**Alternatives Considered**:
- **Alternative A**: Enforce unique constraint on (event_id, table_name)
  - **Rejected**: Spec doesn't require it; limits coordinator flexibility; adds validation complexity
- **Alternative B**: Case-insensitive uniqueness (LOWER(table_name) unique)
  - **Rejected**: Even more restrictive than Alternative A

### Q5: Polling vs WebSocket for Table Updates

**Question**: Should donor PWA use 10-second polling or WebSocket push for table assignment updates?

**Decision**: 10-second polling with optimized query (no WebSocket)

**Rationale**:
- **Specification Requirement**: Spec explicitly states "10-second polling interval" (from clarification session)
- **Update Frequency**: Table assignments change infrequently during events (coordinator adjustments 1-2 times per hour, not real-time like bids)
- **Simplicity**: Polling reuses existing REST API; WebSocket adds connection management, reconnection logic, event subscriptions
- **Server Load**: 10-second polling for 500 users = 50 req/sec; WebSocket requires persistent connections (500 open sockets)
- **Existing Pattern**: Donor PWA already polls for event status; consistent pattern across features
- **Caching**: Response includes ETag; clients send If-None-Match, server returns 304 Not Modified if unchanged

**Alternatives Considered**:
- **Alternative A**: WebSocket with Socket.IO (existing for auction bidding)
  - **Rejected**: Over-engineering for low-frequency updates; adds complexity for minimal benefit
- **Alternative B**: Server-Sent Events (SSE)
  - **Rejected**: One-way only; still requires polling for POST operations; limited browser support in PWAs
- **Alternative C**: 5-second polling
  - **Rejected**: Spec clarified 10 seconds; 5 seconds doubles server load for marginal UX improvement

## Technology Research

### SQLAlchemy 2.0 Patterns for New Model

**Pattern**: Use typed Mapped columns with relationship back-references

```python
class EventTable(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "event_tables"

    event_id: Mapped[UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    table_number: Mapped[int] = mapped_column(Integer, nullable=False)
    custom_capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    table_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    table_captain_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("registration_guests.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    event: Mapped["Event"] = relationship("Event", back_populates="tables")
    captain: Mapped["RegistrationGuest | None"] = relationship(
        "RegistrationGuest",
        foreign_keys=[table_captain_id],
    )
```

**Best Practices**:
- Use `Mapped[type]` for type safety (mypy strict mode)
- Cascade delete tables when event deleted
- SET NULL captain when guest deleted (captain assignment optional)
- Index on (event_id, table_number) for fast lookups

### React Component Patterns for Admin UI

**Pattern**: Radix UI Popover for table details panel

```tsx
<Popover>
  <PopoverTrigger asChild>
    <TableCard
      tableNumber={table.number}
      capacity={table.capacity}
      occupancy={table.guests.length}
    />
  </PopoverTrigger>
  <PopoverContent>
    <TableDetailsForm
      table={table}
      guests={table.guests}
      onUpdate={handleTableUpdate}
    />
  </PopoverContent>
</Popover>
```

**Best Practices**:
- Use Radix UI primitives for accessibility (keyboard nav, screen readers)
- Controlled components for form inputs (capacity, name)
- Optimistic updates with rollback on error
- Debounce name input (300ms) to avoid excessive API calls

### Validation Strategy (Pydantic + FastAPI)

**Pattern**: Pydantic model validators for capacity range

```python
class EventTableUpdate(BaseModel):
    table_name: str | None = Field(None, max_length=50)
    custom_capacity: int | None = Field(None, ge=1, le=20)

    @field_validator("table_name")
    def validate_table_name(cls, v: str | None) -> str | None:
        if v is not None and v.strip() == "":
            raise ValueError("Table name cannot be empty string")
        return v.strip() if v else None
```

**Best Practices**:
- Use Field constraints for range validation (ge/le)
- Trim whitespace in validators
- Reject empty strings (prefer None for "no name")
- Return clear error messages for API consumers

## Performance Considerations

### Database Indexing

**Required Indexes**:
- `event_tables(event_id, table_number)` - UNIQUE composite for fast table lookups
- `event_tables(table_captain_id)` - Foreign key index for captain queries
- `registration_guests(table_number, is_table_captain)` - Composite for "captains at table X" queries

**Query Optimization**:
- Use SELECT COUNT(*) with WHERE instead of loading all guests to check capacity
- JOIN EventTable + RegistrationGuest in single query for admin seating page
- Cache event.max_guests_per_table in application to avoid repeated Event queries

### API Response Size

**Optimization**: Include only necessary fields in donor API response

```json
{
  "table_assignment": {
    "table_number": 5,
    "table_name": "VIP Sponsors",
    "table_captain": {
      "name": "Jane Doe",
      "is_you": false
    }
  }
}
```

**Excluded Fields**: guest UUIDs, bidder numbers, meal selections (not needed for table display)

## Security Considerations

### Authorization

**Rules**:
- **Admin endpoints**: Require `event_coordinator` or `super_admin` role + event membership check
- **Donor endpoints**: Require authentication + event registration (existing patterns)
- **Table captain designation**: Validate captain is actually assigned to that table (foreign key + check constraint)

**Existing Middleware**: FastAPI dependency injection with `require_role()` decorator (from Feature 001)

### Input Validation

**Sanitization**:
- Table names: HTML escape to prevent XSS (Pydantic validator)
- Capacity: Range validation 1-20 (Pydantic Field constraints)
- Captain ID: UUID validation + existence check (SQLAlchemy foreign key)

**Rate Limiting**: Reuse existing Redis-based rate limiter (100 req/min per user)

## Migration Strategy

### Alembic Migration Steps

1. **Create event_tables table**: UUID PK, event_id FK, table_number, custom_capacity, table_name, table_captain_id FK
2. **Add is_table_captain to registration_guests**: Boolean default false, not null
3. **Create unique constraint**: (event_id, table_number) on event_tables
4. **Create check constraint**: table_captain_id must reference guest with matching table_number (deferred until Phase 1 if complex)
5. **Backfill event_tables**: Insert rows for existing events with table_count > 0 (table_number 1..N, all fields NULL)

**Rollback Plan**: Drop event_tables table, drop is_table_captain column (data loss acceptable for new feature)

## Open Questions for Phase 1

1. **UI Layout**: Should table details panel be modal, popover, or inline form? (Recommendation: Popover for quick edits)
2. **Bulk Operations**: Should admin UI support "set all tables to 8 seats"? (Spec doesn't require; defer to Phase 3)
3. **Table Ordering**: Should tables display in numerical order or custom sort? (Default: numerical ascending)
4. **Captain Notifications**: Should captain designation send email/SMS? (Spec doesn't require; log as future enhancement)

## References

- Feature 012 (Seating Assignments): Existing table_number, max_guests_per_table fields
- Constitution: YAGNI principle (no bulk operations, no notifications unless specified)
- Pydantic docs: Field validators, model validators
- SQLAlchemy 2.0 docs: Mapped types, relationship patterns
- Radix UI docs: Popover component patterns
