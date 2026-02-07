# Feature Specification: Import Auction Bids

**Feature Branch**: `023-import-auction-bids`
**Created**: 2026-02-07
**Status**: Draft
**Input**: User description: "import-auction-bids: I need to be able to import auction bids from a json file, excel workbook, or CSV file. include an example of what the JSON and CSV should look like. Add a page on the PWA app that shows a dashboard with information about auction bids for this event. Add a button for importing from a file. It should first fo a preflight check, just like whats defined in the "import ticket sales" and "import registration" speckit documentation. if the preflight check is successful it should allow user to confirm and actually create the records. The preflight check should confirm that each bid is for a valid donor and auction item that is defined for the event, and it gollows the rules for a bid (for example, its higher than the current bid + minimal bid interval). It should also include the time the bod was made. We will use this feature for testing and setting up demo environments primarily."

## Clarifications

### Session 2026-02-07

- Q: What donor identifier should the import use? → A: Email
- Q: What auction item identifier should the import use? → A: Item code/number
- Q: Should imports allow partial success? → A: Block import if any row invalid
- Q: How should bid timestamps be validated? → A: Accept any timestamp as-is
- Q: How should duplicate rows be handled? → A: Treat exact duplicates as errors

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

### User Story 1 - Preflight validation for bid imports (Priority: P1)

Event staff can upload a bid file and receive a preflight validation summary before any bids are created.

**Why this priority**: Prevents invalid bids and ensures data integrity before any changes are made.

**Independent Test**: Upload a file containing both valid and invalid bids and verify the preflight summary and error list appear without creating any bids.

**Acceptance Scenarios**:

1. **Given** an event with donors, items, and a configured minimum bid increment, **When** a staff member uploads a valid file, **Then** the preflight summary shows all bids valid and enables the confirmation action.
2. **Given** a file containing bids for unknown donors or items, **When** preflight is run, **Then** the system lists each invalid row with a clear reason and blocks confirmation.

---

### User Story 2 - Confirm and create bids (Priority: P2)

After a successful preflight, event staff can confirm the import to create all bids in the file.

**Why this priority**: Enables fast setup of demo and test environments once data is verified.

**Independent Test**: Run preflight on a valid file, confirm import, and verify all bids are created and visible in the dashboard.

**Acceptance Scenarios**:

1. **Given** a successful preflight, **When** the staff member confirms the import, **Then** all bids are created and a completion summary is shown.
2. **Given** a preflight that passed but the file is altered before confirmation, **When** the staff member attempts to confirm, **Then** the system requires a new preflight before creating bids.

---

### User Story 3 - View auction bids dashboard (Priority: P3)

Event staff can view a dashboard that summarizes auction bids for the current event and access the import action.

**Why this priority**: Provides immediate visibility into bid activity and a clear entry point for importing bids.

**Independent Test**: Open the dashboard for an event with bids and verify key metrics and the import button are present.

**Acceptance Scenarios**:

1. **Given** an event with existing bids, **When** the staff member opens the dashboard, **Then** the system displays totals, highest bids per item, and recent bid activity.
2. **Given** an event with no bids, **When** the staff member opens the dashboard, **Then** the system shows an empty-state message and the import button.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- File contains duplicate bids with the same donor, item, amount, and time.
- Bid timestamps are out of order.
- Bid amount is equal to or below the current bid plus the minimum increment.
- File exceeds the maximum allowed row count or size for a single import.
- Donor or item exists but is not associated with the selected event.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST provide an auction bids dashboard for a selected event within the PWA.
- **FR-002**: Dashboard MUST display total bid count, total bid value, highest bid per item, and a list of the most recent bids.
- **FR-003**: Dashboard MUST include a clear action to start a bid import.
- **FR-004**: System MUST accept bid import files in JSON, CSV, and Excel workbook formats.
- **FR-005**: System MUST run a preflight validation that does not create any bids.
- **FR-006**: Preflight validation MUST verify each bid references a valid donor by email and a valid auction item by item code/number for the selected event.
- **FR-007**: Preflight validation MUST verify each bid meets auction rules, including that the amount is higher than the current highest bid plus the minimum bid increment.
- **FR-008**: Preflight validation MUST verify each bid includes a bid time and that the time is a valid date-time value, without rejecting future times.
- **FR-009**: Preflight validation MUST return a summary that includes total rows, valid rows, invalid rows, and per-row error reasons.
- **FR-010**: System MUST allow confirmation only after a successful preflight and MUST block confirmation when any invalid rows exist.
- **FR-011**: When confirmed, system MUST create all bids from the preflighted file in a single operation and provide a completion summary.
- **FR-012**: System MUST prevent partial imports; if any bid fails at confirmation time, no bids from that confirmation are created.
- **FR-013**: System MUST store the bid time from the import and show it in recent bid activity.
- **FR-014**: System MUST record an import summary that includes who imported, when it occurred, and how many bids were created.
- **FR-015**: System MUST support imports intended for demo/test setup, including the ability to re-run imports without manual data cleanup.
- **FR-016**: Preflight validation MUST treat exact duplicate rows as errors and report them in the per-row error list.

### Import File Examples

**JSON example** (array of bids):

[
  {
    "donor_email": "donor1001@example.org",
    "auction_item_code": "ITEM-500",
    "bid_amount": 150.00,
    "bid_time": "2026-02-01T19:45:00-06:00"
  },
  {
    "donor_email": "donor1002@example.org",
    "auction_item_code": "ITEM-501",
    "bid_amount": 200.00,
    "bid_time": "2026-02-01T19:47:30-06:00"
  }
]

**CSV example** (header row required):

donor_email,auction_item_code,bid_amount,bid_time
donor1001@example.org,ITEM-500,150.00,2026-02-01T19:45:00-06:00
donor1002@example.org,ITEM-501,200.00,2026-02-01T19:47:30-06:00

### Key Entities *(include if feature involves data)*

- **Auction Bid**: A bid placed by a donor on an auction item, including amount, bid time, and source.
- **Auction Item**: An item available for bidding within a specific event, identifiable by item code/number in imports.
- **Donor**: The person or organization placing the bid, identifiable by email for imports.
- **Import Batch**: A single import attempt with preflight results, confirmation status, and summary totals.
- **Bid Validation Result**: The per-row outcome of preflight checks with pass/fail and reason codes.

## Assumptions

- Only authorized event staff can access the dashboard and perform imports.
- Imports are scoped to a single event selected in the PWA.
- Each bid includes a donor email and auction item code/number that map to existing event records.
- Bid time values use a standard date-time format and represent the event’s local time.
- Excel workbooks use the first worksheet with a header row matching the CSV columns.
- Maximum import size is 10,000 bids per file to keep validation and review practical.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Event staff can complete a full preflight validation for a 1,000-row file in under 2 minutes.
- **SC-002**: Event staff can complete a successful import confirmation for a 1,000-row file in under 3 minutes.
- **SC-003**: At least 95% of imports complete successfully on the first attempt without requiring a second preflight.
- **SC-004**: Dashboard pages load and present bid summaries in under 3 seconds for events with up to 10,000 bids.
- **SC-005**: At least 90% of test/demo setup sessions use the import feature to seed bids without manual entry.
