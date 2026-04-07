# Research: Auction Dashboard (040)

**Date**: 2026-04-07
**Status**: Complete — no NEEDS CLARIFICATION remaining

## R1: Aggregation Query Pattern for Dashboard Stats

**Decision**: Use SQLAlchemy aggregation queries in a dedicated `AuctionDashboardService` class, following the same pattern as `DonorDashboardService`.

**Rationale**: The donor dashboard service already demonstrates the pattern of running aggregate queries (SUM, COUNT, AVG) across auction items and bids with event/NPO scope filtering. The auction dashboard needs similar aggregations (total revenue, bid counts, top items) and can reuse the same access-control resolution pattern (`_resolve_accessible_npo_ids` / event-scoped queries).

**Alternatives considered**:
- Separate analytics database / materialized views — over-engineered for current scale (200 items max)
- Redis-cached pre-computed aggregates — adds complexity; direct SQL aggregation is fast enough for this scale
- Reusing existing `/auction/reports/*` endpoints — those endpoints exist in API docs but are not fully implemented as standalone analytics; building a dedicated service gives cleaner separation

## R2: Chart Library

**Decision**: Use Recharts (already a project dependency, used in donor dashboard and event dashboard).

**Rationale**: Recharts is already in the project's `package.json`, used for `GivingCategoryCharts` in the donor dashboard and revenue pacing in the event dashboard. Adding another charting library would violate the constitution's minimalist principle.

**Alternatives considered**:
- Chart.js / react-chartjs-2 — would add a new dependency
- Nivo — richer but heavier, unnecessary for bar/pie/line charts needed here
- D3 directly — too low-level for this use case

## R3: Scope Toggle Implementation

**Decision**: Use optional `event_id` query parameter. When present, scope to that event. When absent, aggregate across all accessible events. Follow the donor dashboard's `ScopeToggle` component and `_resolve_accessible_npo_ids()` backend pattern.

**Rationale**: This is the exact pattern already proven in the donor dashboard. The `event_id` parameter naturally maps to "This Event" (parameter present) vs "All Events" (parameter absent). Access control scoping through NPO membership is already implemented.

**Alternatives considered**:
- Separate endpoints per scope — violates DRY, more routes to maintain
- Client-side aggregation across multiple event API calls — poor performance, complex client logic

## R4: Item Detail Page Routing

**Decision**: TanStack Router file-based route at `events/$eventId/auction-dashboard/$itemId`. The item detail page will be a separate route, not a panel.

**Rationale**: Per clarification Q1, the user chose a full-page detail view with its own route. This aligns with TanStack Router's file-based routing where a `$itemId.tsx` file creates a parameterized route. Breadcrumb back to dashboard preserves navigation context.

**Alternatives considered**:
- Slide-out panel (rejected by user in clarification)
- Modal overlay (rejected by user in clarification)

## R5: "Buy Now" as a Filter Category

**Decision**: For dashboard display purposes, treat items with `buy_now_enabled=True` as a third visual category "Buy Now" alongside "Silent" and "Live" in charts and filter controls. An item can be both its auction type AND buy-now-enabled.

**Rationale**: The underlying data model has only two `auction_type` values (SILENT, LIVE) plus a boolean `buy_now_enabled` flag. For the dashboard, users expect to filter by "buy now" as a distinct segment. The query logic will filter by `buy_now_enabled=True` when the "Buy Now" filter is selected. Items with buy now enabled will appear in the "Buy Now" category in charts, even if they are also silent/live type.

**Alternatives considered**:
- Show only two types (silent/live) and ignore buy now — doesn't satisfy user requirement to see buy now items separately
- Create a composite type field — over-engineers the data model for a display concern

## R6: Auto-Refresh Pattern

**Decision**: Use React Query's `refetchInterval: 60000` for auto-refresh, combined with a manual refresh button that calls `queryClient.invalidateQueries()`. This is the same pattern used by the event dashboard.

**Rationale**: React Query natively supports polling intervals and provides optimistic UI updates. The event dashboard already uses this pattern with 60-second intervals. Adding a manual refresh button is trivial — just invalidate the relevant query keys.

**Alternatives considered**:
- WebSocket push updates — explicitly out of scope per clarification
- Custom `setInterval` polling — React Query handles this natively with better cache management
