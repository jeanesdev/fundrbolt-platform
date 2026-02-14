# Feature Specification: Event check-in page

**Feature Branch**: `025-event-checkin-page`
**Created**: February 7, 2026
**Status**: Draft
**Input**: User description: "event-checkin-page: Add a page to the admin PWA that lets an event manager or admin check in registered guests at the event. They should be aboe to look up a user by name, phone number, or email. they ahould be able to register new donors, transfer tickets, update donors information, assign or change bidder number or table number, or make dinner selection. Their checkin time should be logged for the event, and the admin should have a dashvoard showing how many people and who is checked in."

## Clarifications

### Session 2026-02-07

- Q: Should check-ins be reversible? → A: Allow undo (check-out) with a required reason and audit log.
- Q: What is the check-in unit? → A: Check in each guest/ticket individually.
- Q: What should the dashboard include? → A: Totals plus a searchable list of checked-in guests.
- Q: What verification is required for ticket transfer? → A: No verification required for transfer.
- Q: Should bidder/table numbers be unique within the event? → A: Yes, enforce unique within event.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Check in registered guests (Priority: P1)

Event managers can quickly find a registered guest and mark them as checked in, with the check-in time recorded for the event.

**Why this priority**: This is the core event-day workflow and must work even without any secondary features.

**Independent Test**: Can be fully tested by searching for a known registered guest and completing check-in while verifying the recorded time and status change.

**Acceptance Scenarios**:

1. **Given** an event with registered guests, **When** an event manager searches by name, phone number, or email, **Then** matching guests are returned with current check-in status.
2. **Given** a registered guest who is not checked in, **When** the event manager marks them as checked in, **Then** the guest status updates to checked in and a check-in time is recorded for the event.
3. **Given** a guest already checked in, **When** the event manager attempts to check them in again, **Then** the system prevents duplicate check-in and displays the existing check-in time.
4. **Given** a guest checked in by mistake, **When** the event manager checks them out and provides a reason, **Then** the guest status returns to not checked in and the reason is logged.

---

### User Story 2 - Update guest details at check-in (Priority: P2)

Event managers can correct or complete guest details during check-in, including contact information, bidder number, table number, and dinner selection.

**Why this priority**: Resolves common on-site issues without delaying check-in, improving guest experience.

**Independent Test**: Can be fully tested by selecting a guest, updating each detail, and verifying the updated data is saved and shown on the guest record.

**Acceptance Scenarios**:

1. **Given** a selected guest record, **When** the event manager updates contact details, **Then** the updated information is saved and displayed immediately.
2. **Given** a selected guest record, **When** the event manager assigns or changes bidder number or table number, **Then** the new assignments are saved and visible on the guest record.
3. **Given** dinner options for the event, **When** the event manager selects a dinner option for a guest, **Then** the selection is saved and shown on the guest record.

---

### User Story 3 - Handle last-minute registration and ticket changes (Priority: P3)

Event managers can register a new donor or transfer tickets to another donor while checking people in.

**Why this priority**: Supports real-world event changes and keeps registrations accurate.

**Independent Test**: Can be fully tested by registering a new donor or transferring a ticket and verifying the new registration ownership and eligibility for check-in.

**Acceptance Scenarios**:

1. **Given** an unregistered attendee, **When** the event manager registers a new donor, **Then** a new registration is created and the donor can be checked in.
2. **Given** a ticket assigned to one donor, **When** the event manager transfers it to another donor, **Then** ownership updates and only the new donor is eligible to check in that ticket.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- Search returns multiple similar matches; user can disambiguate and select the correct guest.
- Search returns no matches; user is guided to register a new donor or refine the search.
- A guest has already been checked in on another device; the system prevents duplicate check-in and shows the prior time.
- A bidder or table number conflicts with an existing assignment; the system blocks the change and provides a clear error message.
- A check-in is reversed; the system records the reason and shows the updated status consistently across users.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST provide an event check-in page accessible to authorized event managers and administrators.
- **FR-002**: System MUST allow searching registered guests by name, phone number, or email.
- **FR-003**: System MUST display each matching guest’s registration details and current check-in status.
- **FR-004**: System MUST allow event managers to mark a guest as checked in and record the check-in time for the event.
- **FR-004a**: System MUST support check-in at the individual guest/ticket level (not only at the registration level).
- **FR-005**: System MUST prevent duplicate check-ins for the same guest and display the existing check-in time if already checked in.
- **FR-005a**: System MUST allow event managers to undo a check-in (check-out) with a required reason and audit log entry.
- **FR-006**: Event managers MUST be able to update donor contact information from the check-in page.
- **FR-007**: Event managers MUST be able to assign or change bidder number and table number during check-in.
- **FR-007a**: System MUST enforce bidder and table number uniqueness within the event when assigning or changing them.
- **FR-008**: Event managers MUST be able to set or change a guest’s dinner selection during check-in.
- **FR-009**: Event managers MUST be able to register a new donor and create a registration from the check-in page.
- **FR-010**: Event managers MUST be able to transfer a ticket to another donor during check-in.
- **FR-010a**: System MUST allow ticket transfers to be completed by event managers without additional verification.
- **FR-011**: System MUST provide a check-in dashboard showing total registered guests, total checked in, and a searchable list of checked-in guests for the event.
- **FR-012**: System MUST log all check-in actions and updates for audit purposes.

### Assumptions

- Dinner options are defined for each event before check-in begins.
- Bidder and table numbers must be unique within the event.
- Check-in capabilities are limited to users with event management permissions for the specific event.

### Key Entities *(include if feature involves data)*

- **Event**: The specific event being managed, including its roster of registrations and dinner options.
- **Guest Registration**: A record linking a donor or guest to an event, including ticket ownership and eligibility to check in.
- **Check-in Record**: A timestamped record of a guest’s check-in status for an event.
- **Donor**: The person attending or owning a ticket, with contact details used for lookup and updates.
- **Seating Assignment**: The bidder number and table number associated with a guest’s registration.
- **Dinner Selection**: The meal choice tied to a guest’s registration for the event.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Event managers can find and check in a registered guest in under 2 minutes for 95% of check-ins.
- **SC-002**: Search results appear within 3 seconds for 95% of queries during event peak hours.
- **SC-003**: At least 90% of event staff complete the primary check-in flow without assistance on first attempt.
- **SC-004**: The check-in dashboard reflects new check-ins within 1 minute of the action.
