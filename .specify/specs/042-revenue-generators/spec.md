# Feature Specification: Revenue Generators

**Feature Branch**: `042-revenue-generators`
**Created**: 2026-05-01
**Status**: Draft
**Input**: User description: "revenue-generators"

## Clarifications

### Session 2026-05-01

- Q: Can admins close a Revenue Generator item for entries independently of hiding it from donors? → A: Yes — two independent states: visible/hidden (donor visibility) and open/closed (whether new entries can be purchased). An item can be visible but closed, allowing donors to see results without being able to purchase new entries.
- Q: Does Quick Entry support a quantity field to record multiple entries in one submission? → A: No — one submission records exactly one entry; the form is optimized for rapid back-to-back individual submissions.
- Q: Which roles can perform winner selection (random draw or manual)? → A: Both admin and auctioneer roles can select or draw winners.
- Q: In the donor "Play" tab, can donors see aggregate total entries or only their own entry count? → A: Donors see only their own entry count for each item, not the aggregate total across all donors.
- Q: Is the winner's name displayed publicly in the donor "Play" tab once selected? → A: Yes — once a winner is selected, the winning donor's name is displayed publicly on the item card in the "Play" tab.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Donor Purchases Entries to a Revenue Generator Game (Priority: P1)

A donor attending a fundraising event opens the "Play" tab in their app and browses available revenue generator games (raffles, games of chance, etc.). They purchase one or more entries into a game. Unlike a silent auction, there is no outbidding — every purchase secures an entry and all entries remain valid. After the event ends, the admin draws a winner.

**Why this priority**: This is the core donor-facing interaction and the primary revenue source for this feature. Without it, the feature delivers no value to attendees.

**Independent Test**: Can be fully tested by creating a Revenue Generator item, setting it as visible, having a donor purchase entries via the "Play" tab, and confirming all entries are recorded and no existing entries are displaced.

**Acceptance Scenarios**:

1. **Given** an active event with at least one visible Revenue Generator item, **When** a donor opens the "Play" tab, **Then** they see all visible Revenue Generator items with name, description, and buy-in price per entry
2. **Given** a donor is viewing a Revenue Generator item, **When** they purchase an entry, **Then** the entry is recorded and the donor receives on-screen confirmation showing their updated personal entry count for that item
3. **Given** a donor has already purchased entries for an item, **When** they view that item, **Then** they see their own entry count (e.g., "You have 3 entries") but do not see the total entry count of other donors
4. **Given** multiple donors have purchased entries for the same item, **When** any donor purchases a new entry, **Then** all previously recorded entries remain unchanged
5. **Given** a donor purchases additional entries for an item they already entered, **When** the purchase completes, **Then** their personal entry count increments and the updated count is displayed
6. **Given** a Revenue Generator item is hidden by the admin, **When** a donor opens the "Play" tab, **Then** the hidden item is not visible or purchasable
7. **Given** an admin has selected a winner for a Revenue Generator item, **When** a donor views the item in the "Play" tab, **Then** the winning donor's name is displayed prominently on the item card

---

### User Story 2 - Admin Creates and Manages Revenue Generator Items (Priority: P1)

An event admin sets up Revenue Generator items for their event, providing a name, description, and fixed buy-in price per entry. The admin can toggle each item's visibility at any time to control when donors see and can purchase entries.

**Why this priority**: Admin setup is a prerequisite for donor participation and is foundational to the entire feature.

**Independent Test**: Can be tested independently by creating a Revenue Generator item, verifying it appears in the admin "Revenue Generators" tab, toggling visibility, and confirming the change is reflected in the donor app.

**Acceptance Scenarios**:

1. **Given** an admin is managing event items, **When** they select the "Revenue Generators" tab, **Then** they see all Revenue Generator items for that event regardless of their visibility state
2. **Given** an admin creates a Revenue Generator item with a name, description, and buy-in price, **When** saved, **Then** the item appears in the admin "Revenue Generators" tab
3. **Given** a visible Revenue Generator item, **When** the admin toggles it to hidden, **Then** the item no longer appears in the donor "Play" tab
4. **Given** a hidden Revenue Generator item with existing entries, **When** the admin toggles it back to visible, **Then** the item reappears in the donor "Play" tab with all previously recorded entries intact
5. **Given** a visible Revenue Generator item, **When** the admin closes it for entries, **Then** donors can still see the item and its results in the "Play" tab but the purchase action is disabled
6. **Given** a closed Revenue Generator item, **When** the admin re-opens it, **Then** donors can purchase new entries again

---

### User Story 3 - Admin Records Revenue Generator Purchases via Quick Entry (Priority: P2)

During a live event, an admin uses the Quick Entry tool to record Revenue Generator purchases on behalf of donors (e.g., table sales, walk-up purchases). A dedicated "Revenue Generators" tab in Quick Entry lets the admin select an item, enter a bidder number, and record one or more entries, similar to recording silent auction bids.

**Why this priority**: Quick Entry is essential for high-volume events where staff handle purchases on behalf of attendees. Without it, in-person sales cannot be efficiently recorded.

**Independent Test**: Can be tested by opening Quick Entry, navigating to the Revenue Generators tab, entering a bidder number and item, and verifying the entry appears in the item's entry list.

**Acceptance Scenarios**:

1. **Given** an admin opens the Quick Entry tool, **When** they select the "Revenue Generators" tab, **Then** they see a list of Revenue Generator items and an entry form
2. **Given** an admin selects an item and enters a valid bidder number, **When** they submit, **Then** one entry is recorded for that bidder and a success confirmation is shown
3. **Given** an admin submits multiple entries sequentially for the same bidder and item, **When** each is submitted, **Then** each submission adds a new entry and the bidder's entry count increments each time
4. **Given** an admin enters an invalid or unrecognized bidder number, **When** they attempt to submit, **Then** an error message is shown and no entry is recorded

---

### User Story 4 - Admin or Auctioneer Selects Winner for a Revenue Generator Item (Priority: P2)

After a game concludes, either an admin or an auctioneer views all entries for a Revenue Generator item. They can manually pick a specific entry as the winner, or invoke the "Random Draw" function. The random draw treats each individual entry as a separate ticket — a donor who purchased 5 entries has 5 times the probability of winning compared to a donor who purchased 1 entry.

**Why this priority**: Winner selection is the conclusion of every Revenue Generator game and must work reliably before the feature can be used in a live event.

**Independent Test**: Can be tested by populating a Revenue Generator item with entries across multiple donors with varying entry counts, performing a random draw, and verifying the result is a valid recorded entry. Statistical distribution can be validated by running many draws.

**Acceptance Scenarios**:

1. **Given** a Revenue Generator item has entries, **When** the admin views the item, **Then** they see the full entry list showing each donor's name and their total entry count for that item
2. **Given** an admin clicks "Random Draw," **When** the draw completes, **Then** a winner is displayed and each individual entry (not each unique donor) had equal probability of selection
3. **Given** Donor A has 5 entries and Donor B has 1 entry for the same item, **When** a random draw is run many times, **Then** Donor A is selected approximately 5 times more often than Donor B
4. **Given** an admin wants to manually select a winner, **When** they choose a specific donor/entry from the list and confirm, **Then** that selection is recorded as the winner
5. **Given** a Revenue Generator item has zero entries, **When** the admin attempts a random draw, **Then** an informational message is shown and no winner is recorded
6. **Given** a winner has already been selected for a Revenue Generator item, **When** the admin chooses to re-draw or override, **Then** the new selection replaces the previous winner and the full history of all selections (including overridden ones) is recorded with timestamps and the admin who made each selection

---

### User Story 5 - Revenue Generators Tallied in Event Dashboards (Priority: P3)

Event organizers can see Revenue Generator performance in the event dashboards. A "Revenue Generators" group section shows combined revenue and entry counts across all games. Each individual item also shows its own revenue and entry count, separate from silent auction and live auction totals.

**Why this priority**: Financial visibility is important for event management but does not block the core purchasing and winner selection flows.

**Independent Test**: Can be tested by recording entries for multiple Revenue Generator items and verifying that group and per-item totals appear correctly and remain separate from other auction revenue.

**Acceptance Scenarios**:

1. **Given** multiple Revenue Generator items with entries across an event, **When** an admin views the event dashboard, **Then** a "Revenue Generators" section displays combined entry count and total revenue for all items
2. **Given** a specific Revenue Generator item has 10 entries at $20 each, **When** the dashboard loads, **Then** that item's row shows 10 entries and $200 in revenue
3. **Given** Revenue Generator revenue is displayed, **When** compared to silent and live auction totals, **Then** Revenue Generator figures are shown as a separate category and do not inflate auction totals
4. **Given** a new entry is recorded for a Revenue Generator item, **When** the dashboard is viewed, **Then** the group total and per-item total reflect the updated count and revenue

---

### User Story 6 - Auctioneer Monitors Revenue Generator Activity (Priority: P3)

The auctioneer has a dedicated "Revenue Generators" tab in their dashboard showing all items, their full entry lists, and revenue totals. The sticky header displays a compact summary card for each Revenue Generator item, allowing the auctioneer to monitor activity at a glance while managing the live event.

**Why this priority**: Auctioneer visibility supports live event management but is not required for core purchasing or winner selection flows to function.

**Independent Test**: Can be tested by navigating to the auctioneer dashboard, selecting the Revenue Generators tab, and confirming each item's entries, revenue, and sticky header card are present and accurate.

**Acceptance Scenarios**:

1. **Given** an auctioneer opens their dashboard, **When** they select the "Revenue Generators" tab, **Then** they see each Revenue Generator item with entry count, list of donors, and revenue total
2. **Given** a new entry is recorded for a Revenue Generator item, **When** the auctioneer views the tab, **Then** the updated entry count and revenue are visible (near-real-time refresh)
3. **Given** Revenue Generator items exist for an event, **When** the auctioneer scrolls through the dashboard, **Then** a compact card per item is visible in the sticky header showing item name, entry count, and revenue

---

### Edge Cases

- What happens when an admin hides a Revenue Generator item after donors have already purchased entries? Existing entries are preserved and remain valid for winner selection; hiding removes the item from the donor view entirely.
- What happens when an admin closes a Revenue Generator item for entries? The item remains visible to donors (if not also hidden) but the purchase action is disabled; existing entries are unaffected.
- What happens when a winner is displayed on a closed but visible item? The winner's name is shown on the item card alongside the "Entries closed" indicator — both states are displayed simultaneously.
- What if the admin overrides the winner after the name has already been publicly displayed? The displayed winner updates immediately to the new selection; the previous winner's name is no longer shown (history is retained in the admin view only).
- What if a donor's registration is deleted after they purchased entries? Standard data integrity rules apply; entries are preserved but linked to an inactive registration and flagged accordingly.
- What if the same bidder number is entered in Quick Entry more than once for the same item? Each submission is treated as a separate, valid entry (purchasing multiple entries is the intended behavior).
- What happens if an admin attempts a random draw for an item with no entries? The system prevents the draw and shows an informational message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support a "Revenue Generator" item category as a distinct type, separate from silent auction and live auction items
- **FR-002**: Revenue Generator items MUST have a fixed buy-in price per entry configured by the admin
- **FR-003**: Donors MUST be able to purchase entries for Revenue Generator items without displacing or invalidating other donors' entries (no outbidding)
- **FR-004**: A single donor MUST be able to purchase multiple entries for the same Revenue Generator item
- **FR-005**: Revenue Generator items MUST use a single fixed unit price per entry; all entries for an item cost the same amount regardless of quantity purchased
- **FR-006**: Each Revenue Generator item has two independently controlled states: **visibility** (visible/hidden — whether donors can see the item in the "Play" tab) and **entry status** (open/closed — whether donors can purchase new entries). Admins MUST be able to toggle each state independently at any time
- **FR-006a**: When an item is hidden, it is removed from the donor "Play" tab entirely
- **FR-006b**: When an item is closed for entries but remains visible, donors can see the item and its current entry count but the purchase action is disabled with a clear "Entries closed" indicator
- **FR-007**: The donor app MUST display all visible Revenue Generator items in a dedicated "Play" tab; each item MUST show the donor's own entry count for that item but MUST NOT display the aggregate total entries from all donors; once a winner is selected, the winning donor's name MUST be displayed publicly on the item card
- **FR-008**: The admin app MUST display all Revenue Generator items (visible and hidden) in a dedicated "Revenue Generators" tab, with a clear indicator of each item's current visibility state
- **FR-009**: The Quick Entry tool MUST include a dedicated "Revenue Generators" tab for recording entry purchases on behalf of donors
- **FR-010**: From Quick Entry, an admin MUST be able to record a Revenue Generator entry by entering a bidder number and selecting an item; the form MUST support rapid back-to-back submissions without navigating away
- **FR-011**: Admins MUST be able to view the complete entry list for each Revenue Generator item, showing each donor's name and their entry count
- **FR-012**: Both admin and auctioneer roles MUST be able to manually select a winner from the entry list for a Revenue Generator item
- **FR-013**: Both admin and auctioneer roles MUST have access to the "Random Draw" function, which selects a winner by giving each individual entry an equal probability of being chosen, resulting in proportionally higher win probability for donors with more entries
- **FR-014**: The system MUST NOT send automated winner notifications; winner announcements are handled by the admin outside the system. However, when viewing a Revenue Generator item's winner, the admin MUST be presented with a direct shortcut to the event's Notifications page with the winning donor pre-populated, so the admin can send a manual notification in as few steps as possible
- **FR-015**: Event dashboards MUST display a "Revenue Generators" section showing combined entry count and total revenue across all Revenue Generator items for the event
- **FR-016**: Event dashboards MUST display per-item tallies for each Revenue Generator item, showing individual entry count and revenue, separate from silent and live auction totals
- **FR-017**: The auctioneer dashboard MUST include a dedicated "Revenue Generators" tab displaying all items, their entry lists, and revenue generated
- **FR-018**: The auctioneer dashboard sticky header MUST display a compact summary card for each Revenue Generator item showing item name, entry count, and revenue

### Key Entities

- **Revenue Generator Item**: An event-scoped item of category "Revenue Generator" with a name, description, fixed buy-in price per entry, two independent control states (visibility: visible/hidden; entry status: open/closed), and an optional designated winner. Distinct from silent and live auction items.
- **Revenue Generator Entry**: A single purchased entry for a Revenue Generator item, linked to a donor (identified by bidder number), with purchase timestamp and amount paid. One donor may have many entries per item.
- **Winner Selection Record**: A record associated with a Revenue Generator item capturing the winning entry, whether selection was manual or by random draw, the timestamp, and the admin who performed the selection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Donors can purchase an entry for a Revenue Generator game in under 30 seconds from the "Play" tab
- **SC-002**: An admin can toggle a Revenue Generator item's visibility and the change is reflected in the donor app within 5 seconds
- **SC-003**: An admin can complete a random winner draw in under 10 seconds from opening the item's entry list
- **SC-004**: Revenue Generator group and per-item totals in dashboards accurately reflect all recorded entries within 10 seconds of a new entry being recorded
- **SC-005**: 100% of random draws produce a valid, recorded entry as the winner when at least one entry exists
- **SC-006**: Revenue from Revenue Generator items is displayed separately from silent auction and live auction revenue in all dashboard views — cross-category totals are never combined
- **SC-007**: An admin can record a Revenue Generator entry via Quick Entry in under 15 seconds per entry, supporting rapid back-to-back submissions

## Assumptions

- Revenue Generator items are scoped to a specific fundraising event, consistent with how silent auction and live auction items work
- Each entry is purchased at the fixed unit buy-in price; no bundle or tiered pricing
- Visibility (visible/hidden) and entry status (open/closed) are independent controls: hiding removes the item from the donor view; closing disables new purchases while keeping the item visible for results display
- Hiding an item immediately removes it from the donor "Play" tab but preserves all existing entries for winner selection
- The random draw weights by individual entry count (not unique donors), so a donor with 5 entries has 5× the win probability of a donor with 1 entry
- A Revenue Generator item supports a single current winner at a time; prior selections are retained in history when overridden
- Winner selection history is stored and auditable; re-draws and overrides are logged with the admin identity and timestamp
- No automated winner notification is sent; the admin announces the winner and can navigate to the Notifications page with the winning donor pre-populated to send a manual notification
- Auctioneer dashboard updates are near-real-time (automatic periodic refresh), consistent with existing dashboard behavior
- Entries recorded via Quick Entry and entries purchased through the donor app are treated identically in all entry counts, random draws, and winner selection
- Revenue Generator items can coexist alongside silent and live auction items within the same event
- The "Play" tab is only visible to donors when at least one visible Revenue Generator item exists for the event
