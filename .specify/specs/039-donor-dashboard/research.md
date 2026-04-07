# Research: Donor Dashboard

**Feature**: 039-donor-dashboard
**Date**: 2026-04-06

## R1: Revenue Source Aggregation Strategy

**Decision**: Aggregate from 7 existing models using SQL window functions and GROUP BY, following the `EventDashboardService._get_source_actuals()` pattern.

**Rationale**: The event dashboard already solves this problem for a single event. The donor dashboard inverts the axis — instead of "all donors for one event," it computes "all events for one donor." Same data sources, different grouping key.

**Revenue Models & Giving Categories**:

| Giving Category | Model(s) | Filter | Amount Field |
|-----------------|----------|--------|-------------|
| Tickets | `TicketPurchase` | `payment_status = COMPLETED` | `total_price` |
| Donations / Paddle Raise | `Donation` + `QuickEntryDonation` + `PaddleRaiseContribution` | `status = ACTIVE` (Donation), all (QE/PR) | `amount` |
| Silent Auction Wins | `AuctionBid` | `bid_status = WINNING`, item `auction_type = SILENT` | `bid_amount` |
| Live Auction Wins | `QuickEntryBid` | `status = WINNING` | `amount` |
| Buy-Now | `QuickEntryBuyNowBid` | all (no status filter) | `amount` |

**Alternatives considered**:
- Materialized view: Rejected — adds DB migration complexity, stale data risk, and this is a read-only analytics feature with acceptable query latency.
- Pre-computed Redis cache: Deferred — can be added later if query performance exceeds 3s at scale.

## R2: Outbid Amount Calculation

**Decision**: For each donor, find their maximum bid per auction item where they did NOT win. Sum those max bids across all items. Use a CTE that identifies the winning bid per item, then joins against the donor's bids per item where `bid_status != WINNING`.

**Rationale**: The spec defines "outbid amount" as the sum of the donor's highest bid on each item they lost. This requires per-item max aggregation, not just a sum of all outbid bids.

**Alternatives considered**:
- Sum all OUTBID bids (not just max per item): Rejected — would double-count when a donor bids multiple times on one item.
- Use `current_bid_amount` on AuctionItem: Rejected — doesn't tell us what the losing donor bid.

## R3: Bid War Detection

**Decision**: Group `AuctionBid` records by `(user_id, auction_item_id)`, count bids per group, filter for groups with `count >= 3`. A "bid war" is any item where a donor placed 3+ bids. Rank donors by the number of distinct items with bid wars.

**Rationale**: 3+ bids on a single item indicates the donor was actively competing (at least 2 counter-bids after initial). This is a simple, explainable heuristic.

**Alternatives considered**:
- Detect interleaved bidding patterns between 2+ users: Rejected — more complex, harder to explain to admins, and 3+ bids per donor per item is a sufficient proxy.
- Include QuickEntryBid (live auction): Deferred — live auction bids are entered by staff on behalf of donors in real-time; they don't represent the same self-driven competitive behavior as silent auction bids.

## R4: Cross-NPO Data Access Pattern

**Decision**: Service method accepts a list of accessible NPO IDs (determined by role). For Super Admin: all NPOs. For Auctioneer: NPOs where they have membership. For NPO Admin/Coordinator/Staff: their single NPO only. The service filters all queries by `Event.npo_id IN (accessible_npo_ids)`.

**Rationale**: Follows the existing `PermissionService` / `NPOPermissionService` patterns. The caller resolves accessible NPOs before invoking the service, keeping the service itself role-agnostic.

**Alternatives considered**:
- Service checks roles internally: Rejected — violates separation of concerns; auth belongs in middleware/endpoint layer.
- Separate endpoints for cross-NPO vs single-NPO: Rejected — unnecessary duplication; a single endpoint with NPO filtering covers both.

## R5: Check-In as Attendance

**Decision**: Use `RegistrationGuest.checked_in = True` to determine event attendance. Join `RegistrationGuest` to `EventRegistration` to get `event_id`, then to `User` via `RegistrationGuest.user_id` (when the guest is linked to a user account).

**Rationale**: Per clarification, "event attended" = checked in. The `checked_in` boolean and `check_in_time` timestamp exist on `RegistrationGuest`.

**Alternatives considered**:
- Use EventRegistration status: Rejected — registration ≠ attendance per spec clarification.

## R6: CSV Export Approach

**Decision**: Backend endpoint streams CSV using `StreamingResponse` with the same query as the leaderboard, formatted as CSV. No temporary file creation.

**Rationale**: StreamingResponse avoids memory issues for large datasets. CSV is generated row-by-row from the same aggregation query used for the JSON leaderboard response.

**Alternatives considered**:
- Frontend-only CSV generation from loaded data: Rejected — frontend only has one page of paginated data; export should include all donors matching current scope.
- Background job with download link: Over-engineered for <10s operation on 5,000 rows.

## R7: Frontend Architecture

**Decision**: New feature module at `frontend/fundrbolt-admin/src/features/donor-dashboard/` following the `event-dashboard` pattern. TanStack Query for data fetching, Recharts for charts, Radix UI for tabs/panels.

**Rationale**: Exact same patterns used by the event dashboard (feature 026). Recharts already imported and used for revenue charts.

**Alternatives considered**:
- Different chart library: Rejected — Recharts is already a dependency and used throughout.
