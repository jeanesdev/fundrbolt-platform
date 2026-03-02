# Feature Specification: Table Details Management

**Feature Branch**: `014-table-details-management`
**Created**: 2026-01-01
**Status**: Draft
**Input**: User description: "I need to add a few features to the seating arrangements. I need to be able to customize the number of seats at each table, to be different than the default. I need to be able to name a table, and assign one of the guests at the table as 'table-captain'. By default all tables should have the same number of seats, no table name, and no table captain. The event coordinator or super admin should be able to change this from the admin pwa on the seating page for the event. In the Donor PWA, the user should see their table number, table name, and table captain (if assigned) on their home page, near the top. This shouldn't be visible until the event starts though."

## Clarifications

### Session 2026-01-01

- Q: How should the system prevent over-capacity assignments in the admin interface? → A: Disable the assign button with a tooltip showing "Table 5 is full (6/6 seats)"
- Q: What is the polling interval for donor view updates? → A: 10 seconds
- Q: How should the table captain be displayed to non-captain guests at the same table? → A: Show full name (e.g., "Table Captain: Jane Doe")

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customize Table Capacity (Priority: P1)

Event coordinators need to create tables with different capacities to accommodate various group sizes and venue layouts. Some tables near the stage might seat 8 people, while tables near exits might only accommodate 6.

**Why this priority**: This is the foundational capability that enables flexible seating arrangements. Without variable table capacity, events cannot optimize space utilization or accommodate different table configurations.

**Independent Test**: Can be fully tested by creating an event, setting up tables with different seat counts, and verifying that the system enforces capacity limits when assigning guests.

**Acceptance Scenarios**:

1. **Given** an event coordinator is on the seating page for an event, **When** they select a table, **Then** they can modify the number of seats for that specific table
2. **Given** a table has a custom seat count of 6, **When** the coordinator tries to assign a 7th guest, **Then** the system prevents the assignment and displays a capacity warning
3. **Given** an event has tables with different capacities (6, 8, 10 seats), **When** the coordinator views the seating chart, **Then** each table displays its current capacity

---

### User Story 2 - Assign Table Names (Priority: P2)

Event coordinators want to assign meaningful names to tables (e.g., "VIP Table", "Sponsor Table", "Youth Group") to make it easier for staff to direct guests and for guests to find their assigned seats.

**Why this priority**: Table naming improves guest experience and operational efficiency during check-in. While not critical for basic seating functionality, it significantly enhances usability at larger events.

**Independent Test**: Can be fully tested by setting table names in the admin interface and verifying they appear correctly on seating charts and in the donor view.

**Acceptance Scenarios**:

1. **Given** an event coordinator is viewing a table's details, **When** they enter a table name, **Then** the name is saved and displayed on the seating chart
2. **Given** a table has no assigned name, **When** displayed, **Then** it shows only the table number (default behavior)
3. **Given** a table has been named "VIP Table", **When** a donor views their seating assignment after the event starts, **Then** they see both the table number and the name "VIP Table"

---

### User Story 3 - Designate Table Captain (Priority: P2)

Event coordinators need to designate one guest at each table as the "table captain" who can serve as a point of contact for announcements, serve as a bidding representative, or help coordinate their table's activities during the event.

**Why this priority**: Table captains facilitate better event management and guest engagement. This is valuable for events with auctions, games, or activities that require table coordination. It's not critical for basic seating but enhances event execution.

**Independent Test**: Can be fully tested by assigning a table captain from the list of guests at a table and verifying the designation appears in both admin and donor views.

**Acceptance Scenarios**:

1. **Given** a table has multiple guests assigned, **When** the coordinator selects one guest as table captain, **Then** that guest is marked as the table captain
2. **Given** a guest is designated as table captain, **When** they view their event home page after the event starts, **Then** they see an indicator that they are the table captain
3. **Given** a table has Jane Doe designated as captain, **When** other guests at that table view their home page after the event starts, **Then** they see "Table Captain: Jane Doe"
4. **Given** a table captain needs to be changed, **When** the coordinator selects a different guest, **Then** the previous captain designation is removed and the new guest becomes captain

---

### User Story 4 - Donor View of Table Assignment (Priority: P1)

Donors attending an event need to know their seating assignment, including table number, table name (if any), and who their table captain is (if assigned). This information helps them navigate to their seats and understand their role at the table.

**Why this priority**: This is critical for the donor experience. Without visibility into their seating assignment, the entire feature provides no value to attendees. This must be implemented for any of the admin features to be useful.

**Independent Test**: Can be fully tested by assigning a donor to a table with custom details and verifying the information displays correctly on their home page only after the event starts.

**Acceptance Scenarios**:

1. **Given** a donor is assigned to a table and the event has started, **When** they open the donor PWA home page, **Then** they see their table number, table name (if assigned), and table captain (if assigned) near the top
2. **Given** a donor is assigned to a table but the event has not started, **When** they view their home page, **Then** the table assignment information is not visible
3. **Given** a donor is assigned to Table 5 named "Gold Sponsors" with Jane Doe as captain, **When** the event starts and they view their home page, **Then** they see "Table 5 - Gold Sponsors" and "Table Captain: Jane Doe"
4. **Given** a donor is the table captain, **When** they view their home page after the event starts, **Then** they see an indicator that they are the table captain for their table

---

### Edge Cases

- Coordinator attempts to assign a guest to a full table: The assign action is disabled with a tooltip indicating current capacity (e.g., "Table 5 is full (6/6 seats)")
- How does the system handle removing a table captain when that guest is unassigned from the table?
- What happens if a table captain is removed from the event entirely (cancellation)?
- How does the system display table information when a table has a name but no captain, or a captain but no name?
- What happens if the event start time is changed after donors have already viewed their seating assignments?
- How does the system handle tables with 0 or negative seat counts (validation needed)?
- What happens when all tables are at capacity but there are more guests to assign?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow event coordinators and super admins to modify the seat count for individual tables
- **FR-002**: System MUST enforce a minimum seat count of 1 per table
- **FR-003**: System MUST enforce a maximum seat count of 20 per table (reasonable venue limit)
- **FR-004**: System MUST prevent assignment of guests to a table when it has reached its custom capacity by disabling the assign action with a tooltip displaying the table's current occupancy (e.g., "Table 5 is full (6/6 seats)")
- **FR-005**: System MUST allow event coordinators and super admins to assign a name to any table
- **FR-006**: System MUST support table names up to 50 characters in length
- **FR-007**: System MUST allow table names to be cleared/removed (returning to default numbered display)
- **FR-008**: System MUST allow event coordinators and super admins to designate one guest at a table as the table captain
- **FR-009**: System MUST allow only one table captain per table at a time
- **FR-010**: System MUST automatically remove table captain designation if that guest is unassigned from the table
- **FR-011**: System MUST display table number, table name (if assigned), and table captain's full name (if assigned) to donors on their home page (e.g., "Table Captain: Jane Doe")
- **FR-012**: System MUST hide table assignment information from donors until the event start time has been reached
- **FR-013**: System MUST show table assignment information to donors immediately once the event starts
- **FR-014**: System MUST indicate to donors when they are designated as a table captain
- **FR-015**: System MUST persist table customizations (capacity, name, captain) across sessions
- **FR-016**: System MUST validate that a designated table captain is actually assigned to that table
- **FR-017**: System MUST update donor views when table assignments or details change using a 10-second polling interval
- **FR-018**: System MUST maintain default behavior of uniform table capacity when no custom capacity is set
- **FR-019**: System MUST display tables without names using only their table number
- **FR-020**: System MUST handle tables with no assigned captain gracefully (show no captain information rather than errors)

### Key Entities

- **Table**: Represents a physical table at an event
  - Has a table number (integer, unique within event)
  - Has an optional custom seat capacity (integer, 1-20, defaults to event's default capacity)
  - Has an optional table name (string, up to 50 characters)
  - Has an optional table captain (reference to a guest assigned to this table)
  - Belongs to one event
  - Has multiple guests assigned to it

- **Guest Assignment**: Represents a guest's assignment to a table
  - Links a guest to a specific table
  - Has a flag indicating if this guest is the table captain for this table
  - Belongs to one event registration

- **Event**: Existing entity that manages seating
  - Has a default table capacity that applies to all tables unless customized
  - Has a start time that determines when seating information becomes visible to donors

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Event coordinators can customize table capacity for any table in under 30 seconds
- **SC-002**: Event coordinators can assign table names and designate table captains in under 1 minute per table
- **SC-003**: Donors can view their complete seating assignment (number, name, captain) within 2 seconds of the event starting
- **SC-004**: 100% of donors see accurate, up-to-date table information that matches the admin assignments
- **SC-005**: System prevents 100% of capacity violations (no over-assignment of guests to tables)
- **SC-006**: Donors see their table assignment change within 30 seconds when coordinators make updates during the event
- **SC-007**: Table captain changes are reflected in donor views within 30 seconds of update
- **SC-008**: 95% of event coordinators report that customizable table details improve their event management efficiency
