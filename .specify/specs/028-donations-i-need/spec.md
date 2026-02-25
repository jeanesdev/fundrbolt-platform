# Feature Specification: Donation Tracking and Attribution

**Feature Branch**: `028-donations-i-need`
**Created**: 2026-02-25
**Status**: Draft
**Input**: User description: "donations I need database tables, schemas, classes, api crud routes and services for donations. A donation should have a user tied to it and an ammount. It should designate if the donation was part of a \"Paddle Raise\" event. This is where the auctioneer leads the donors at the event to raise their paddles at a designated time to indicate they want to donate at the annonced dollar ammount. There are other flags that I want to be able to assign to a donation, such as \"Last Hero\" or \"Coin Toss\". These help track the circumstances that lead to getting that donation and could be useful for future analytics. I want to be able to dynamically tag these donations with other labels in the future and query by the labels also. There could be multiple labels per donation."

## Clarifications

### Session 2026-02-25

- Q: How should donation deletion behave for analytics and audit integrity? → A: Soft delete by marking donation as void/inactive; keep historical record.
- Q: When filtering by multiple labels, what should the default matching behavior be? → A: Default to ALL selected labels, with an optional ANY toggle.
- Q: Should donation labels be global or event-specific? → A: Event-specific labels, and every donation must be linked to an event.
- Q: Can the same donor have multiple donations within the same event? → A: Yes, allow multiple donations per donor per event.
- Q: Which roles can manage donations and labels? → A: Admin/staff roles can create/update/void/manage labels; reporting roles are read-only.

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

### User Story 1 - Record a Donation With Donor and Amount (Priority: P1)

As an event/admin user, I can create, view, update, and void a donation record that is tied to a donor and includes a donation amount so that every gift can be accurately tracked and managed.

**Why this priority**: Core donation tracking is the foundational business need and enables all downstream reporting and analysis.

**Independent Test**: Can be fully tested by creating a donation linked to an existing donor, retrieving it, updating amount/details, and voiding it while verifying expected validation and data persistence behavior.

**Acceptance Scenarios**:

1. **Given** an authorized user and an existing donor profile, **When** the user submits a valid donation amount, **Then** the system stores a new donation record linked to that donor.
2. **Given** an existing donation record, **When** the user updates the amount, **Then** the system saves the new amount and returns the updated donation details.
3. **Given** an existing donation record, **When** the user requests deletion, **Then** the system marks the donation as void/inactive, removes it from standard active listings, and retains it for historical reporting.
4. **Given** a reporting role user, **When** they attempt to create or modify a donation, **Then** the system denies the write action and allows read-only access.

---

### User Story 2 - Attribute Donations to Fundraising Moments (Priority: P2)

As an event/admin user, I can mark whether a donation came from a paddle raise moment and assign predefined attribution labels (such as Last Hero or Coin Toss) so that fundraising outcomes can be analyzed by context.

**Why this priority**: Attribution data improves post-event analysis and helps optimize future fundraising strategy.

**Independent Test**: Can be fully tested by creating donations with and without paddle raise designation, assigning/removing predefined labels, and verifying attribution values in donation detail and list views.

**Acceptance Scenarios**:

1. **Given** a donation is being recorded, **When** the user marks it as a paddle raise donation, **Then** the donation is stored with paddle raise attribution.
2. **Given** a donation exists, **When** the user assigns one or more attribution labels (for example Last Hero, Coin Toss), **Then** those labels are associated with the donation and visible on retrieval.

---

### User Story 3 - Manage Event Labels and Query by Label (Priority: P3)

As an event/admin user, I can create and manage reusable donation labels for a specific event and filter/query that event's donations by one or more labels so that I can answer analytical questions without changing the system each time a new campaign concept is introduced.

**Why this priority**: Dynamic label management provides long-term flexibility for analytics and evolving fundraising tactics.

**Independent Test**: Can be fully tested by creating a new label, applying it to multiple donations, querying donations by that label, and confirming only matching donations are returned.

**Acceptance Scenarios**:

1. **Given** no matching label exists, **When** the user creates a new donation label, **Then** the label becomes available for assignment on donations.
2. **Given** donations have multiple labels, **When** the user filters donations by a selected label, **Then** the system returns only donations tagged with that label.

---

### Edge Cases
- Donation amount is zero or negative.
- Donation creation references a donor that does not exist.
- A label with the same name already exists (case-insensitive duplicate).
- A donation is assigned multiple labels and one label is later removed.
- A query requests donations by a label that does not exist.
- A donation is marked as paddle raise and also includes other labels.
- A deleted or inactive label remains attached to historical donations.
- A user attempts to assign a label from Event A to a donation in Event B.
- The same donor submits multiple donations during one event (for example, during multiple paddle raise moments).
- A reporting role attempts to create, update, void, or relabel a donation.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST allow authorized users to create, view, update, and void donation records.
- **FR-002**: Each donation MUST be linked to exactly one donor/user record.
- **FR-002A**: Each donation MUST be linked to exactly one event record.
- **FR-003**: Each donation MUST store a donation amount and reject invalid amounts (non-numeric, zero, or negative).
- **FR-004**: System MUST allow a donation to be designated as a paddle raise donation.
- **FR-005**: System MUST allow assigning zero, one, or many attribution labels to a donation.
- **FR-006**: System MUST provide built-in support for commonly used attribution labels, including Last Hero and Coin Toss.
- **FR-007**: System MUST allow authorized users to create, rename, activate/deactivate, and retire attribution labels for future use.
- **FR-007A**: Donation labels MUST be scoped to an event and managed independently per event.
- **FR-008**: System MUST preserve historical donation-label relationships even if a label is later retired.
- **FR-009**: System MUST provide donation retrieval and listing capabilities filtered by one label or multiple labels.
- **FR-010**: System MUST return donation details including donor association, amount, paddle raise designation, and assigned labels.
- **FR-011**: System MUST prevent duplicate label names that would be indistinguishable to users.
- **FR-012**: System MUST support querying donations where paddle raise designation and label filters are combined.
- **FR-013**: System MUST capture creation and update timestamps for donations and label assignments for auditability.
- **FR-014**: System MUST return clear validation errors when donation or label operations fail due to invalid input or missing records.
- **FR-015**: System MUST retain voided donations in historical records while excluding them from standard active donation listings.
- **FR-016**: When filtering by multiple labels, system MUST default to returning donations that match all selected labels and MUST provide an option to switch to any-label matching.
- **FR-017**: System MUST only allow assigning labels to donations when the label belongs to the same event as the donation.
- **FR-018**: System MUST allow multiple donation records for the same donor within the same event and MUST NOT enforce a one-donation-per-donor-per-event uniqueness rule.
- **FR-019**: System MUST allow only authorized admin/staff roles to create, update, void donations, and manage donation labels.
- **FR-020**: System MUST allow reporting roles to view donations and donation labels but MUST prevent them from performing write operations.

### Assumptions

- Donation management is performed by authenticated internal users with existing permissions to manage event financial records.
- Role definitions for admin/staff and reporting users are already available in the platform authorization model.
- Donations belong to existing donor/user records already managed by the platform.
- Events already exist and are managed by the platform, and each donation is recorded within one event context.
- The initial scope covers single-donation records and does not include recurring pledge schedules.
- Paddle raise is treated as a boolean donation attribute, while other fundraising circumstances are represented as labels.
- Analytics consumers will use donation query/filter capabilities as the source for future reporting workflows.

### Key Entities *(include if feature involves data)*

- **Donation**: A monetary contribution record with donor/user reference, event reference, amount, paddle raise designation, lifecycle timestamps, and associated attribution labels.
- **Donation Label**: A reusable attribution category (for example Last Hero, Coin Toss, future custom labels) scoped to a single event and assignable to many donations within that event.
- **Donation Label Assignment**: The relationship entity connecting donations and labels, enabling many-to-many tagging and historical attribution tracking.
- **Donor/User**: Existing person/account entity that owns one or more donation records.
- **Event**: Existing fundraising event entity that contains donations and event-specific donation labels.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of donation records are created with complete required fields (donor and amount) on first submission without user correction.
- **SC-002**: Authorized users can complete donation creation (including optional paddle raise and labels) in under 45 seconds for typical event workflows.
- **SC-003**: Users can retrieve filtered donation lists by selected labels with relevant results returned in under 3 seconds for standard event data volumes.
- **SC-004**: At least 90% of donation records entered during an event are attributed with either paddle raise designation, one or more labels, or both.
- **SC-005**: Post-event teams can answer at least 3 common attribution questions (for example, totals by paddle raise, Last Hero totals, Coin Toss totals) without manual spreadsheet recoding.
