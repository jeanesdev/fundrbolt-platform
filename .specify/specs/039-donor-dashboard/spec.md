# Feature Specification: Donor Dashboard

**Feature Branch**: `039-donor-dashboard`
**Created**: 2026-04-06
**Status**: Draft
**Input**: User description: "Donor Dashboard — A dashboard for admins/auctioneers to analyze donor and attendee behavior across events, showing giving totals by category, bid activity, outbid patterns, bid war engagement, auction category interests, and individual donor drill-down. Supports filtering by single event or all events for the organization. Super Admin and Auctioneer roles can see cross-NPO donor activity for organizations they have access to."

## Clarifications

### Session 2026-04-06

- Q: How does the "Auctioneer" role map to the existing system roles? → A: The "auctioneer" role already exists in the system (added in a recent feature). It is a distinct role used in `@require_role()` checks alongside super_admin, npo_admin, event_coordinator, staff, and donor. No new role needs to be created.
- Q: What qualifies a donor as having "attended" an event? → A: A donor is counted as having attended an event only if they were checked in (physical attendance confirmed via check-in record).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Donor Leaderboard Overview (Priority: P1)

An NPO Admin opens the Donor Dashboard from the admin navigation. They see a summary view showing a ranked list of donors sorted by total giving (donations + winning auction bids + ticket purchases). Each entry shows the donor's name, total given, number of events attended, and a breakdown bar showing giving by category (tickets, donations/paddle raise, silent auction wins, live auction wins, buy-now purchases). The admin can toggle between "This Event" and "All Events" to see donor giving scoped to a single event or aggregated across all events for their organization.

**Why this priority**: The leaderboard is the foundation of the dashboard. It provides the core value — quickly identifying the highest-value donors — and is the entry point for all deeper analysis.

**Independent Test**: Can be fully tested by loading the dashboard page, verifying donors are ranked by total giving, and toggling the event scope filter. Delivers immediate value by surfacing top donors.

**Acceptance Scenarios**:

1. **Given** an NPO Admin with an active event that has registrations, bids, and donations, **When** they open the Donor Dashboard, **Then** they see a ranked list of donors sorted by total giving with name, total amount, event count, and category breakdown.
2. **Given** the dashboard is loaded in "This Event" mode, **When** the admin toggles to "All Events," **Then** the leaderboard re-ranks donors using aggregated giving data across all of the organization's events.
3. **Given** a donor has not attended any events for this organization, **When** viewing "All Events," **Then** that donor does not appear in the leaderboard.
4. **Given** the leaderboard is displayed, **When** the admin clicks a column header (e.g., total given, event count), **Then** the list re-sorts by that column.

---

### User Story 2 — Individual Donor Profile Drill-Down (Priority: P1)

An admin selects a specific donor from the leaderboard (or searches for one by name). They see a detailed profile view showing: the donor's contact information, a history of every event they've attended, all bids placed (with outcome — won, outbid, active), all donations made, all tickets purchased, and their auction category interests based on bidding history. This view helps the admin understand the donor's patterns and preferences.

**Why this priority**: Knowing *who* the top donors are (Story 1) is only actionable if you can drill into *what* they've done. The profile is essential for building targeted outreach strategies.

**Independent Test**: Can be fully tested by selecting a donor from any list and verifying that the profile displays complete historical activity. Delivers value by enabling personalized donor engagement.

**Acceptance Scenarios**:

1. **Given** the donor leaderboard is displayed, **When** the admin clicks on a donor's name, **Then** a donor profile view opens showing contact details, event history, bid history, donation history, and ticket purchase history.
2. **Given** the donor profile is open, **When** viewing bid history, **Then** each bid shows the auction item name, bid amount, bid status (won, outbid, active), and the event it was placed in.
3. **Given** the donor profile is open, **When** viewing auction category interests, **Then** the system shows a breakdown of categories the donor has bid on, ranked by number of bids or total amount bid per category.
4. **Given** the "All Events" scope is active, **When** viewing a donor profile, **Then** activity from all of the organization's events is included in the profile.
5. **Given** the "This Event" scope is active, **When** viewing a donor profile, **Then** only activity from the selected event is shown.

---

### User Story 3 — Outbid & Untapped Potential Analysis (Priority: P2)

An admin wants to identify donors who have demonstrated willingness to spend but haven't won items — indicating untapped fundraising potential. The dashboard provides an "Outbid Leaders" view that ranks donors by the total amount they've been outbid on (sum of their highest bids on items they ultimately lost). This view also shows how many items each donor bid on but didn't win, and their win rate. The admin uses this to identify donors who should be personally targeted for paddle raise appeals, buy-now opportunities, or next-event sponsorship outreach.

**Why this priority**: This is the core differentiating insight of the dashboard — identifying donors with demonstrated spending intent who haven't converted to wins. It directly supports the stated goal of increasing donor giving.

**Independent Test**: Can be fully tested by verifying the outbid ranking calculation against known bid data, confirming donors are ranked correctly by outbid amount, and that win rate is accurately calculated.

**Acceptance Scenarios**:

1. **Given** an event with completed auction items where some donors were outbid, **When** the admin views the "Outbid Leaders" tab, **Then** donors are ranked by total outbid amount (sum of their best bid on each item they lost).
2. **Given** a donor bid on 5 items and won 2, **When** viewing their outbid summary, **Then** the system shows 3 items lost, 2 items won, and a 40% win rate.
3. **Given** the "All Events" scope is active, **When** viewing outbid leaders, **Then** outbid calculations aggregate across all of the organization's events.

---

### User Story 4 — Bid War Engagement Analysis (Priority: P2)

An admin wants to see which donors get into competitive bidding — repeatedly counter-bidding on items against other donors. The dashboard provides a "Bid Wars" view that identifies donors who have the most back-and-forth bidding on individual items (more than 2 bids from the same donor on the same item). This reveals highly engaged, competitive donors who may respond well to live auction appeals or exclusive item previews.

**Why this priority**: Bid wars signal high emotional engagement and competitive spending behavior, which is uniquely actionable for auctioneers planning live auction strategy.

**Independent Test**: Can be fully tested by placing multiple bids from different users on the same item and verifying the bid war detection logic correctly identifies donors with repeated bids.

**Acceptance Scenarios**:

1. **Given** an auction item where Donor A bid 3 times and Donor B bid 4 times, **When** viewing the Bid Wars analysis, **Then** both donors appear with their respective bid counts on that item.
2. **Given** the Bid Wars view is displayed, **When** the admin sorts by "most bid wars," **Then** donors are ranked by the number of distinct items on which they placed 3 or more bids.
3. **Given** a donor bid once on 10 different items, **When** viewing Bid Wars, **Then** that donor does not appear (single bids per item do not constitute bid wars).

---

### User Story 5 — Giving by Category Visualization (Priority: P3)

An admin views charts and visual breakdowns showing donor giving segmented by category. Categories include: ticket purchases, donations/paddle raise, silent auction wins, live auction wins, and buy-now purchases. Additionally, auction item categories (Experiences, Dining, Travel, Wellness, Sports, Family, Art, Retail, Services, Other) are shown to reveal which types of items attract the most bidding activity and revenue. The admin uses this to plan future event inventory and outreach.

**Why this priority**: Category breakdowns provide strategic event-planning insights but are less immediately actionable for individual donor outreach compared to Stories 1–4.

**Independent Test**: Can be fully tested by verifying chart data matches aggregated totals from the underlying transaction data for each category.

**Acceptance Scenarios**:

1. **Given** the dashboard is loaded, **When** the admin views the category breakdown, **Then** charts display total giving grouped by giving type (tickets, donations, silent auction, live auction, buy-now).
2. **Given** the dashboard is loaded, **When** the admin views auction category interests, **Then** a chart shows total bid activity and revenue by auction item category (Experiences, Dining, Travel, etc.).
3. **Given** the "This Event" scope is active, **When** viewing category breakdowns, **Then** only data from the selected event is included.

---

### User Story 6 — Cross-NPO Donor View for Super Admin and Auctioneer (Priority: P3)

A Super Admin or Auctioneer who works across multiple NPOs wants to see a donor's complete giving history across every NPO and event they have access to. When they open a donor's profile, they see activity grouped by NPO, then by event within each NPO. This helps auctioneers understand a donor's overall philanthropic behavior — not just within one organization — to better tailor live auction strategy across events.

**Why this priority**: Cross-NPO visibility is a power-user feature primarily for auctioneers and Super Admins. It adds strategic depth but is not required for the core single-organization use case.

**Independent Test**: Can be fully tested by logging in as a Super Admin with access to multiple NPOs, selecting a donor who has attended events at more than one NPO, and verifying that activity from all accessible NPOs is displayed and grouped correctly.

**Acceptance Scenarios**:

1. **Given** a Super Admin with access to 3 NPOs, **When** they view a donor who attended events at 2 of those NPOs, **Then** the donor profile shows activity from both NPOs, clearly separated by organization.
2. **Given** an Auctioneer assigned to events at 2 different NPOs, **When** they view the same donor, **Then** they only see activity from NPOs/events they have access to — not from a third NPO they don't have access to.
3. **Given** an NPO Admin (not Super Admin or Auctioneer), **When** they view a donor profile, **Then** they only see activity within their own organization, even if the donor has history at other NPOs.

---

### Edge Cases

- What happens when a donor has registered for an event but placed no bids and made no donations? They should still appear in the leaderboard if they have ticket purchases, but with $0 for bid and donation categories.
- How does the system handle a donor who has been soft-deleted or deactivated? Their historical data should still appear in aggregate analytics and leaderboard, but their profile should indicate inactive status.
- What happens when an event has no registrations, bids, or donations? The dashboard should display an empty state with a message indicating no donor activity exists for the selected scope.
- How does the system handle donors who were registered as guests (not primary registrants)? Guest records without a linked user account should be excluded from the dashboard, as they lack a user identity to aggregate against. Only guests linked to a user account should appear.
- What happens when a bid is cancelled or withdrawn? Cancelled/withdrawn bids should be excluded from giving totals and outbid calculations but may optionally appear in the donor's detailed bid history marked with their cancelled status.
- What happens when an event is in DRAFT status? Draft events should be excluded from dashboard calculations — only ACTIVE and CLOSED events contribute data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a ranked leaderboard of donors sorted by total giving amount, with the ability to sort by other columns (event count, specific category totals).
- **FR-002**: System MUST calculate total giving as the sum of: completed ticket purchases, donations (including paddle raise), winning silent auction bids, winning live auction bids, and buy-now purchases.
- **FR-003**: System MUST provide a scope toggle allowing the user to filter between "This Event" (single selected event) and "All Events" (all events for the current organization).
- **FR-004**: System MUST provide a donor search function allowing admins to find a specific donor by name or email.
- **FR-005**: System MUST display an individual donor profile showing: contact information, event attendance history, complete bid history with outcomes, donation history, ticket purchase history, and auction category interests.
- **FR-006**: System MUST rank donors by total outbid amount (sum of their highest bid on each item they did not win) in an "Outbid Leaders" view.
- **FR-007**: System MUST calculate and display each donor's auction win rate (items won / items bid on).
- **FR-008**: System MUST identify bid wars — instances where a donor placed 3 or more bids on a single auction item — and rank donors by the number of distinct items involved in bid wars.
- **FR-009**: System MUST display giving breakdowns by category type (tickets, donations/paddle raise, silent auction, live auction, buy-now) using visual charts.
- **FR-010**: System MUST display auction item category interest breakdown (Experiences, Dining, Travel, Wellness, Sports, Family, Art, Retail, Services, Other) based on bid activity.
- **FR-011**: System MUST restrict dashboard access to users with Super Admin, NPO Admin, Event Coordinator, Auctioneer, or Staff roles.
- **FR-012**: For Super Admin and Auctioneer roles, the system MUST allow viewing a donor's activity across all NPOs and events that the logged-in user has access to, grouped by NPO then by event.
- **FR-013**: For NPO Admin, Event Coordinator, and Staff roles, the system MUST restrict donor data to only their own organization's events.
- **FR-014**: System MUST exclude data from DRAFT-status events from all dashboard calculations and views.
- **FR-015**: System MUST exclude cancelled and withdrawn bids from giving totals and outbid calculations.
- **FR-016**: System MUST handle donors with no activity gracefully, displaying an appropriate empty state rather than errors.
- **FR-017**: System MUST support pagination for the donor leaderboard to handle organizations with large numbers of donors.
- **FR-018**: System MUST allow exporting the current leaderboard view to a downloadable file (CSV format) for offline analysis.

### Key Entities

- **Donor Profile (aggregated view)**: A computed view combining a user's identity (name, email, phone) with aggregated metrics: total given, events attended, items bid on, items won, outbid amount, win rate, bid war count, and category interest distribution. Not a new data entity — derived from existing User, AuctionBid, Donation, TicketPurchase, and EventRegistration records.
- **Giving Category Breakdown**: A categorization of a donor's total giving into: ticket purchases, donations/paddle raise, silent auction wins, live auction wins, and buy-now purchases. Computed from existing transaction records.
- **Outbid Summary**: A derived metric per donor showing total outbid amount, number of items lost, number of items won, and win rate. Computed from AuctionBid records by comparing a donor's best bid per item against the winning bid.
- **Bid War Instance**: A detected pattern where a single donor placed 3 or more bids on a single auction item. Identified by grouping bids by (donor, auction item) and filtering for groups with count >= 3.

## Assumptions

- The "auctioneer" role is an existing system role. Auctioneers with memberships at multiple NPOs see cross-NPO donor data for those NPOs, consistent with the existing `@require_role("super_admin", "auctioneer")` pattern used elsewhere.
- Giving totals only include transactions with a completed/active payment status. Failed, refunded, or voided transactions are excluded.
- The dashboard is read-only — no donor data can be modified from this view.
- "Event attended" / "events attended" means the donor was checked in at the event (physical attendance confirmed). Registration alone or financial activity without check-in does not count as attendance. A donor can still appear on the leaderboard via financial activity (bids, donations, ticket purchases) without having attended.
- Guest records (RegistrationGuest) are only included in analytics if they are linked to a user account. Anonymous guests without user IDs are excluded since they cannot be meaningfully aggregated.
- The "This Event" scope defaults to the currently selected event in the admin navigation context. If no event is selected, the dashboard defaults to "All Events" for the organization.
- CSV export includes the currently visible leaderboard data with all columns, respecting the active scope filter and sort order.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admins can identify the top 10 donors by total giving within 5 seconds of loading the dashboard.
- **SC-002**: Admins can view a complete donor profile (all activity across the selected scope) within 3 seconds of selecting a donor.
- **SC-003**: The outbid leaders view correctly identifies at least 95% of donors with demonstrated but unconverted spending intent (donors outbid on 2+ items).
- **SC-004**: Admins can switch between "This Event" and "All Events" scope and see updated results within 3 seconds.
- **SC-005**: The dashboard supports organizations with up to 5,000 unique donors across 50 events without noticeable performance degradation.
- **SC-006**: 80% of admin users can locate a specific donor and understand their giving pattern within 2 minutes of first using the dashboard.
- **SC-007**: CSV export of the leaderboard completes within 10 seconds for datasets up to 5,000 donors.
- **SC-008**: Cross-NPO donor view (Super Admin/Auctioneer) correctly shows activity only from NPOs the user has authorized access to — no data leakage across tenant boundaries.
