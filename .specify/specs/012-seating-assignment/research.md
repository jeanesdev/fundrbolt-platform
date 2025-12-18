# Technical Research: Seating Assignment & Bidder Number Management

**Feature**: 012-seating-assignment
**Date**: 2025-12-11
**Status**: Complete

## Overview

This document consolidates technical research and design decisions for implementing table seating assignments and bidder number management in the Fundrbolt fundraising platform. All decisions align with the project constitution and leverage existing infrastructure.

---

## 1. Database Schema Design

### Decision: Extend Existing Tables (No New Tables)

**Rationale**:

- Event seating configuration (table_count, max_guests_per_table) belongs on the `events` table
- Table assignments and bidder numbers belong on individual attendee records (`registration_guests` table)
- Primary registrant (user) is also an attendee—treat as "implicit guest" with same fields
- Avoids creating separate `tables` or `seat_assignments` join tables that would add query complexity

**Implementation**:

```sql
-- Add to events table
ALTER TABLE events ADD COLUMN table_count INTEGER;
ALTER TABLE events ADD COLUMN max_guests_per_table INTEGER;

-- Add to registration_guests table
ALTER TABLE registration_guests ADD COLUMN bidder_number INTEGER CHECK (bidder_number >= 100 AND bidder_number <= 999);
ALTER TABLE registration_guests ADD COLUMN table_number INTEGER;
ALTER TABLE registration_guests ADD COLUMN bidder_number_assigned_at TIMESTAMP WITH TIME ZONE;

-- Add composite unique constraint for event-scoped bidder number uniqueness
-- (requires joining through registration_id to get event_id)
CREATE UNIQUE INDEX idx_bidder_number_per_event
ON registration_guests(
    (SELECT event_id FROM event_registrations WHERE id = registration_id),
    bidder_number
) WHERE bidder_number IS NOT NULL;
```

**Alternatives Considered**:

- ❌ **Separate `tables` and `seat_assignments` tables**: Over-engineered for current needs, adds unnecessary joins
- ❌ **Bidder number on `event_registrations` table**: Doesn't handle guests who need separate bidder numbers
- ✅ **Chosen approach**: Simple extension of existing models, minimal schema changes

---

## 2. Bidder Number Assignment Strategy

### Decision: Sequential Assignment with Gap Filling

**Rationale**:

- Simple to implement and understand
- Reuses released numbers (from cancellations) efficiently
- Query: "SELECT MIN(n) FROM generate_series(100, 999) AS n WHERE n NOT IN (SELECT bidder_number FROM registration_guests WHERE ...)"
- Performance: <100ms for 900-number range even with full utilization

**Algorithm**:

```python
async def assign_bidder_number(db: AsyncSession, event_id: UUID) -> int:
    """Assign next available bidder number for an event."""
    # Get all used bidder numbers for this event
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

    # Find first available number in range 100-999
    for candidate in range(100, 1000):
        if candidate not in used_numbers:
            return candidate

    raise ValueError("All bidder numbers (100-999) are in use for this event")
```

**Alternatives Considered**:

- ❌ **Random assignment**: Requires retry loop, slower, less predictable
- ❌ **Incremental counter**: Doesn't reuse released numbers, hits 999 limit faster
- ✅ **Gap-filling sequential**: Simple, efficient, fair distribution

---

## 3. Bidder Number Conflict Resolution

### Decision: Automatic Reassignment with Audit Trail

**Rationale**:

- Specification requires automatic reassignment when admin assigns duplicate number
- Prevents data integrity violations
- Audit log captures full history for dispute resolution
- In-app notification prevents user confusion

**Implementation Flow**:

```python
async def reassign_bidder_number(
    db: AsyncSession,
    target_guest_id: UUID,
    new_number: int,
    admin_user_id: UUID
) -> tuple[RegistrationGuest, RegistrationGuest | None]:
    """
    Assign bidder number to target guest, automatically reassigning previous holder.

    Returns: (target_guest, previous_holder) tuple
    """
    # Find current holder of this number
    event_id = await get_event_id_for_guest(db, target_guest_id)

    query = (
        select(RegistrationGuest)
        .join(EventRegistration)
        .where(
            EventRegistration.event_id == event_id,
            RegistrationGuest.bidder_number == new_number,
            RegistrationGuest.id != target_guest_id
        )
    )
    result = await db.execute(query)
    previous_holder = result.scalar_one_or_none()

    # Reassign previous holder to new unused number
    if previous_holder:
        new_unused_number = await assign_bidder_number(db, event_id)
        previous_holder.bidder_number = new_unused_number
        previous_holder.bidder_number_assigned_at = datetime.utcnow()

        # Log the reassignment
        await audit_log(
            db,
            action="bidder_number_reassigned",
            user_id=admin_user_id,
            resource_id=previous_holder.id,
            details={
                "old_number": new_number,
                "new_number": new_unused_number,
                "reason": "reassigned_to_another_guest",
                "reassigned_to": str(target_guest_id)
            }
        )

    # Assign number to target guest
    target_guest = await db.get(RegistrationGuest, target_guest_id)
    target_guest.bidder_number = new_number
    target_guest.bidder_number_assigned_at = datetime.utcnow()

    await db.commit()

    return (target_guest, previous_holder)
```

**Alternatives Considered**:

- ❌ **Block assignment with error**: Specification explicitly requires automatic reassignment
- ❌ **Swap numbers**: More complex, doesn't match specification behavior
- ✅ **Auto-reassign to new unused number**: Matches specification, preserves uniqueness

---

## 4. Table Assignment Data Model

### Decision: Nullable table_number Field on registration_guests

**Rationale**:

- Simple nullable integer field allows unassigned state (NULL = not yet assigned)
- No separate join table needed for assignments
- Table number validation happens at service layer (must be within 1 to table_count range)
- Supports both individual and party-based assignments

**Validation Rules**:

```python
class SeatingService:
    @staticmethod
    async def validate_table_assignment(
        db: AsyncSession,
        event_id: UUID,
        table_number: int,
        guest_ids: list[UUID]
    ) -> None:
        """Validate table assignment before persisting."""
        # Rule 1: Table number must be within configured range
        event = await db.get(Event, event_id)
        if table_number < 1 or table_number > event.table_count:
            raise ValueError(
                f"Table number must be between 1 and {event.table_count}"
            )

        # Rule 2: Table must have capacity for new guests
        current_occupancy = await get_table_occupancy(db, event_id, table_number)
        if current_occupancy + len(guest_ids) > event.max_guests_per_table:
            raise ValueError(
                f"Table {table_number} would exceed capacity "
                f"({current_occupancy + len(guest_ids)} > "
                f"{event.max_guests_per_table})"
            )
```

**Alternatives Considered**:

- ❌ **Separate `seat_assignments` table**: Over-engineered, adds query complexity
- ❌ **Store assignments in JSONB field**: Less queryable, harder to index
- ✅ **Simple nullable integer field**: Minimal schema change, easy to query and validate

---

## 5. Smart Auto-Assignment Algorithm

### Decision: Party-Aware Sequential Fill

**Rationale** (from clarification session):

- Keeps registration parties together at the same table
- Fills tables sequentially to capacity before starting next table
- Creates more natural event atmosphere (avoids many half-empty tables)
- Easier for NPO staff to know which tables are active

**Algorithm**:

```python
async def auto_assign_guests(db: AsyncSession, event_id: UUID) -> dict:
    """
    Auto-assign unassigned guests using smart assignment strategy.

    Strategy: Keep parties together, fill tables sequentially.
    """
    event = await db.get(Event, event_id)
    max_capacity = event.max_guests_per_table

    # Get all unassigned guests grouped by registration (party)
    unassigned_parties = await get_unassigned_parties(db, event_id)

    # Get current table occupancy
    table_occupancy = await get_all_table_occupancy(db, event_id)

    current_table = 1
    assignments = []

    for party in unassigned_parties:
        party_size = len(party.guests)

        # Find first table with enough space for entire party
        while current_table <= event.table_count:
            available_space = max_capacity - table_occupancy.get(current_table, 0)

            if party_size <= available_space:
                # Assign entire party to this table
                for guest in party.guests:
                    guest.table_number = current_table
                    assignments.append({
                        "guest_id": guest.id,
                        "table_number": current_table
                    })

                table_occupancy[current_table] = (
                    table_occupancy.get(current_table, 0) + party_size
                )

                # If table is now full, move to next table
                if table_occupancy[current_table] >= max_capacity:
                    current_table += 1

                break
            else:
                # Table can't fit entire party, move to next table
                current_table += 1

        if current_table > event.table_count:
            # No more tables available
            raise ValueError(
                f"Cannot fit remaining {len(unassigned_parties) - len(assignments)} "
                f"parties in available tables"
            )

    await db.commit()

    return {
        "assigned_count": len(assignments),
        "assignments": assignments
    }
```

**Alternatives Considered** (from clarification):

- ❌ **Distribute evenly**: Creates many half-empty tables
- ❌ **Fill tables sequentially (ignore parties)**: May split families/groups
- ❌ **Keep parties together only**: May leave gaps inefficiently
- ✅ **Smart assignment (party-aware + sequential)**: Best of both worlds

---

## 6. Drag-and-Drop Performance Optimization

### Decision: Optimistic UI Updates with Background Validation

**Rationale**:

- Target: <500ms from drop to visual confirmation (from clarification)
- Optimistic update provides instant feedback (<50ms)
- Background API call validates and persists within 500ms budget
- Rollback on validation failure with error notification

**Implementation**:

```typescript
// frontend/fundrbolt-admin/src/hooks/useSeatingDragDrop.ts
export function useSeatingDragDrop(eventId: string) {
  const { moveGuest, rollbackMove } = useSeatingStore();

  async function handleDrop(
    guestId: string,
    fromTable: number | null,
    toTable: number
  ) {
    const startTime = performance.now();

    // Optimistic update (instant UI feedback)
    moveGuest(guestId, toTable);

    try {
      // Background API call with timeout
      await seatingService.assignGuestToTable(eventId, guestId, toTable, {
        timeout: 450 // Leave 50ms buffer for UI updates
      });

      const elapsed = performance.now() - startTime;

      // Log if we exceeded target
      if (elapsed > 500) {
        console.warn(
          `Drag-drop operation took ${elapsed}ms (target: 500ms)`
        );
      }
    } catch (error) {
      // Rollback optimistic update on failure
      rollbackMove(guestId, fromTable);

      toast.error(
        error.message || "Failed to assign table. Please try again."
      );
    }
  }

  return { handleDrop };
}
```

**Backend Optimization**:

```python
# Minimize round-trips by doing validation in single query
@router.patch("/events/{event_id}/guests/{guest_id}/table")
async def assign_guest_to_table(
    event_id: UUID,
    guest_id: UUID,
    table_data: TableAssignmentRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Fast table assignment endpoint (<100ms target for backend).
    """
    # Single query to get all needed data
    query = (
        select(RegistrationGuest, Event)
        .join(EventRegistration)
        .join(Event)
        .where(
            RegistrationGuest.id == guest_id,
            Event.id == event_id
        )
        .options(
            selectinload(RegistrationGuest.registration)
        )
    )

    result = await db.execute(query)
    guest, event = result.one()

    # Validate capacity in Python (avoid separate query)
    current_occupancy = await get_table_occupancy_cached(
        db, event_id, table_data.table_number
    )

    if current_occupancy >= event.max_guests_per_table:
        raise HTTPException(
            status_code=400,
            detail=f"Table {table_data.table_number} is at capacity"
        )

    # Update and commit
    guest.table_number = table_data.table_number
    await db.commit()

    return {"success": True, "table_number": table_data.table_number}
```

**Alternatives Considered**:

- ❌ **Synchronous validation before UI update**: Feels slow (>500ms perceived latency)
- ❌ **No timeout on API call**: Risk of hanging UI
- ✅ **Optimistic + background + timeout**: Best UX, meets performance target

---

## 7. Donor PWA Seating Information Display

### Decision: Server-Side Data Aggregation

**Rationale**:

- Fetch complete seating data in single API call (guest info + tablemates)
- Minimize frontend logic and API round-trips
- Include profile images, bidder numbers, names, companies in response
- Collapsible section for progressive disclosure

**API Response Structure**:

```typescript
interface SeatingInfoResponse {
  myInfo: {
    bidderNumber: number | null; // null if not checked in
    fullName: string;
    tableNumber: number | null;
    checkedIn: boolean; // true if user has checked in
  tablemates: Array<{
    id: string;
    bidderNumber: number;
    firstName: string;
    lastName: string;
    company: string | null;
    profileImageUrl: string | null;
    isMyGuest: boolean; // True if part of my registration party
  }>;
  tableCapacity: {
    current: number;
    maximum: number;
  };
}
```

**Component Structure**:

```typescript
// frontend/donor-pwa/src/components/event/MySeatingSection.tsx
export function MySeatingSection({ eventId }: { eventId: string }) {
  const { data: seatingInfo, isLoading } = useSeatingInfo(eventId);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!seatingInfo || !seatingInfo.myInfo.tableNumber) {
    return (
      <Card className="p-4">
        <p className="text-muted-foreground">
          Seating assignments are pending. Check back soon!
        </p>
      </Card>
    );
  }

  return (
    <Card>
      {/* Bidder number badge - only show number if checked in */}
      {seatingInfo.myInfo.checkedIn ? (
        <BidderNumberBadge
          number={seatingInfo.myInfo.bidderNumber!}
          name={seatingInfo.myInfo.fullName}
        />
      ) : (
        <Card className="p-4 bg-muted">
          <p className="text-center text-muted-foreground">
            Check in at the event to see your bidder number
          </p>
        </Card>
      )}

      {/* Collapsible section */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger>
          <h3>My Seating - Table {seatingInfo.myInfo.tableNumber}</h3>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="grid grid-cols-2 gap-4">
            {seatingInfo.tablemates.map(tablemate => (
              <TablemateCard key={tablemate.id} {...tablemate} />
            ))}
          </div>

          <p className="text-sm text-muted-foreground mt-4">
            {seatingInfo.tableCapacity.current} / {seatingInfo.tableCapacity.maximum} seats filled
          </p>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
```

**Alternatives Considered**:

- ❌ **Client-side aggregation with multiple API calls**: Slower, more network requests
- ❌ **Always-expanded section**: Takes up too much space, not progressive disclosure
- ✅ **Server-side aggregation + collapsible UI**: Clean, performant, good UX

---

## 8. In-App Notification for Bidder Number Reassignments

### Decision: Notification Banner with Dismissible Toast

**Rationale** (from clarification):

- In-app notification only (no email to avoid inbox fatigue)
- Display on next login to donor PWA
- Clear message showing old and new bidder numbers
- Dismissible but persistent until acknowledged

**Implementation**:

```python
# Backend: Create notification record when reassignment occurs
async def create_bidder_reassignment_notification(
    db: AsyncSession,
    guest_id: UUID,
    old_number: int,
    new_number: int
) -> None:
    """Create in-app notification for bidder number reassignment."""
    guest = await db.get(RegistrationGuest, guest_id)

    if not guest.user_id:
        # Guest doesn't have account, can't notify
        return

    notification = Notification(
        user_id=guest.user_id,
        type="bidder_number_reassigned",
        title="Your Bidder Number Has Changed",
        message=f"Your bidder number has been updated from {old_number} to {new_number}.",
        data={
            "old_number": old_number,
            "new_number": new_number,
            "guest_id": str(guest_id)
        },
        read=False
    )

    db.add(notification)
    await db.commit()
```

```typescript
// Frontend: Display notification banner
export function BidderNumberChangeNotification({
  notification
}: {
  notification: Notification
}) {
  const { dismissNotification } = useNotifications();

  const { old_number, new_number } = notification.data;

  return (
    <Alert variant="warning">
      <AlertTitle>Your Bidder Number Has Changed</AlertTitle>
      <AlertDescription>
        Your bidder number has been updated from <strong>#{old_number}</strong> to{" "}
        <strong>#{new_number}</strong>. Please use your new number at the event.
      </AlertDescription>
      <Button onClick={() => dismissNotification(notification.id)}>
        Got it
      </Button>
    </Alert>
  );
}
```

**Alternatives Considered** (from clarification):

- ❌ **Email notification**: Creates inbox fatigue for minor administrative changes
- ❌ **Both email and in-app**: Redundant, excessive
- ❌ **No notification**: Users might miss number change
- ✅ **In-app only**: Balanced approach, non-intrusive, sufficient notice

---

## 9. Authorization & Permission Model

### Decision: Reuse Existing RBAC with Role Check Middleware

**Rationale**:

- Seating management requires NPO Admin or NPO Staff role (per assumptions in spec)
- Donor view of seating requires registered attendee status
- Leverage existing `@require_role()` and `@require_permission()` decorators
- No new permission tables needed

**Authorization Rules**:

```python
# Admin seating management endpoints
@router.patch("/admin/events/{event_id}/seating")
@require_role([Role.NPO_ADMIN, Role.NPO_STAFF])
async def manage_seating(...):
    """Only NPO Admins and Staff can manage seating."""
    pass

# Donor seating view endpoint
@router.get("/donor/events/{event_id}/my-seating")
async def get_my_seating(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch seating info for current user if they're registered."""
    # Check if user is registered for this event
    registration = await db.execute(
        select(EventRegistration)
        .where(
            EventRegistration.user_id == current_user.id,
            EventRegistration.event_id == event_id,
            EventRegistration.status == RegistrationStatus.CONFIRMED
        )
    )

    if not registration.scalar_one_or_none():
        raise HTTPException(
            status_code=403,
            detail="You must be registered for this event to view seating"
        )

    # Fetch seating info...
```

**Alternatives Considered**:

- ❌ **New permission table for seating**: Over-engineered, constitution says avoid this
- ❌ **No authorization**: Security risk
- ✅ **Reuse existing RBAC**: Simple, secure, follows constitution

---

## 10. Testing Strategy

### Decision: Pyramid Testing with Focus on Service Layer

**Rationale**:

- Most logic lives in services (bidder assignment, auto-assign, validation)
- Unit test services with mocked DB
- Integration tests for critical flows (registration → bidder assignment)
- Contract tests for API endpoints
- E2E tests for drag-and-drop (Playwright)

**Test Coverage Targets**:

```python
# Unit Tests (80%+ coverage)
tests/unit/test_bidder_number_service.py:
  - test_assign_bidder_number_sequential
  - test_assign_bidder_number_fills_gaps
  - test_assign_bidder_number_exhaustion_error
  - test_reassign_bidder_number_with_conflict
  - test_reassign_bidder_number_no_conflict

tests/unit/test_seating_service.py:
  - test_validate_table_assignment_success
  - test_validate_table_assignment_capacity_exceeded
  - test_validate_table_assignment_invalid_table_number
  - test_assign_guest_to_table
  - test_remove_guest_from_table

tests/unit/test_auto_assign_service.py:
  - test_auto_assign_keeps_parties_together
  - test_auto_assign_fills_tables_sequentially
  - test_auto_assign_handles_party_too_large
  - test_auto_assign_handles_insufficient_capacity

# Integration Tests
tests/integration/test_seating_assignment.py:
  - test_full_seating_flow_from_registration_to_assignment
  - test_bidder_number_uniqueness_across_event
  - test_table_capacity_enforcement
  - test_auto_assign_algorithm_with_real_data

tests/integration/test_bidder_number_flow.py:
  - test_automatic_assignment_on_registration
  - test_manual_reassignment_with_conflict_resolution
  - test_bidder_number_reuse_after_cancellation

# Contract Tests
tests/contract/test_seating_api.py:
  - test_seating_endpoints_match_openapi_schema
  - test_error_responses_match_schema
```

**Alternatives Considered**:

- ❌ **Only E2E tests**: Too slow, brittle, hard to debug
- ❌ **Only unit tests**: Misses integration issues
- ✅ **Pyramid approach**: Fast feedback, comprehensive coverage

---

## Summary of Key Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| **Database Schema** | Extend existing tables (no new tables) | Minimal schema changes, simple queries |
| **Bidder Assignment** | Sequential with gap filling | Efficient, fair, reuses canceled numbers |
| **Conflict Resolution** | Automatic reassignment | Matches spec requirement, preserves uniqueness |
| **Table Assignment** | Nullable integer field | Simple, flexible, easy to validate |
| **Auto-Assign Algorithm** | Party-aware sequential fill | Keeps parties together, fills tables efficiently |
| **Drag-Drop Performance** | Optimistic UI + background API | Meets <500ms target, good UX |
| **Donor Display** | Server-side aggregation | Minimal frontend logic, single API call |
| **Notifications** | In-app only (no email) | Avoids inbox fatigue, sufficient notice |
| **Authorization** | Reuse existing RBAC | Simple, secure, follows constitution |
| **Testing** | Pyramid with service focus | Fast, comprehensive, maintainable |

---

## Next Steps

1. ✅ Research complete
2. → Proceed to Phase 1: Generate data-model.md
3. → Generate API contracts in contracts/
4. → Generate quickstart.md
5. → Update agent context file
