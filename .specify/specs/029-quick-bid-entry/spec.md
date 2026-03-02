# Feature Specification: Quick Bid Entry

**Feature Branch**: `[029-quick-bid-entry]`
**Created**: 2026-02-25
**Status**: Draft
**Input**: User description: "quick-bid-entry - Admin PWA page for rapid live auction bid and paddle raise donation capture during callouts"

## Clarifications

### Session 2026-02-25

- Q: How should "Assign winner" determine the winner for a live auction item? → A: Set winner to the current highest valid bid automatically with confirmation.
- Q: How should equal live auction bid amounts be handled? → A: Earliest accepted bid wins (first-in wins).
- Q: Which roles can access Quick Entry? → A: Super Admin, NPO Admin, and NPO Staff only.
- Q: How should unmatched bidder number submissions be handled? → A: Reject submission, show error, keep entry flow active.
- Q: Are donation labels required for Paddle Raise entries? → A: No, labels are optional.

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

### User Story 1 - Rapid live auction bid capture (Priority: P1)

As event staff, I can rapidly enter live auction bids by amount and bidder number for a selected item so the bidding process keeps pace with the auctioneer.

**Why this priority**: Capturing bids accurately in real time is mission-critical to auction operations and revenue.

**Independent Test**: Can be fully tested by selecting a live auction item, entering repeated amount/bidder combinations via keyboard-only flow, and confirming bids are recorded and visible in a running log.

**Acceptance Scenarios**:

1. **Given** a signed-in user without Super Admin, NPO Admin, or NPO Staff role, **When** they try to open Quick Entry, **Then** access is denied.
1. **Given** staff is in Live Auction mode with an item selected, **When** they enter an amount and bidder number and press Enter on bidder number, **Then** a bid is created and appears in the bid log.
2. **Given** an amount is typed, **When** the value is displayed, **Then** it is shown as whole-dollar currency with separators and no decimals.
3. **Given** focus is on amount input, **When** staff presses Enter or Tab, **Then** focus moves to bidder number input.
4. **Given** focus is on bidder number input, **When** staff presses Enter, **Then** the bid is submitted, inputs reset for the next entry, and focus returns to amount input.
5. **Given** focus is on bidder number input, **When** staff presses Tab, **Then** focus cycles to amount input with the existing amount value selected for overwrite.
6. **Given** staff enters a bidder number that is not associated with a donor, **When** they submit, **Then** the system shows an error, does not create a bid, and remains usable for additional bid entries.

---

### User Story 2 - Live auction control and visibility (Priority: P2)

As event staff, I can monitor bid progress and manage entered bids so I can confidently close bidding and assign a winner.

**Why this priority**: Staff need immediate visibility and correction tools to maintain trust in auction outcomes.

**Independent Test**: Can be tested by entering multiple bids, viewing summary indicators and bidder/table details, deleting a mistaken bid, and assigning a winner when bidding ends.

**Acceptance Scenarios**:

1. **Given** bids have been entered for an item, **When** staff views the page, **Then** prominent indicators show current highest bid, total bid count, and unique bidder count.
2. **Given** a bid exists in the log, **When** staff clicks delete for that bid, **Then** the bid is removed and summary indicators update.
3. **Given** the bid log contains valid bids for an item, **When** staff clicks assign winner and confirms, **Then** the current highest valid bid is recorded as the winner for that item.
4. **Given** a bid log row is displayed, **When** it is rendered, **Then** it includes bidder number, donor name (if matched), and table number (if assigned).

---

### User Story 3 - Rapid paddle raise donation entry (Priority: P3)

As event staff, I can quickly enter paddle raise donations with reusable donor focus and donation labeling so I can process a high volume of callouts without interruption.

**Why this priority**: Paddle raise moments involve fast repeated entries where speed and consistency directly affect fundraising totals.

**Independent Test**: Can be tested by switching to Paddle Raise mode, entering repeated donations via keyboard, applying predefined/custom labels, and verifying totals and participation metrics update.

**Acceptance Scenarios**:

1. **Given** staff is in Paddle Raise mode, **When** they submit a donation from bidder number input, **Then** bidder number clears and focus stays on bidder number input for the next entry.
2. **Given** donation labels are available, **When** staff selects one or more labels and submits a donation, **Then** the donation is saved with the selected labels.
3. **Given** staff enters a custom donation label, **When** they submit a donation, **Then** the donation is saved with that custom label included.
4. **Given** paddle raise donations have been entered, **When** staff views the page, **Then** prominent indicators show total raised, counts by donation amount level, donor count, and donor participation percentage.
5. **Given** staff enters a bidder number that is not associated with a donor in Paddle Raise mode, **When** they submit, **Then** the system shows an error, does not create a donation, and keeps focus in bidder number input for continued entry.
6. **Given** no predefined labels are checked and no custom label is entered, **When** staff submits a valid Paddle Raise donation, **Then** the donation is saved successfully without labels.

---

### Edge Cases

- Staff attempts to submit in Live Auction mode without selecting an auction item.
- Staff enters zero, negative, or non-numeric amount values.
- Staff enters a bidder number that does not map to a donor record.
- Two staff members enter bids for the same item at nearly the same time.
- Two bids with equal amounts are accepted for the same item in close succession.
- Staff attempts to assign a winner when no valid bids exist.
- Staff deletes the current highest bid and summary metrics must recalculate immediately.
- Paddle Raise mode has no labels selected and no custom label entered.
- Paddle Raise mode custom label exceeds allowed length or includes only whitespace.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a single Quick Entry page in the Admin experience with a mode selector for Live Auction Bid Entry and Paddle Raise Donation Entry.
- **FR-002**: System MUST restrict access to authorized event staff roles that can record bids or donations.
- **FR-002A**: Authorized Quick Entry roles are limited to Super Admin, NPO Admin, and NPO Staff.
- **FR-003**: In Live Auction mode, the system MUST require selection of one live auction item before a bid can be submitted.
- **FR-004**: In Live Auction mode, the system MUST provide an amount input and bidder number input optimized for keyboard entry.
- **FR-005**: The system MUST display typed amounts in whole-dollar currency format with thousands separators and no decimal places.
- **FR-006**: In Live Auction mode, pressing Enter on bidder number MUST submit a bid for the selected item.
- **FR-007**: In Live Auction mode, pressing Enter or Tab in the amount input MUST move focus to bidder number input.
- **FR-008**: In Live Auction mode, pressing Tab in bidder number input MUST move focus back to amount input and select the full amount value.
- **FR-009**: After successful Live Auction bid submission, the system MUST clear entry inputs and return focus to amount input.
- **FR-010**: When a submitted bidder number is not associated with a donor in Live Auction mode, the system MUST display an error state, MUST NOT create a bid record, and MUST allow immediate subsequent entries.
- **FR-011**: The system MUST display a chronological live auction bid log with bid amount, bidder number, donor name when available, and table number when available.
- **FR-012**: The system MUST allow staff to delete individual bid log entries.
- **FR-013**: The system MUST provide an explicit action to assign a winning bid for a live auction item once bidding is complete, and this action MUST assign the current highest valid bid after staff confirmation.
- **FR-014**: In Live Auction mode, the system MUST prominently show at least current highest bid, total bid count, and unique bidder count for the selected item.
- **FR-014A**: For equal bid amounts on the same live auction item, the system MUST rank the earliest accepted bid as the higher bid for current bid display and winner assignment.
- **FR-015**: In Paddle Raise mode, the system MUST allow donation entry without requiring an auction item selection.
- **FR-016**: In Paddle Raise mode, pressing Enter on bidder number MUST submit a donation and keep focus on bidder number input with bidder number cleared.
- **FR-017**: In Paddle Raise mode, the system MUST provide a selectable list of donation label checkboxes and a custom label text input.
- **FR-018**: Each paddle raise donation MUST be saved with the currently selected donation labels and any valid custom label entered at submission time.
- **FR-018A**: When a submitted bidder number is not associated with a donor in Paddle Raise mode, the system MUST display an error state, MUST NOT create a donation record, and MUST keep the rapid-entry workflow active.
- **FR-018B**: In Paddle Raise mode, donation labels are optional, and the system MUST allow successful donation creation when no predefined or custom labels are provided.
- **FR-019**: In Paddle Raise mode, the system MUST prominently show total pledged amount, counts by donation amount level, unique donor count, and donor participation percentage.
- **FR-020**: The system MUST update all visible summary indicators after each create or delete action.
- **FR-021**: The system MUST keep a complete event audit trail of created, deleted, and winner-assigned entries, including acting staff user and timestamp.

### Key Entities *(include if feature involves data)*

- **Quick Entry Mode**: Operational context selected by staff (`Live Auction` or `Paddle Raise`) that determines required inputs and keyboard behavior.
- **Live Auction Item**: Catalog item eligible for bidding; includes item number, item title, active bidding state, and final winner assignment status.
- **Bid Entry**: Single live auction bid record with item reference, amount, bidder number, donor resolution result, entered-by staff user, and timestamp.
- **Donation Entry**: Single paddle raise donation record with amount, bidder number, donor resolution result, associated labels, entered-by staff user, and timestamp.
- **Donation Label**: Classification tag attached to donations; supports predefined labels and one custom label per entry.
- **Bidder/Donor Profile**: Person mapped by bidder number with display name and optional table assignment used in entry logs and summaries.
- **Entry Summary Metrics**: Real-time aggregates for the current context, including counts, unique participants, totals, and participation rates.

## Assumptions

- Bidder numbers are event-scoped and map to at most one donor profile per event.
- Donation participation percentage uses total registered bidders for the event as the denominator.
- Staff can continue entering donations in Paddle Raise mode while keeping prior amount value unless manually changed.
- If donor name or table is unavailable, the log still records the entry and displays available fields.
- Winner assignment always targets the current highest valid bid for the currently selected live auction item, subject to staff confirmation.
- Equal-amount live auction bids are resolved by first-in wins using acceptance timestamp order.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: During live event operation, staff can submit each bid or donation entry in 3 seconds or less for at least 90% of entries.
- **SC-002**: At least 98% of entry attempts by authorized staff are recorded successfully without page reload.
- **SC-003**: In usability validation, at least 90% of staff users complete a 20-entry keyboard-only simulation without losing entry flow.
- **SC-004**: For completed events using this page, reconciliation differences between announced and recorded entries remain below 1% of total entries.
- **SC-005**: Summary indicators reflect create/delete actions within 1 second for at least 95% of updates.
