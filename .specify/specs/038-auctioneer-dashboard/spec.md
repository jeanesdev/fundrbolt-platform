# Feature Specification: Auctioneer Dashboard

**Feature Branch**: `038-auctioneer-dashboard`
**Created**: 2026-04-04
**Status**: Draft
**Input**: User description: "auctioneer-dashboard"

## Clarifications

### Session 2026-04-04

- Q: When an item has both a per-item commission and falls under a category with a category-level percentage, how are earnings calculated? → A: Category-level percentages apply only to revenue from items without per-item commissions set. There is no overlap or double-counting. Per-item commissions are independent of category percentages.
- Q: Should the auctioneer see the existing Event Dashboard (revenue waterfall/funnel/pacing) or only the Auctioneer Dashboard? → A: Auctioneer can see the existing Event Dashboard in read-only mode alongside their own Auctioneer Dashboard.
- Q: Should NPO Admins also be able to see auctioneer commission/fee/notes data and the earnings dashboard? → A: No. Only Auctioneers and Super Admins can see auctioneer financial data. NPO Admins have no visibility into commission data or the auctioneer earnings dashboard.
- Q: Do scheduled times for live auction start and silent auction close already exist on the event, or do new fields need to be added? → A: Silent auction close time already exists (auction_close_datetime field, added in migration 032 but not yet mapped in the model). A new live auction start time field needs to be added.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auctioneer Role & Invitation-Only Sign Up (Priority: P1)

An NPO Admin invites an auctioneer to work their event by sending them a unique sign-up link. The auctioneer clicks the link, creates an account (or logs in), and is automatically associated with the NPO and event with the new "Auctioneer" role. The auctioneer has restricted permissions: they can view event details, registrants, and other event admin sections in read-only mode, but they can edit auction items.

**Why this priority**: Without the Auctioneer role and onboarding flow, no other auctioneer features can function. This is the foundational building block.

**Independent Test**: Can be fully tested by having an NPO Admin generate an auctioneer invitation link, sending it to a test user, completing signup, and verifying the user appears with the correct role and permissions.

**Acceptance Scenarios**:

1. **Given** an NPO Admin is managing an event, **When** they generate an auctioneer invitation link, **Then** a unique, shareable URL is created that is tied to that NPO and event.
2. **Given** a person receives an auctioneer invitation link, **When** they click the link and do not have an account, **Then** they are directed to a registration form pre-populated with the auctioneer role context, and upon completing registration they are associated with the NPO and event as an Auctioneer.
3. **Given** a person receives an auctioneer invitation link, **When** they click the link and already have an account, **Then** they are prompted to log in and upon doing so are associated with the NPO and event as an Auctioneer.
4. **Given** an auctioneer is signed in, **When** they navigate to event details, **Then** they can view all event information but cannot edit event settings.
5. **Given** an auctioneer is signed in, **When** they navigate to the registrants list, **Then** they can view all registrants and their details (bidder number, table number, name).
6. **Given** an auctioneer is signed in, **When** they navigate to auction items, **Then** they can view and edit auction item details.
7. **Given** an auctioneer is signed in, **When** they navigate to sponsors, tickets, seating, or other admin sections, **Then** they can view but not modify any information.
8. **Given** a user who is not an Auctioneer or Super Admin, **When** they attempt to access auctioneer-specific features (commission fields, auctioneer dashboard), **Then** they are denied access.

---

### User Story 2 - Auctioneer Commission & Fee Tracking on Auction Items (Priority: P2)

When an auctioneer is signed in, they can navigate to each auction item and enter their commission percentage, a flat fee (if applicable), and notes about the item. These fields are only visible to the auctioneer who entered them and to Super Admins. Other roles cannot see commission, fee, or auctioneer notes on items.

**Why this priority**: Commission tracking per item is the core financial feature for auctioneers and drives the earnings dashboard. It must exist before the dashboard can calculate totals.

**Independent Test**: Can be tested by signing in as an auctioneer, navigating to an auction item, entering a commission percentage (e.g., 10%), a flat fee (e.g., $50), and notes. Then verify these values are saved, visible to the auctioneer, visible to a Super Admin, and hidden from all other roles.

**Acceptance Scenarios**:

1. **Given** an auctioneer is viewing an auction item, **When** they enter a commission percentage (e.g., 15%), **Then** the system saves the commission and associates it with that auctioneer and item.
2. **Given** an auctioneer is viewing an auction item, **When** they enter a flat fee (e.g., $100), **Then** the system saves the fee and associates it with that auctioneer and item.
3. **Given** an auctioneer is viewing an auction item, **When** they enter notes about the item, **Then** the notes are saved and visible only to them and Super Admins.
4. **Given** a commission percentage has been entered for an item, **When** that item sells, **Then** the auctioneer's earnings are calculated as (sale price × commission %) + flat fee.
5. **Given** a Super Admin is viewing an auction item, **When** auctioneer commission data exists for that item, **Then** the Super Admin can see the commission, fee, and notes.
6. **Given** an NPO Admin or other non-auctioneer role views an auction item, **When** auctioneer commission data exists, **Then** the commission, fee, and notes fields are not visible.

---

### User Story 3 - Auctioneer Earnings Dashboard (Priority: P3)

The auctioneer has a dedicated dashboard that shows a running total of their earnings across the event. The dashboard allows the auctioneer to enter what percentage they earn from Live Auction, Paddle Raise, and Silent Auction categories. It displays a total earnings figure, a gallery of items they have commissions on with details (commission rate, flat fee, item availability, cost to NPO), and current totals raised for each event section (Live Auction, Paddle Raise, Silent Auction) plus an Event Total.

**Why this priority**: This is the primary value proposition for auctioneers — understanding their earnings in real time. It depends on commission data (US2) being available.

**Independent Test**: Can be tested by signing in as an auctioneer who has commissions set on multiple items, entering category-level percentages, and verifying the dashboard displays correct earnings totals, item gallery, and event revenue breakdowns.

**Acceptance Scenarios**:

1. **Given** an auctioneer is on their dashboard, **When** they enter a percentage for Live Auction earnings (e.g., 5%), **Then** their earnings from all live auction revenue are calculated using that percentage.
2. **Given** an auctioneer is on their dashboard, **When** they enter a percentage for Paddle Raise earnings (e.g., 3%), **Then** their earnings from all paddle raise revenue are calculated using that percentage.
3. **Given** an auctioneer is on their dashboard, **When** they enter a percentage for Silent Auction earnings (e.g., 4%), **Then** their earnings from all silent auction revenue are calculated using that percentage.
4. **Given** commissions exist on individual items and category-level percentages are set, **When** the auctioneer views their dashboard, **Then** a total earnings figure is displayed combining per-item commissions/fees and category-level percentages.
5. **Given** an auctioneer has commissions on specific items, **When** they view the dashboard gallery, **Then** each item shows: item image/title, commission percentage, flat fee, number still available (quantity remaining), and cost to NPO.
6. **Given** bidding is active, **When** the auctioneer views the dashboard, **Then** they see the current total raised for Live Auction, Paddle Raise, Silent Auction, and the Event Total, updated in near-real-time.
7. **Given** a Super Admin is signed in, **When** they navigate to the auctioneer dashboard for a specific auctioneer, **Then** they can view the same earnings information.
8. **Given** a non-auctioneer, non-Super-Admin user, **When** they attempt to access the auctioneer dashboard, **Then** they are denied access.

---

### User Story 4 - Live Auction Tab with Current Item & Bidding Activity (Priority: P4)

The auctioneer dashboard includes a "Live Auction" tab that shows the current item being auctioned during a live auction session. It displays the current high bidder's details (bidder number, name, table number, profile picture), a history of bids placed on the current item, and real-time updates as bids come in.

**Why this priority**: This tab is critical for the auctioneer to run the live auction effectively, but it depends on the dashboard (US3) existing first.

**Independent Test**: Can be tested by starting a live auction session, having multiple donors place bids on the current item, and verifying the auctioneer's Live Auction tab shows the correct current item, high bidder details, and bid history updating in real time.

**Acceptance Scenarios**:

1. **Given** a live auction is in progress, **When** the auctioneer opens the Live Auction tab, **Then** they see the current item being auctioned with its details (title, image, starting bid, current bid).
2. **Given** a live auction item has bids, **When** a new bid is placed, **Then** the auctioneer sees the bid appear in the history and the high bidder information updates immediately.
3. **Given** a bid is the current highest, **When** the auctioneer views the high bidder section, **Then** they see the bidder's bidder number, full name, table number, and profile picture.
4. **Given** a live auction item has multiple bids, **When** the auctioneer views the bid history, **Then** all bids are listed in chronological order with bidder number, name, amount, and timestamp.
5. **Given** the live auction moves to the next item, **When** the current item changes, **Then** the tab automatically updates to show the new current item and clears the previous bid history.
6. **Given** no live auction is currently in progress, **When** the auctioneer opens the Live Auction tab, **Then** they see a message indicating the live auction has not started or has ended.

---

### User Story 5 - Event Timing Countdowns (Priority: P5)

The auctioneer can see at all times a countdown timer showing how long until the live auction starts and how long until the silent auction ends. These timers are persistent and visible across the auctioneer's dashboard experience.

**Why this priority**: Timers are a convenience/awareness feature that enhances the auctioneer's experience but are not blocking for core functionality.

**Independent Test**: Can be tested by setting up an event with scheduled live auction start and silent auction end times, signing in as auctioneer before the event, and verifying countdown timers display accurately and count down in real time.

**Acceptance Scenarios**:

1. **Given** the live auction has a scheduled start time in the future, **When** the auctioneer views the dashboard, **Then** a countdown timer displays the time remaining until the live auction starts.
2. **Given** the silent auction has a scheduled end time in the future, **When** the auctioneer views the dashboard, **Then** a countdown timer displays the time remaining until the silent auction ends.
3. **Given** the live auction start time has passed, **When** the auctioneer views the timer, **Then** it indicates the live auction is in progress (or has ended, as appropriate).
4. **Given** the silent auction end time has passed, **When** the auctioneer views the timer, **Then** it indicates the silent auction has ended.
5. **Given** the auctioneer navigates between dashboard tabs, **When** they return to any view, **Then** the countdown timers remain visible and accurate without resetting.

---

### Edge Cases

- What happens when an auctioneer invitation link is used after the event has ended? The system should reject the invitation with a clear message.
- What happens when an auctioneer sets a commission on an item that is later withdrawn? The earnings calculation should exclude withdrawn items, and the gallery should indicate the item is no longer active.
- What happens when no auction items exist for the event? The dashboard should display an empty state indicating no items are available.
- What happens when multiple auctioneers are assigned to the same event? Each auctioneer has their own independent commission data, category percentages, and earnings dashboard.
- What happens when a bid is cancelled or refunded after the auctioneer's earnings are calculated? Earnings should update to reflect the adjusted totals.
- What happens if the auctioneer enters a commission percentage greater than 100% or a negative fee? The system should validate inputs and reject invalid values.
- What happens if the event has no scheduled live auction start time or silent auction end time? The corresponding countdown timer should not be displayed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support an "Auctioneer" role that can be assigned to users, distinct from existing roles (Super Admin, NPO Admin, Event Coordinator, Staff, Donor).
- **FR-002**: System MUST allow NPO Admins to generate a unique, shareable invitation link specifically for the Auctioneer role, scoped to a specific NPO and event.
- **FR-003**: The auctioneer invitation link MUST direct new users through account registration and automatically associate them with the correct NPO and event upon completion.
- **FR-004**: The auctioneer invitation link MUST allow existing users to log in and be automatically associated with the correct NPO and event.
- **FR-005**: Auctioneers MUST have read-only access to: event details, registrants list, sponsors, tickets, seating, the existing Event Dashboard, and all other event admin sections except auction items.
- **FR-006**: Auctioneers MUST have edit access to auction items.
- **FR-007**: Each auction item MUST support auctioneer-specific fields: commission percentage (0–100%), flat fee (non-negative currency amount), and free-text notes.
- **FR-008**: Auctioneer-specific fields (commission, fee, notes) MUST be visible only to the auctioneer who entered them and to Super Admins.
- **FR-009**: System MUST provide a dedicated Auctioneer Dashboard accessible only to users with the Auctioneer role and Super Admins.
- **FR-010**: The Auctioneer Dashboard MUST allow the auctioneer to enter category-level earning percentages for Live Auction, Paddle Raise, and Silent Auction.
- **FR-011**: The Auctioneer Dashboard MUST display a running total of the auctioneer's earnings, calculated as the sum of: (a) per-item commissions (sale price × commission %) + flat fees for sold items, and (b) category-level percentages applied to category revenue from items that do NOT have per-item commissions set. Per-item and category-level earnings never overlap on the same item.
- **FR-012**: The Auctioneer Dashboard MUST display a gallery of items the auctioneer has commissions on, showing: item image/title, commission percentage, flat fee, quantity remaining, and cost to NPO.
- **FR-013**: The Auctioneer Dashboard MUST display the current total raised for Live Auction, Paddle Raise, Silent Auction, and the Event Total.
- **FR-014**: The Auctioneer Dashboard MUST include a Live Auction tab that shows the current item being auctioned, the current high bidder (bidder number, name, table number, profile picture), and a chronological bid history for that item.
- **FR-015**: The Live Auction tab MUST update in near-real-time as new bids are placed and when the current item changes.
- **FR-016**: The Auctioneer Dashboard MUST display countdown timers for: time until live auction starts and time until silent auction ends, when scheduled times are configured.
- **FR-017**: Commission percentage MUST be validated to be between 0% and 100%, and flat fee MUST be validated to be a non-negative amount.
- **FR-018**: Earnings calculations MUST exclude items that have been withdrawn or cancelled.
- **FR-019**: When multiple auctioneers are assigned to the same event, each auctioneer MUST have independent commission data, category percentages, and a separate earnings view.

### Key Entities

- **Auctioneer Role**: A new role in the role hierarchy, scoped to NPO and event. Grants read-only access to most event admin sections, edit access to auction items, and access to the Auctioneer Dashboard.
- **Auctioneer Item Commission**: A record linking an auctioneer (user) to an auction item, storing commission percentage, flat fee, and notes. Scoped per auctioneer per item. Visible only to the owning auctioneer and Super Admins.
- **Auctioneer Event Settings**: A record linking an auctioneer (user) to an event, storing category-level earning percentages (Live Auction %, Paddle Raise %, Silent Auction %). Scoped per auctioneer per event.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An NPO Admin can generate an auctioneer invitation link and an auctioneer can complete sign-up and access the event within 3 minutes.
- **SC-002**: An auctioneer can enter commission, fee, and notes on an auction item in under 30 seconds.
- **SC-003**: The Auctioneer Dashboard displays accurate earnings totals that match manual calculation of per-item commissions and category-level percentages within $0.01.
- **SC-004**: The Live Auction tab reflects new bids within 500ms of placement (per constitution Real-Time Reliability principle).
- **SC-005**: Countdown timers are accurate to within 1 second of the actual scheduled times.
- **SC-006**: Non-auctioneer, non-Super-Admin users have zero visibility into auctioneer commission data, fees, notes, category percentages, or the Auctioneer Dashboard.
- **SC-007**: 100% of auctioneer earnings calculations correctly exclude withdrawn, cancelled, or refunded items.
- **SC-008**: The auctioneer can view the current total raised for each event section (Live Auction, Paddle Raise, Silent Auction, Event Total) and the values refresh automatically without requiring a page reload.

## Assumptions

- The existing invitation system (used for NPO staff) can be extended to support the Auctioneer role with minimal modification, using the same link-based onboarding flow.
- The silent auction close time already exists as a field on the event (auction_close_datetime, database column present via migration 032, needs model mapping). A new live auction start time field must be added to the event.
- "Paddle Raise" revenue is tracked as a distinct category alongside Live Auction and Silent Auction, consistent with how the existing event dashboard breaks down revenue by source.
- The auctioneer's category-level percentages apply to the gross revenue of each category (not net of costs).
- An auctioneer may be assigned to multiple events, but each event's dashboard and commission data are independent.
- Profile pictures for bidders are sourced from existing user profile data; if a bidder has no profile picture, a placeholder or initials avatar is shown.
- The "cost to NPO" displayed in the item gallery refers to the existing "cost" field on auction items, representing the item's acquisition cost.
- If a user who already has an NPO membership in a different role accepts an auctioneer invitation for the same NPO, their existing NPO membership role is updated to AUCTIONEER (no duplicate membership records are created).
