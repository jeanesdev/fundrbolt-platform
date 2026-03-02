# Feature Specification: Seating Assignment & Bidder Number Management

**Feature Branch**: `012-seating-assignment`
**Created**: 2025-12-11
**Status**: Draft
**Input**: User description: "seating-assignment - I need to be able to assign each donor and their guests to a table number from the admin pwa. I need to be able to specify the max number of guests per table and the number of tables when I set up the event in the admin pwa. I also need to be able to assign each guest a random three digit bidder number, and I need to be able to easily change that number. No two guests should have the same number. If I assign a number that is already used to a new guest, the guest who previously had that number should automatically be assigned a new unused number. Please add these attributes to the backend and add inputs on the frontend admin-pwa. I also need a new tab on the event that makes it easy to see who is seated at which table and easily drag and drop to move them around if needed. It's important to know who are part of the same party though. Also on the donor pwa event homepage, before the auction items, I want to add a collapsible section that shows the user what table they are at, and what other guests are seated at their table (profile image, bidder number, first and last names, and company if provided). Also, their bidder number and name should be displayed prominently near the top of the event homepage"

## Clarifications

### Session 2025-12-11

- Q: When a guest cancels and their bidder number is released for reassignment, what is the scope of bidder number uniqueness? → A: Event-scoped - Bidder numbers are unique within a single event only; can be reused across different events
- Q: When the auto-assign feature distributes unassigned guests across tables, what strategy should it use? → A: Smart assignment - Combine party-grouping with sequential fill (keep parties together while filling tables sequentially)
- Q: When a guest's bidder number is automatically reassigned due to a conflict, how should the affected guest be notified? → A: In-app notification - Display notification banner on next login to donor PWA
- Q: What is the maximum acceptable response time for completing a drag-and-drop table reassignment (from drop to visual confirmation)? → A: 500ms - Responsive with brief loading indicator
- Q: When should table assignments typically be finalized and visible to donors? → A: After registration closes - Admin assigns tables once guest list is finalized (typically 1-2 weeks before event)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Event Setup: Table Configuration (Priority: P1)

As an NPO Admin, I need to configure the seating capacity for my event so that I can plan table assignments before guests register.

**Why this priority**: This is foundational - without table configuration, no seating assignments can be made. This must exist first.

**Independent Test**: Can be fully tested by creating an event and setting table count (e.g., 15 tables) and capacity (e.g., 8 guests per table), then verifying these values are saved and displayed.

**Acceptance Scenarios**:

1. **Given** I am creating a new event in the Admin PWA, **When** I fill in event details, **Then** I see fields for "Number of Tables" and "Maximum Guests per Table"
2. **Given** I have entered table configuration values, **When** I save the event, **Then** the system stores these values and displays them when I view the event
3. **Given** I am editing an existing event, **When** I change the number of tables or capacity, **Then** the system updates the configuration without affecting existing seat assignments
4. **Given** I set invalid values (e.g., 0 tables or negative capacity), **When** I attempt to save, **Then** the system displays validation errors

---

### User Story 2 - Automatic Bidder Number Assignment (Priority: P1)

As an NPO Admin, I need the system to automatically assign unique three-digit bidder numbers to registered guests so that each guest has a unique identifier for auction participation.

**Why this priority**: Bidder numbers are essential for auction functionality and must be in place before the event. This is a core requirement that enables auction participation.

**Independent Test**: Can be fully tested by registering multiple guests for an event and verifying each receives a unique three-digit bidder number (100-999).

**Acceptance Scenarios**:

1. **Given** a donor registers for an event with 2 guests, **When** the registration is complete, **Then** the system assigns unique three-digit bidder numbers to the donor and both guests
2. **Given** 50 guests are already registered, **When** a new guest registers, **Then** they receive a unique bidder number not used by any existing guest
3. **Given** all guests have bidder numbers, **When** I view the guest list, **Then** I see each guest's bidder number displayed alongside their name
4. **Given** a guest cancels their registration, **When** a new guest registers, **Then** the system may reuse the canceled guest's bidder number

---

### User Story 3 - Manual Bidder Number Management (Priority: P2)

As an NPO Admin, I need to manually change a guest's bidder number so that I can accommodate special requests or fix issues.

**Why this priority**: While automatic assignment handles most cases, manual override is needed for edge cases and special circumstances.

**Independent Test**: Can be fully tested by changing a guest's bidder number and verifying the old bidder number is automatically reassigned to prevent conflicts.

**Acceptance Scenarios**:

1. **Given** I am viewing a guest's details in the Admin PWA, **When** I click to edit their bidder number, **Then** I see an input field with their current number
2. **Given** I change a guest's bidder number to an unused number, **When** I save, **Then** the guest's bidder number is updated
3. **Given** Guest A has bidder number 105 and Guest B has 210, **When** I change Guest B's number to 105, **Then** Guest B receives 105 and Guest A is automatically assigned a new unused number
4. **Given** I enter an invalid bidder number (e.g., "ABC" or "12"), **When** I attempt to save, **Then** the system displays a validation error requiring a three-digit number (100-999)
5. **Given** I change a bidder number, **When** the update succeeds, **Then** I see a confirmation message showing the old and new numbers

---

### User Story 4 - Table Assignment Interface (Priority: P2)

As an NPO Admin, I need a dedicated seating chart interface where I can see all tables and drag-and-drop guests between tables so that I can efficiently organize seating arrangements.

**Why this priority**: This is the primary workflow for managing seating after guests register. Critical for event organization but depends on guest registration first.

**Independent Test**: Can be fully tested by accessing the seating tab for an event with registered guests and dragging a guest from one table to another, verifying the assignment is saved.

**Acceptance Scenarios**:

1. **Given** I am viewing an event with registered guests, **When** I navigate to the "Seating" tab, **Then** I see a visual representation of all tables
2. **Given** I am on the Seating tab, **When** I view a table, **Then** I see all guests assigned to that table grouped by registration party
3. **Given** I want to move a guest, **When** I drag their card to a different table, **Then** the guest is reassigned to that table
4. **Given** a table is at maximum capacity, **When** I attempt to drag a guest to that table, **Then** the system prevents the action and displays a message
5. **Given** I drag an entire party (donor + guests), **When** I drop them on a new table, **Then** all members of the party move together
6. **Given** guests are unassigned, **When** I view the Seating tab, **Then** I see an "Unassigned" section with all guests who don't have table assignments
7. **Given** I make seating changes, **When** I refresh the page, **Then** my changes are persisted and displayed correctly

---

### User Story 5 - Manual Individual Table Assignment (Priority: P3)

As an NPO Admin, I need to manually assign individual guests to specific tables using a dropdown or input field so that I can handle cases where drag-and-drop is impractical.

**Why this priority**: Provides an alternative method for table assignment, useful for accessibility or when drag-and-drop isn't convenient.

**Independent Test**: Can be fully tested by selecting a guest and assigning them to a specific table number via dropdown, verifying the assignment is saved.

**Acceptance Scenarios**:

1. **Given** I am viewing a guest's details, **When** I click to assign a table, **Then** I see a dropdown listing all available tables
2. **Given** I select a table from the dropdown, **When** I save, **Then** the guest is assigned to that table
3. **Given** the selected table is at capacity, **When** I attempt to save, **Then** the system displays an error and prevents the assignment
4. **Given** I assign a guest to a table, **When** I view the Seating tab, **Then** I see the guest displayed in their assigned table

---

### User Story 6 - Donor View: My Seating Information (Priority: P2)

As a donor, I need to see my table assignment and bidder number on the event homepage so that I know where to sit and how to participate in the auction.

**Why this priority**: Essential for event experience - donors need this information before attending the event.

**Independent Test**: Can be fully tested by logging in as a registered donor, viewing the event homepage, and verifying the seating section displays table number, bidder number, and table guests.

**Acceptance Scenarios**:

1. **Given** I am a registered donor viewing the event homepage, **When** I scroll before the auction items section, **Then** I see a collapsible "My Seating" section
2. **Given** I have been assigned a table, **When** I expand the "My Seating" section, **Then** I see my table number displayed prominently
3. **Given** I am viewing my seating information and I have checked in, **When** I look at my details, **Then** I see my bidder number and full name displayed prominently near the top of the page
4. **Given** I am viewing my seating information and I have NOT checked in, **When** I look at my details, **Then** I see a message "Check in at the event to see your bidder number"
5. **Given** I am viewing the "My Seating" section, **When** I look at other guests at my table, **Then** I see their profile image, bidder number, first and last name, and company (if provided)
6. **Given** I have not been assigned a table yet, **When** I view the event homepage, **Then** the "My Seating" section displays a message indicating seating assignments are pending
7. **Given** my party includes guests, **When** I view the seating section, **Then** I see my guests listed with their bidder numbers and table assignment

---

### Edge Cases

- **Table Capacity Conflicts**: What happens when an admin tries to assign more guests to a table than its maximum capacity?
  - System prevents the assignment and displays error message
  - Drag-and-drop actions to full tables are blocked with visual feedback

- **Bidder Number Exhaustion**: What happens when all 900 three-digit numbers (100-999) are in use and a new guest registers?
  - System displays error to admin indicating bidder number capacity reached
  - Admin must either remove inactive registrations or adjust event capacity

- **Guest Cancellation**: What happens to a guest's table assignment and bidder number when they cancel their registration?
  - Table assignment is removed, freeing up the seat
  - Bidder number is released and may be reassigned to new guests
  - Party members remain at their assigned table

- **Partial Party Reassignment**: What happens when an admin tries to move only some members of a registration party to a different table?
  - System allows individual guest movement but displays warning about splitting the party
  - Party grouping is maintained visually but allows split assignments

- **Event Configuration Changes**: What happens when an admin reduces the number of tables and guests are assigned to now-nonexistent tables?
  - System validates change and displays warning if assignments exist beyond new table count
  - System prompts admin to reassign affected guests before saving configuration change

- **Duplicate Manual Assignment**: What happens when an admin assigns a bidder number that's already in use?
  - System automatically reassigns the previous holder to a new unused number
  - Previous holder receives an in-app notification on next login showing the change
  - Audit log records the reassignment with reason

- **Unregistered Event Access**: What happens when a donor views an event they haven't registered for?
  - Seating section is not displayed (or shows "Register to see seating" message)
  - Event details and auction items remain visible

- **Real-time Updates**: What happens when two admins simultaneously assign the same guest to different tables?
  - System uses last-write-wins approach
  - Admins receive notification of conflicting changes on next page interaction

## Requirements *(mandatory)*

### Functional Requirements

#### Event Configuration

- **FR-001**: System MUST allow admins to specify the number of tables for an event during event creation
- **FR-002**: System MUST allow admins to specify the maximum number of guests per table during event creation
- **FR-003**: System MUST allow admins to modify table count and capacity for existing events
- **FR-004**: System MUST validate that table count is a positive integer
- **FR-005**: System MUST validate that maximum guests per table is a positive integer
- **FR-006**: System MUST prevent configuration changes that would orphan existing table assignments without admin confirmation
- **FR-006a**: System MUST validate that table_count and max_guests_per_table are either both set or both NULL (cannot set one without the other)

#### Bidder Number Management

- **FR-007**: System MUST automatically assign a unique three-digit bidder number (100-999) to each guest upon registration
- **FR-008**: System MUST ensure no two active guests have the same bidder number within an event (event-scoped uniqueness)
- **FR-009**: System MUST allow admins to manually change a guest's bidder number
- **FR-010**: System MUST validate that manually entered bidder numbers are three digits (100-999)
- **FR-011**: System MUST automatically reassign the previous holder when a bidder number is given to a new guest
- **FR-012**: System MUST track bidder number assignment history for audit purposes
- **FR-013**: System MUST make released bidder numbers (from cancellations) available for reassignment within the same event
- **FR-014**: System MUST display clear error messages when bidder number capacity (900 numbers) is exhausted
- **FR-015**: System MUST allow the same bidder number to be used across different events (event-scoped uniqueness only)
- **FR-016**: System MUST display an in-app notification banner to guests whose bidder number was automatically reassigned, showing old and new numbers

#### Table Assignment - Admin Interface

- **FR-017**: System MUST provide a dedicated "Seating" tab in the Admin PWA event view
- **FR-018**: System MUST display a visual representation of all tables with their assigned guests
- **FR-019**: System MUST group guests by their registration party when displaying table assignments
- **FR-020**: System MUST support drag-and-drop functionality for moving guests between tables
- **FR-021**: System MUST prevent drag-and-drop assignments that would exceed table capacity
- **FR-022**: System MUST provide visual feedback when a table is at capacity
- **FR-023**: System MUST display an "Unassigned" section for guests without table assignments
- **FR-024**: System MUST allow admins to move entire registration parties together
- **FR-025**: System MUST allow admins to split registration parties across different tables with confirmation
- **FR-026**: System MUST persist table assignments immediately upon drag-and-drop action
- **FR-027**: System MUST allow admins to manually assign guests to tables using a dropdown or input field
- **FR-028**: System MUST display table capacity (e.g., "6/8 seats filled") for each table
- **FR-029**: System MUST provide an "Auto-assign" feature that distributes unassigned guests across available tables using smart assignment (keep registration parties together while filling tables sequentially to capacity)

#### Table Assignment - Data Storage

- **FR-030**: System MUST store table assignment for each guest
- **FR-031**: System MUST maintain the association between guests and their registration party
- **FR-032**: System MUST allow null/unassigned state for table assignments
- **FR-033**: System MUST validate table assignments against configured table numbers

#### Donor View - Seating Display

- **FR-034**: System MUST display bidder number and full name prominently near the top of the donor event homepage **only after the donor has checked in**
- **FR-035**: System MUST display \"Check in at the event to see your bidder number\" message before check-in
- **FR-036**: System MUST display a collapsible \"My Seating\" section on the donor event homepage
- **FR-037**: System MUST position the \"My Seating\" section before the auction items section
- **FR-038**: System MUST display the guest's assigned table number in the seating section (visible before check-in)
- **FR-039**: System MUST display all other guests at the same table in the seating section
- **FR-040**: System MUST display each table guest's profile image, bidder number, first name, last name, and company (if provided)
- **FR-041**: System MUST display a \"pending assignment\" message when no table is assigned yet
- **FR-042**: System MUST only display the seating section to registered event attendees
- **FR-043**: System MUST include the guest's own party members in the table guest list

### Key Entities *(include if feature involves data)*

- **Event**: Represents a fundraising event with configurable seating
  - Attributes: number of tables, maximum guests per table, existing event attributes
  - Relationships: has many tables, has many registrations

- **Table**: Represents a physical table at an event
  - Attributes: table number (1 to N), capacity, current occupancy
  - Relationships: belongs to an event, has many seat assignments

- **Guest/Attendee**: Represents an individual attending the event (donor or their guest)
  - Attributes: bidder number (100-999), table assignment, registration party ID, existing user/guest attributes
  - Relationships: belongs to a registration party, assigned to a table

- **Registration Party**: Represents a donor and their guests who registered together
  - Attributes: primary registrant (donor), party members (guests)
  - Relationships: belongs to an event, has many guests

- **Bidder Number Assignment**: Tracks bidder number assignment history
  - Attributes: bidder number, assigned to guest, assigned at timestamp, reassigned from guest (if applicable)
  - Relationships: associated with event and guest

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admins can configure event seating (table count and capacity) in under 1 minute during event creation
- **SC-002**: System successfully assigns unique bidder numbers to 100% of registered guests automatically without conflicts
- **SC-003**: Admins can reassign a guest to a different table in under 10 seconds using drag-and-drop
- **SC-004**: Donors can view their table assignment and identify their tablemates in under 30 seconds
- **SC-005**: System handles manual bidder number reassignment with automatic conflict resolution 100% of the time without data loss
- **SC-006**: Admins can complete full seating arrangements for a 200-guest event in under 30 minutes
- **SC-007**: 90% of table assignments are completed using drag-and-drop interface (primary method)
- **SC-008**: Zero bidder number conflicts occur during event operation (all numbers remain unique)
- **SC-009**: Donors can immediately see their bidder number upon registration completion
- **SC-010**: Table capacity constraints are enforced 100% of the time, preventing over-assignment
- **SC-011**: Drag-and-drop table reassignment operations complete within 500ms from drop to visual confirmation

### Assumptions

1. **Bidder Number Range**: Three-digit numbers (100-999) provide sufficient capacity for typical events (900 unique numbers)
2. **Table Numbering**: Tables are numbered sequentially starting from 1
3. **Registration Model**: The existing registration system tracks donors and their guests as separate entities
4. **Profile Images**: Guest profile images are already available in the system or will display a default avatar
5. **Event Timeline**: Table assignments typically occur after initial registration period but before event day (typically 1-2 weeks before event once registration closes)
6. **Permission Model**: Only NPO Admins and NPO Staff can manage seating assignments
7. **Real-time Updates**: Seating changes don't need to push real-time updates to donor views (refresh on page load is acceptable)
8. **Party Size**: Most registration parties consist of 1-10 people, fitting within typical table capacities
9. **Table Configuration**: Events typically have 10-50 tables with capacities of 6-12 guests per table
10. **Audit Requirements**: Bidder number reassignments need to be tracked for dispute resolution
