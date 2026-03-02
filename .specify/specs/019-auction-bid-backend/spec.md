# Feature Specification: Auction Bid Backend

**Feature Branch**: `019-auction-bid-backend`
**Created**: 2026-02-02
**Status**: Draft
**Input**: User description: "Create a comprehensive auction bidding system for fundraising events with optional proxy bidding for silent auctions, immutable bid history, administrative adjudication, and extensive reporting on bidder behavior, fundraising outcomes, and giving potential."

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

### User Story 1 - Place valid bids and track outcomes (Priority: P1)

Bidders place regular bids on live auction items and either regular or proxy bids on silent auction items. They can optionally buy an item immediately if buy-now is available. They can see whether their bid is currently leading or has been outbid.

**Why this priority**: This is the core fundraising interaction that must work before any administrative or analytics features provide value.

**Independent Test**: Can be fully tested by placing bids on live and silent items and confirming bid outcomes and visibility.

**Acceptance Scenarios**:

1. **Given** a live auction item with a current high bid and bid increment, **When** a bidder places a regular bid below the minimum increment, **Then** the bid is rejected with a clear validation message.
2. **Given** a silent auction item, **When** a bidder submits a proxy bid with a max bid, **Then** the system places the minimum required bid and records the max bid for future auto-bids.
3. **Given** a buy-now enabled item with remaining quantity, **When** a bidder submits a buy-now bid at the required price, **Then** the item is immediately marked as won and bidding closes once quantity is exhausted.

---

### User Story 2 - Admin adjudication and payment tracking (Priority: P2)

Event administrators review bids, mark winning bids, adjust amounts when needed, and track payment processing status with an audit trail of every administrative action.

**Why this priority**: Administrators need to finalize auction outcomes and reconcile payments to complete fundraising.

**Independent Test**: Can be fully tested by marking a bid as winning, adjusting the amount, and verifying audit records and payment status changes.

**Acceptance Scenarios**:

1. **Given** an auction item with multiple bids, **When** an administrator marks a bid as the winner, **Then** the winning status is recorded and all other bids are marked as outbid.
2. **Given** a bid requiring correction, **When** an administrator adjusts the bid amount, **Then** the original amount and adjustment reason are preserved in the audit trail.

---

### User Story 3 - Bidder analytics and reporting (Priority: P3)

Event coordinators generate reports to understand bidder behavior, fundraising outcomes, and giving potential across live, silent, and paddle raise activity.

**Why this priority**: Reporting drives strategic decisions and identifies high-value donors for future fundraising.

**Independent Test**: Can be fully tested by generating reports for a seeded event and verifying totals, breakdowns, and filters.

**Acceptance Scenarios**:

1. **Given** a completed event with bids and paddle raise contributions, **When** an administrator requests a bidder history report, **Then** the report includes totals for won, lost, and unprocessed amounts plus item participation.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- Two bids arrive at the same time for the same item with equal amounts.
- A proxy bid attempts to auto-bid after the auction has closed.
- A buy-now bid is placed when the last available quantity is already reserved by another bid.
- A bidder attempts to submit a max bid on a live auction item.
- An administrator adjusts a bid amount after payment processing has started.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST allow bidders to place regular bids on live and silent auction items.
- **FR-002**: System MUST allow bidders to optionally submit a max bid only for silent auction items, and reject max bids for live auction items.
- **FR-003**: System MUST automatically place minimum required counter-bids on behalf of a proxy bidder up to their max bid limit.
- **FR-004**: System MUST create an immutable bid record for every manual bid and every auto-bid generated by proxy bidding.
- **FR-005**: System MUST support buy-now bids that immediately win the item when available quantity remains.
- **FR-006**: System MUST track bid status (active, outbid, winning, cancelled, withdrawn) independently from payment status.
- **FR-007**: System MUST allow administrators to mark winning bids, cancel bids, adjust bid amounts, and override payment status with a recorded reason.
- **FR-008**: System MUST maintain a complete audit trail for administrative actions, including who acted, when, and why.
- **FR-009**: System MUST capture bidder identification using both user identity and bidder number assigned at event check-in.
- **FR-010**: System MUST provide bid history reporting as defined in RA-001 and RA-002, including filters for auction type and payment status.
- **FR-011**: System MUST provide bidder analytics including totals for winning, losing, unprocessed, and potential spend based on max bids.
- **FR-012**: System MUST include paddle raise contributions in donor analytics while keeping them separate from item bids.
- **FR-013**: System MUST detect bidding wars by identifying rapid bid escalation among multiple bidders and report an intensity score.
- **FR-014**: System MUST enforce bid validation rules for minimum increments, buy-now price matching, and auction close times.
- **FR-015**: System MUST support reporting performance targets for events with up to 10,000 bids.
- **FR-016**: System MUST allow all authenticated staff to access reporting views while restricting bid adjudication actions to administrators only.

### Reporting & Analytics Requirements

- **RA-001**: System MUST provide a bid history report per auction item including bidder number, bid amount, max bid (if present), timestamp, and bid status in chronological order.
- **RA-002**: System MUST provide a bid history report per bidder including items bid on, outcomes (won/lost), and whether proxy bidding was used.
- **RA-003**: System MUST provide a winning bids report filterable by transaction status and auction type.
- **RA-004**: System MUST provide an unprocessed transactions report for payment reconciliation.
- **RA-005**: System MUST provide bidder analytics showing totals for winning bids, processed payments, losing bids, unprocessed amounts, and max-bid-based potential spend.
- **RA-006**: System MUST provide analytics breaking down bidder participation by live vs silent auctions and include paddle raise totals.
- **RA-007**: System MUST provide item performance reporting including total bids, unique bidders, final price vs starting price, revenue generated, and proxy bidding utilization.
- **RA-008**: System MUST provide bidding war detection including participant count, bid frequency, escalation amount, and a competitive intensity score, distinguishing manual vs proxy-driven escalations.
- **RA-009**: System MUST provide high-value donor identification by ranking bidders on total giving potential (winning bids plus paddle raise).
- **RA-010**: System MUST define bidding war intensity score as a weighted index: 50% bid frequency (bids/min), 30% participant count, 20% escalation amount, normalized to a 0–100 scale.
 - **RA-011**: System MUST define proxy usage rate as proxy bids divided by total bids within the same bidder or event scope.

### Key Entities *(include if feature involves data)*

- **Auction Bid**: A single immutable bid attempt containing bidder identity, item reference, bid amount, optional max bid for silent auctions, timestamp, bid status, and payment status.
- **Bid Action Audit**: A record of administrative actions on bids, including the actor, action type, reason, and timestamp.
- **Paddle Raise Contribution**: A donation entry tied to a bidder and event with amount, tier name, and timestamp.
- **Bidder Analytics Summary**: Aggregated view of a bidder’s totals (won, lost, unprocessed, potential spend), participation across auction types, and bidding war involvement.
- **Auction Item Bid History**: Ordered list of all bids for an item, including auto-bids, with outcome details.

## Clarifications

### Session 2026-02-02

- Q: Who can access reporting and bid adjudication tools? → A: All authenticated staff can access reporting; only admins can adjudicate.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Bidders can place a valid bid and receive confirmation in under 5 seconds.
- **SC-002**: Bid history reports for events with up to 10,000 bids return results within 2 seconds for paginated views.
- **SC-003**: 95% of proxy bidding scenarios correctly place the minimum required auto-bid without exceeding the max bid.
- **SC-004**: Event administrators can finalize winning bids and payment status for a typical event in under 30 minutes.
- **SC-005**: At least 90% of administrators report that bidder analytics are sufficient to identify high-potential donors.

## Assumptions

- Bidders have completed event registration and have a valid bidder number before placing bids.
- Auction close times and item availability are already managed by event configuration.
- Currency is USD with two decimal places for all bid and donation amounts.
