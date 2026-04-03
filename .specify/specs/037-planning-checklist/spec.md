# Feature Specification: Event Planning Checklist

**Feature Branch**: `037-planning-checklist`
**Created**: 2026-04-03
**Status**: Draft
**Input**: User description: "Add the ability on the admin PWA to create a checklist of things that need to be accomplished as part of the event campaign with due dates and status for each. The checklist should be featured prominently on the event home page. Save the list as a template at the organization level. Create a default template. Add/delete items, track status changes (not-complete, in progress, complete)."

## Clarifications

### Session 2026-04-03

- Q: Should the checklist be a persistent panel above the tab navigation, a dedicated tab (default landing), or a collapsible panel? → A: Persistent panel above tabs — always visible regardless of which tab/section is active.
- Q: Should the checklist be editable on Closed events (given post-event tasks exist)? → A: Fully editable — checklist remains fully editable regardless of event status.
- Q: When applying a template to an event with existing items, what conflict resolution? → A: Replace or Append — user chooses to replace all existing items or append template items after existing ones (no deduplication).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View and Manage Event Planning Checklist (Priority: P1)

As an event coordinator, I need to see a prominent checklist of planning tasks on my event's home page so I can track what still needs to be done and stay organized throughout the campaign.

When I navigate to an event's edit page, I see a planning checklist section featured prominently at the top of the event home/details view. Each checklist item shows its title, due date, and current status. I can change an item's status by clicking on it, progressing it from "Not Complete" to "In Progress" to "Complete." Completed items are visually distinguished (e.g., struck through or dimmed) so I can quickly scan what remains.

**Why this priority**: This is the core value of the feature — giving coordinators immediate visibility into their event's readiness. Without the checklist display and status tracking, no other functionality matters.

**Independent Test**: Can be fully tested by creating an event, viewing the checklist on the event home page, and toggling item statuses. Delivers immediate planning visibility value.

**Acceptance Scenarios**:

1. **Given** an event exists with a planning checklist, **When** I navigate to the event's edit page, **Then** I see the planning checklist displayed prominently near the top of the page showing all items with their titles, due dates, and statuses.
2. **Given** a checklist item has status "Not Complete," **When** I click to advance its status, **Then** it changes to "In Progress" and the change is saved immediately.
3. **Given** a checklist item has status "In Progress," **When** I click to advance its status, **Then** it changes to "Complete," the item is visually distinguished as done, and a completion timestamp is recorded.
4. **Given** a checklist item has status "Complete," **When** I click to regress its status, **Then** it changes back to "In Progress" (allowing corrections).
5. **Given** a checklist with mixed statuses, **When** I view the checklist, **Then** I see a progress summary (e.g., "5 of 12 tasks complete") so I can gauge overall readiness at a glance.

---

### User Story 2 - Add, Edit, and Delete Checklist Items (Priority: P1)

As an event coordinator, I need to customize the planning checklist for my specific event by adding new tasks, editing existing ones, and removing tasks that don't apply so the checklist reflects my actual planning needs.

**Why this priority**: Every event is different. Coordinators must be able to tailor the checklist to their event's unique requirements for the feature to be useful.

**Independent Test**: Can be tested by opening an event's checklist, adding a new item with a title and due date, editing an existing item's title or due date, and deleting an item. Each operation persists after page refresh.

**Acceptance Scenarios**:

1. **Given** I am viewing an event's planning checklist, **When** I click "Add Item," **Then** I can enter a title and an optional due date, and the new item appears in the checklist with status "Not Complete."
2. **Given** a checklist item exists, **When** I click to edit it, **Then** I can modify its title and due date, and the changes are saved.
3. **Given** a checklist item exists, **When** I click to delete it, **Then** I am asked to confirm, and upon confirmation the item is removed from the checklist.
4. **Given** I add multiple items, **When** I view the checklist, **Then** items are displayed in a logical order (by due date, then by creation order for items without due dates).
5. **Given** a checklist item has a due date that has passed and the item is not complete, **When** I view the checklist, **Then** the item is visually flagged as overdue.

---

### User Story 3 - Automatic Checklist from Default Template on Event Creation (Priority: P2)

As an event coordinator, I want new events to automatically start with a pre-populated planning checklist based on a default template so I don't have to build the checklist from scratch every time.

When I create a new event, the system automatically populates the event's planning checklist using the organization's default template (or the system-provided default template if the organization hasn't customized one). The template items are copied into the event's checklist with relative due dates calculated from the event date.

**Why this priority**: This dramatically reduces setup time and ensures coordinators don't forget critical planning steps. However, it depends on the template system (US4) and the core checklist (US1/US2) being in place.

**Independent Test**: Can be tested by creating a new event and verifying that the checklist is pre-populated with the default template items, with due dates calculated relative to the event date.

**Acceptance Scenarios**:

1. **Given** an organization has a default checklist template, **When** I create a new event for that organization, **Then** the event's planning checklist is pre-populated with items from the default template.
2. **Given** template items have relative due dates (e.g., "8 weeks before event"), **When** the checklist is populated for an event with a specific date, **Then** the due dates are calculated as concrete dates relative to the event date.
3. **Given** an organization has no custom default template, **When** I create a new event, **Then** the system-provided default template is used to populate the checklist.
4. **Given** a checklist was auto-populated from a template, **When** I view the event's checklist, **Then** I can still add, edit, and delete items freely — the template is a starting point, not a constraint.

---

### User Story 4 - Save and Manage Checklist Templates at Organization Level (Priority: P2)

As an organization administrator, I want to save a checklist as a reusable template at the organization level and manage multiple templates so that my team can quickly set up checklists for different types of events.

**Why this priority**: Templates enable repeatability and organizational learning. As teams run more events, they refine their process and capture it in templates. This is high value but depends on the core checklist (US1/US2).

**Independent Test**: Can be tested by navigating to an event's checklist, clicking "Save as Template," naming it, and then verifying it appears in the organization's template library. Also tested by applying a template to a different event.

**Acceptance Scenarios**:

1. **Given** I am viewing an event's planning checklist, **When** I click "Save as Template," **Then** I can provide a name and the current checklist items (with their titles and relative due dates) are saved as a reusable template under my organization.
2. **Given** templates exist for my organization, **When** I view the template library (accessible from event checklist settings or organization settings), **Then** I see all saved templates with their names and item counts.
3. **Given** I am viewing the template library, **When** I select a template, **Then** I can view its items, edit them, rename the template, or delete the template.
4. **Given** I have multiple templates, **When** I designate one as the "default," **Then** that template is used automatically when new events are created for this organization.
5. **Given** I am setting up an event's checklist, **When** I choose "Apply Template" and the event already has items, **Then** I am asked whether to "Replace" (clear existing and use template) or "Append" (add template items after existing ones), and the chosen action is applied.

---

### User Story 5 - Reorder Checklist Items (Priority: P3)

As an event coordinator, I want to reorder checklist items by dragging them so I can arrange them in the sequence that makes sense for my planning workflow.

**Why this priority**: Ordering improves usability but isn't essential for basic tracking. The default ordering by due date covers most needs.

**Independent Test**: Can be tested by dragging a checklist item to a new position and verifying the new order persists.

**Acceptance Scenarios**:

1. **Given** a checklist with multiple items, **When** I drag an item to a new position, **Then** the item moves to that position and the reordering is saved.
2. **Given** I have reordered items, **When** I refresh the page, **Then** the custom order is preserved.

---

### Edge Cases

- What happens when an event's date is changed after checklist items have calculated due dates? Due dates that were derived from the event date are recalculated; due dates that were manually set remain unchanged.
- What happens when a template is deleted that was the default? The organization reverts to the system-provided default template for new events.
- What happens when an event has no checklist items (all deleted)? The checklist section shows an empty state with a prompt to add items or apply a template.
- What happens when a checklist item's due date is set to today? It is not flagged as overdue; only items with due dates strictly in the past are flagged.
- What happens when two coordinators edit the same checklist simultaneously? The most recent change wins (last-write-wins) and the UI refreshes to show the current state. No data is lost because changes are at the individual item level.
- What happens when an event is closed while post-event checklist items are still incomplete? The checklist remains fully editable so coordinators can continue tracking post-event tasks (thank-you messages, receipts, debrief).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display a planning checklist as a persistent panel above the tab navigation on the event edit page, visible regardless of which tab/section is active below it.
- **FR-002**: Each checklist item MUST have a title (required, max 200 characters), a due date (optional), and a status (Not Complete, In Progress, or Complete).
- **FR-003**: Users MUST be able to change an item's status in a single interaction (e.g., click/tap) with forward and backward transitions: Not Complete ↔ In Progress ↔ Complete.
- **FR-004**: The system MUST record a timestamp when an item transitions to "Complete" status.
- **FR-005**: The system MUST display a progress summary showing the ratio of completed items to total items (e.g., "5 of 12 complete").
- **FR-006**: Users MUST be able to add new checklist items with a title and optional due date.
- **FR-007**: Users MUST be able to edit any checklist item's title and due date.
- **FR-008**: Users MUST be able to delete checklist items with a confirmation prompt.
- **FR-009**: Checklist items with due dates in the past that are not in "Complete" status MUST be visually flagged as overdue.
- **FR-010**: The system MUST automatically populate a new event's checklist from the organization's default template (or the system default template if none is set).
- **FR-011**: Template due dates MUST be stored as relative offsets (e.g., "56 days before event") and converted to concrete dates based on the event's date when applied.
- **FR-012**: When an event's date changes, template-derived due dates MUST be recalculated; manually set due dates MUST remain unchanged.
- **FR-013**: Users MUST be able to save an event's current checklist as a named template at the organization level.
- **FR-014**: Users MUST be able to view, edit, rename, and delete templates from a template library within the organization.
- **FR-015**: Users MUST be able to designate one template as the organization's default for new events.
- **FR-016**: Users MUST be able to apply a template to an existing event. When items already exist, the user MUST be presented with a choice to either "Replace" (delete all existing items and populate from template) or "Append" (add template items after existing items without deduplication).
- **FR-017**: Users MUST be able to reorder checklist items via drag-and-drop, with the custom order persisted.
- **FR-018**: The system MUST provide a built-in default template with common event planning tasks relevant to fundraising galas (see Default Template section).
- **FR-019**: Only users with NPO Admin or NPO Staff (or higher) roles for the event's organization MUST be able to manage checklist items and templates.
- **FR-020**: The system MUST sort checklist items by: custom order (if set by drag), then by due date (earliest first), then by creation date.
- **FR-021**: The planning checklist MUST remain fully editable (status changes, add, edit, delete, reorder) regardless of event status (Draft, Active, or Closed).

### Default Template

The system-provided default template MUST include the following items (titles and relative due dates). This serves as the starting point for all new events and organizations:

| #  | Task Title                                              | Relative Due Date        |
|----|--------------------------------------------------------|--------------------------|
| 1  | Define event goals and fundraising target               | 12 weeks before event    |
| 2  | Set event budget                                        | 12 weeks before event    |
| 3  | Book venue                                              | 10 weeks before event    |
| 4  | Secure title sponsor                                    | 10 weeks before event    |
| 5  | Create event branding (logo, colors, theme)             | 9 weeks before event     |
| 6  | Set up event in FundrBolt (details, venue, branding)    | 9 weeks before event     |
| 7  | Configure ticket packages and pricing                   | 8 weeks before event     |
| 8  | Recruit additional sponsors                             | 8 weeks before event     |
| 9  | Source and catalog auction items                        | 7 weeks before event     |
| 10 | Open ticket sales                                       | 6 weeks before event     |
| 11 | Send save-the-date communications                       | 6 weeks before event     |
| 12 | Finalize catering and meal options                      | 5 weeks before event     |
| 13 | Upload auction item photos and descriptions             | 4 weeks before event     |
| 14 | Publish event (make visible to donors)                  | 4 weeks before event     |
| 15 | Send formal invitations                                 | 4 weeks before event     |
| 16 | Arrange entertainment and speakers                      | 3 weeks before event     |
| 17 | Create seating chart and assign tables                  | 2 weeks before event     |
| 18 | Send reminder to registered guests                      | 1 week before event      |
| 19 | Confirm vendor deliveries and AV setup                  | 3 days before event      |
| 20 | Print bidder paddles and table cards                    | 3 days before event      |
| 21 | Conduct event rehearsal / walkthrough                   | 1 day before event       |
| 22 | Day-of: Set up check-in stations                        | Day of event             |
| 23 | Day-of: Brief volunteers and staff                      | Day of event             |
| 24 | Post-event: Send thank-you messages to donors           | 3 days after event       |
| 25 | Post-event: Send payment receipts and tax letters       | 1 week after event       |
| 26 | Post-event: Conduct debrief and capture lessons learned | 2 weeks after event      |

### Key Entities

- **Checklist Item**: A single planning task associated with an event. Attributes: title, due date, status (not_complete / in_progress / complete), display order, completion timestamp, whether the due date was template-derived or manually set. Belongs to exactly one Event.
- **Checklist Template**: A reusable collection of task definitions saved at the organization (NPO) level. Attributes: name, is_default flag, item count. Belongs to exactly one NPO.
- **Checklist Template Item**: A task definition within a template. Attributes: title, relative due date offset (in days, can be negative for post-event tasks), display order. Belongs to exactly one Checklist Template.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Event coordinators can view their full planning checklist and update any item's status within 2 seconds of page load.
- **SC-002**: New events are automatically populated with a default planning checklist upon creation, requiring zero manual setup to start tracking.
- **SC-003**: Coordinators can add a new checklist item (title + due date) in under 15 seconds.
- **SC-004**: Overdue items are immediately identifiable through visual indicators without requiring coordinators to mentally compare dates.
- **SC-005**: An organization can save a checklist as a template and apply that template to a different event in under 30 seconds total.
- **SC-006**: The planning checklist is the first thing coordinators see when managing an event, reinforcing it as the central planning tool.
- **SC-007**: 100% of status changes (Not Complete → In Progress → Complete and reverse) are persisted immediately and reflected across all active sessions viewing the same event.

## Assumptions

- The planning checklist is specific to the Admin PWA and is not displayed in the Donor PWA.
- "Prominently featured on the event home page" means the checklist is rendered as a persistent panel above the tab navigation on the event edit page. It remains visible as the user switches between tabs (Details, Sponsors, Tickets, etc.) and is not itself a tab.
- The system-provided default template is the same for all organizations and is not editable by users; organizations customize by creating their own templates.
- Relative due date offsets are measured in days. Negative offsets represent tasks that occur before the event date (e.g., -84 = 12 weeks before event). Positive offsets represent tasks that occur after the event date (e.g., +14 = 2 weeks post-event).
- When applying a template to an event that already has checklist items, the user is given the choice to "Replace" (delete all existing items) or "Append" (add template items after existing ones). No deduplication or smart merging is performed.
- Checklist items do not have assignments to specific team members in this version. This could be a future enhancement.
- Checklist items do not have descriptions or notes in this version — just title, due date, and status. This keeps the feature simple and focused.
