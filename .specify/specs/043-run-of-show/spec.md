# Feature Specification: Run-of-Show Management

**Feature Branch**: `043-run-of-show`
**Created**: 2026-05-03
**Status**: Draft
**Input**: User description: "run-of-show — I need to be able to set up a schedule for the run-of-show for an event from the admin pwa. This should operate similarly to the event checklist, but it should have a time and a checkmark to show if it should be visible to the donors and/or auctioneer. Auctioneer should see everything by default. I want to be able to save the list as a template per NPO. Create a default template based off your best guess of what events would be included in a 3 hour show. I'll adjust manually. I want a card on the Donor PWA Event page that is collapsed by default. It should show only the timeline of the events the donor should see. I want a card on the auctioneer dashboard that shows the run of show. I want a card on the auctioneer header that shows the time to the next event. Clicking that should take them to the run of show page. I want a card on the Event Dashboard that shows the run of show and a card with the time until next event. I want to be able to pre-set a custom notification to go out at any of the run-of-show times."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin Creates and Manages Run-of-Show (Priority: P1)

An event coordinator uses the Admin PWA to build a run-of-show schedule for their event. They add items with scheduled times, titles, and control which audiences (donors, auctioneer) can see each item. During the event, items can be marked as complete as the program progresses.

**Why this priority**: Core feature — without a run-of-show editor, none of the audience-facing views can function.

**Independent Test**: Create a run-of-show with 3+ items, toggle donor visibility on one and off on another, save, and verify items appear in chronological order with the correct visibility states persisted.

**Acceptance Scenarios**:

1. **Given** an event exists in the admin PWA, **When** a coordinator navigates to the run-of-show section (consistent with the event checklist tab pattern), **Then** they see a list of timed items (initially empty or pre-populated from a template) with controls to add, edit, reorder, and delete items
2. **Given** a run-of-show item form, **When** the coordinator enters a title and scheduled time, **Then** the item is saved and displayed in chronological order in the list
3. **Given** a run-of-show item, **When** the coordinator disables the donor-visibility toggle, **Then** that item is excluded from the donor-facing timeline but remains visible to the auctioneer and admin
4. **Given** a run-of-show item, **When** the coordinator disables the auctioneer-visibility toggle, **Then** that item is hidden from the auctioneer view but remains visible to the admin
5. **Given** a live event in progress, **When** an admin or auctioneer marks an item as complete, **Then** the item displays a completed state and the system treats the next uncompleted future item as the "next up"

---

### User Story 2 — NPO Saves and Applies Run-of-Show Templates (Priority: P2)

An NPO admin saves their run-of-show as a reusable template. When setting up future events, they apply the template to pre-populate the schedule with items relative to the event's start time, then adjust as needed.

**Why this priority**: Templates reduce repetitive setup for NPOs that run similar events each year, and the built-in default template gives new NPOs an instant starting point.

**Independent Test**: Save an event's run-of-show as a named template, create a new event, apply the template, and verify all items appear with times calculated from the new event's start time.

**Acceptance Scenarios**:

1. **Given** a configured run-of-show for an event, **When** the coordinator clicks "Save as Template", **Then** they are prompted to name the template and it is saved under their NPO for future use
2. **Given** saved templates exist for an NPO, **When** a coordinator opens a new event's run-of-show and selects "Apply Template", **Then** all template items populate the schedule with times offset from the event's start time
3. **Given** a template is applied to an event, **When** the coordinator edits items in that event, **Then** only the event's run-of-show is affected — the saved template remains unchanged
4. **Given** an NPO with no saved templates, **When** the coordinator views template options, **Then** a built-in default "3-Hour Gala" template is available to apply

---

### User Story 3 — Donor Views Event Timeline (Priority: P3)

A donor on the event home page sees a collapsed timeline card showing the scheduled program — limited to only the items marked donor-visible.

**Why this priority**: Improves donor experience; knowing what to expect keeps them engaged throughout the event.

**Independent Test**: Configure at least one donor-visible run-of-show item on an event, open the donor PWA event page, and verify the collapsed timeline card is present and expands to show the correct items.

**Acceptance Scenarios**:

1. **Given** an event with at least one donor-visible run-of-show item, **When** a donor views the event home page, **Then** a collapsed timeline card appears showing a preview of the event program
2. **Given** the collapsed timeline card, **When** the donor taps to expand it, **Then** they see a chronological list of donor-visible items with their scheduled times
3. **Given** items with mixed visibility settings, **When** the donor views the timeline, **Then** only items with donor visibility enabled are shown
4. **Given** a run-of-show item is marked complete, **When** the donor views the timeline, **Then** past/completed items appear visually distinct (e.g., dimmed or struck through) from upcoming items
5. **Given** no donor-visible run-of-show items exist for the event, **When** a donor views the event page, **Then** the timeline card is hidden entirely

---

### User Story 4 — Auctioneer Views Run-of-Show and Countdown (Priority: P4)

The auctioneer sees a full run-of-show card on their dashboard showing all items. A persistent element in their header shows a live countdown to the next scheduled item — clicking it navigates to the run-of-show view.

**Why this priority**: Auctioneers need constant, real-time awareness of program timing to keep the event on schedule without relying on paper printouts.

**Independent Test**: Configure a run-of-show with future-scheduled items, log in as an auctioneer, and verify both the countdown in the header and the full run-of-show dashboard card display correctly and update in real time.

**Acceptance Scenarios**:

1. **Given** an event with a run-of-show, **When** the auctioneer views their dashboard, **Then** a run-of-show card displays all items for the event with their scheduled times and completion status
2. **Given** one or more uncompleted future run-of-show items, **When** the auctioneer is on any page in their interface, **Then** the header displays a live countdown to the next upcoming uncompleted item, including the item's title
3. **Given** the countdown element in the header, **When** the auctioneer clicks it, **Then** they are taken to the run-of-show page or scrolled to the run-of-show card
4. **Given** the next item's scheduled time passes or the item is marked complete, **When** more uncompleted items remain, **Then** the header countdown automatically advances to the following next item
5. **Given** all run-of-show items are completed or all are in the past, **When** the auctioneer views the header, **Then** the countdown element is hidden or shows "Program Complete"

---

### User Story 5 — Event Dashboard Shows Run-of-Show Summary (Priority: P5)

The Event Dashboard (admin) displays a run-of-show summary card alongside a "time until next item" countdown card, giving coordinators a live overview without navigating away from the dashboard.

**Why this priority**: Coordinators managing the event need at-a-glance program status alongside other event metrics.

**Independent Test**: Configure a run-of-show with future items, open the event dashboard, and verify both the summary card and countdown card appear with accurate data.

**Acceptance Scenarios**:

1. **Given** an event with a run-of-show configured, **When** a coordinator views the event dashboard, **Then** a run-of-show summary card lists all items with their scheduled times and completion states
2. **Given** uncompleted future items in the run-of-show, **When** the coordinator views the event dashboard, **Then** a "Time Until Next Item" card displays a live countdown to the next upcoming item
3. **Given** an item is marked complete on the run-of-show page, **When** the coordinator returns to the event dashboard, **Then** the dashboard cards reflect the updated state

---

### User Story 6 — Pre-Set Notifications for Run-of-Show Items (Priority: P6)

An admin attaches a custom notification message to a run-of-show item. That notification is automatically dispatched to the chosen audience at the item's scheduled time.

**Why this priority**: Automation reduces manual work during live events and ensures timely donor communication tied to the program flow.

**Independent Test**: Attach a notification to a run-of-show item, simulate or wait for the scheduled time, and verify the notification is delivered to the configured recipients.

**Acceptance Scenarios**:

1. **Given** a run-of-show item, **When** an admin enables the notification option on that item, **Then** they can compose a custom message and choose recipients (donors, auctioneer, all attendees)
2. **Given** a run-of-show item with a pre-set notification, **When** the item's scheduled time is reached, **Then** the notification is automatically sent to the configured recipients
3. **Given** a run-of-show item has a notification configured, **When** the admin views the run-of-show editor, **Then** that item displays a visual indicator (e.g., bell icon) to signal a notification is scheduled
4. **Given** a notification is configured on an item, **When** the admin removes the notification before the scheduled time, **Then** the notification is cancelled and will not be sent
5. **Given** a run-of-show item is marked complete before its scheduled time, **When** the scheduled time arrives, **Then** the notification is still delivered unless the admin explicitly cancelled it

---

### Edge Cases

- What happens to items with scheduled times if the event's start time is changed after the run-of-show is built?
- How does the system handle two items scheduled at the same time?
- What happens to pending notifications when an event is cancelled or archived? → Resolved: All pending run-of-show notifications are automatically cancelled when the event is cancelled or archived
- How does the countdown behave when all items are either completed or in the past?
- What does the donor timeline card show if no run-of-show has been configured at all for the event?
- How does the template time-offset calculation behave if an event has no start time set yet? → Resolved: Template application is blocked; coordinator is prompted to set a start time before proceeding

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow admins to create, edit, reorder, and delete run-of-show items for any event
- **FR-002**: Each run-of-show item MUST include: a title, a scheduled time, a donor-visibility flag, an auctioneer-visibility flag, a completion status, and an optional description
- **FR-003**: Auctioneer visibility MUST default to enabled for all new items; donor visibility MUST default to disabled for new items
- **FR-004**: Admins and auctioneers MUST be able to mark individual run-of-show items as complete during an event
- **FR-005**: The system MUST support saving a run-of-show configuration as a named template scoped to an NPO
- **FR-006**: Each NPO MUST be able to store multiple named templates; templates persist across events
- **FR-007**: The system MUST include a built-in default template representing a typical 3-hour fundraising gala, pre-configured with donor and auctioneer visibility settings
- **FR-008**: The default 3-hour gala template MUST contain at least the following program items (with relative time offsets from event start):
  - Doors Open (+0 min, donor visible)
  - Welcome Reception / Cocktail Hour (+15 min, donor visible)
  - Guests Take Seats (+60 min, donor visible)
  - Opening Remarks (+70 min, donor visible)
  - Sponsor Recognition (+80 min, donor visible)
  - Dinner Service Begins (+90 min, donor visible)
  - Silent Auction Closes (+95 min, auctioneer only)
  - Live Auction Begins (+100 min, donor visible)
  - Fund-a-Need / Paddle Raise (+120 min, donor visible)
  - Live Auction Closes (+150 min, auctioneer only)
  - Award Presentation / Mission Moment (+155 min, donor visible)
  - Closing Remarks (+165 min, donor visible)
  - Checkout Opens (+170 min, donor visible)
  - Event Concludes (+180 min, donor visible)
- **FR-009**: When applying a template to an event, items MUST have their times calculated as offsets from the event's confirmed start time; if the event already has run-of-show items, the system MUST present a confirmation prompt before replacing them — applying the template replaces the existing list entirely; if the event has no start time set, the system MUST block template application and direct the coordinator to set a start time first
- **FR-010**: The Donor PWA event home page MUST display a timeline card that is collapsed by default, showing only donor-visible run-of-show items; the card is visible as soon as the event is published (pre-event and during the event)
- **FR-011**: The donor timeline card MUST be hidden entirely when the event has no donor-visible run-of-show items
- **FR-012**: Completed run-of-show items MUST appear visually distinct from upcoming items in all audience-facing views
- **FR-013**: The auctioneer dashboard MUST include a run-of-show card displaying all items for the current event
- **FR-014**: The auctioneer interface MUST display a persistent header element showing a live countdown to the next uncompleted, future-scheduled run-of-show item along with that item's title
- **FR-015**: Clicking the auctioneer header countdown MUST navigate to the run-of-show view
- **FR-016**: The auctioneer countdown MUST automatically advance to the next item when the current next item is completed or its time has passed
- **FR-017**: The Event Dashboard MUST include a run-of-show summary card showing all items with their times and completion states
- **FR-018**: The Event Dashboard MUST include a "Time Until Next Item" card displaying a live countdown to the next uncompleted future item
- **FR-019**: The system MUST allow admins to attach a custom notification message to any run-of-show item, with configurable recipient selection (checked-in donors, auctioneer, or all checked-in attendees); run-of-show notifications to donors are delivered only to donors who are checked in to the event at the time of delivery
- **FR-020**: Notifications attached to run-of-show items MUST be sent automatically at the item's scheduled time; if delivery fails, the system MUST retry using a standard retry policy (at least 2 retries within a 2-minute window)
- **FR-021**: Run-of-show items with a pending notification MUST be visually indicated in the admin run-of-show editor (e.g., bell icon); items whose notification delivery ultimately failed after all retries MUST show a distinct failure indicator
- **FR-022**: Admins MUST be able to cancel a pre-set notification at any time before it is delivered
- **FR-023**: When an event is cancelled or archived, the system MUST automatically cancel all pending run-of-show notifications for that event
- **FR-024**: The run-of-show editor in the Admin PWA MUST follow the same page/tab navigation pattern as the existing event checklist feature

### Key Entities

- **RunOfShowItem**: A scheduled program item for a specific event; attributes include title, optional description, absolute scheduled time, donor-visibility flag, auctioneer-visibility flag, completion status, and an optional linked notification
- **RunOfShowTemplate**: A reusable run-of-show structure scoped to an NPO; includes a name, creation date, and an ordered list of template items
- **RunOfShowTemplateItem**: One line of a template; attributes include title, optional description, relative time offset in minutes from event start, default donor-visibility, and default auctioneer-visibility
- **ScheduledRunOfShowNotification**: A pending notification linked to a specific run-of-show item; includes message body, recipient type (checked-in donors / auctioneer / all checked-in attendees), scheduled delivery time, and delivery status

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A coordinator can build a complete run-of-show from scratch (10+ items) in under 5 minutes
- **SC-002**: Applying a saved template to a new event and adjusting 2–3 items takes under 2 minutes
- **SC-003**: The donor timeline card on the event page loads and expands within 1 second of the donor's tap
- **SC-004**: The auctioneer countdown refreshes at least once per minute without requiring a page reload
- **SC-005**: Scheduled run-of-show notifications are delivered within 60 seconds of the configured item time
- **SC-006**: Changes to item completion status or visibility are reflected across all active views (donor timeline, auctioneer dashboard, event dashboard) within 30 seconds
- **SC-007**: The event dashboard countdown accurately reflects the time to the next upcoming item at all times during the event

---

## Clarifications

### Session 2026-05-03

- Q: When a template is applied to an event that already has run-of-show items, should it replace or merge? → A: Replace all existing items after a confirmation prompt
- Q: When should the donor timeline card become visible relative to the event? → A: Always visible once the event is published (pre-event and during)
- Q: If an admin tries to apply a template to an event with no start time set, what should happen? → A: Block the action and prompt the coordinator to set the event start time first
- Q: If a scheduled run-of-show notification fails to deliver, how should the system respond? → A: Retry automatically with standard retry policy; show a failure indicator on the item in the admin run-of-show editor
- Q: When an event is cancelled or archived, what should happen to pending run-of-show notifications? → A: Automatically cancel all pending run-of-show notifications immediately
- Q: Who receives run-of-show notifications sent to "donors"? → A: Only donors who are checked in to the event at the time of delivery

---

## Assumptions

1. Run-of-show items for a specific event are stored as absolute wall-clock times; templates store relative minute-offsets from event start that are converted to absolute times when applied
2. Admin users always see all run-of-show items regardless of visibility flags — visibility flags control only donor and auctioneer views
3. The existing notification infrastructure (feature 035) is the delivery mechanism for run-of-show notifications; this feature adds scheduling and linkage, not a new delivery channel
4. Items are reordered manually (drag-and-drop or up/down controls); the list is not auto-sorted by time — coordinators may want to group or annotate items in non-chronological display order
5. "Next item" in all countdowns refers to the earliest uncompleted item whose scheduled time is in the future
6. Marking an item complete before its scheduled time does not cancel any attached notification — notifications fire at their scheduled time unless explicitly removed
7. The auctioneer countdown is displayed only when a run-of-show exists for the active event in the auctioneer's session
8. The built-in default template is a system-level template available to all NPOs; it cannot be edited globally but can be applied to an event and then modified, or saved as a custom NPO template after adjustment
