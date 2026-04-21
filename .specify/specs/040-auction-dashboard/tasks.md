# Tasks: Auction Dashboard

**Input**: Design documents from `/specs/040-auction-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Tests**: Include backend contract/integration tests for new API endpoints.
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — Pydantic schemas, service skeleton, route registration, frontend feature module

- [ ] T001 Create Pydantic response schemas in `backend/app/schemas/auction_dashboard.py` (AuctionDashboardSummary, AuctionItemRow, AuctionItemsListResponse, AuctionDashboardCharts, ChartDataPoint, AuctionItemDetailResponse, AuctionItemFull, BidHistoryEntry, BidTimelinePoint)
- [ ] T002 [P] Create `AuctionDashboardService` skeleton class in `backend/app/services/auction_dashboard_service.py` with method stubs and `_resolve_accessible_event_ids()` access control (following donor dashboard pattern from `backend/app/services/donor_dashboard_service.py`)
- [ ] T003 [P] Create API router file `backend/app/api/v1/admin_auction_dashboard.py` with 5 endpoint stubs, register router in `backend/app/api/v1/__init__.py` (or main router inclusion file)
- [ ] T004 [P] Create frontend feature directory structure: `frontend/fundrbolt-admin/src/features/auction-dashboard/` with `AuctionDashboardPage.tsx`, `AuctionItemDetailPage.tsx`, `components/`, `hooks/`
- [ ] T005 [P] Create React Query hooks in `frontend/fundrbolt-admin/src/features/auction-dashboard/hooks/useAuctionDashboard.ts` (useAuctionSummary, useAuctionItems, useAuctionCharts, useAuctionItemDetail — with 60s refetchInterval)
- [ ] T006 [P] Create TanStack Router route files: `frontend/fundrbolt-admin/src/routes/_authenticated/events/$eventId/auction-dashboard.tsx` and `frontend/fundrbolt-admin/src/routes/_authenticated/events/$eventId/auction-dashboard/$itemId.tsx`

**Checkpoint**: Backend stubs return 501, frontend routes exist but show placeholder content.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend service core — access control and base query logic that all endpoints depend on

- [ ] T007 Implement `_resolve_accessible_event_ids()` in `backend/app/services/auction_dashboard_service.py` — resolve which events the authenticated user can access (super_admin=all, npo_admin/coordinator=assigned NPO events, auctioneer=assigned events)
- [ ] T008 Implement shared query builder helper in `backend/app/services/auction_dashboard_service.py` — base query for auction items with event scope filtering, type filtering (silent/live/buy_now), category filtering, search, and status != DRAFT exclusion
- [ ] T009 Create backend tests file `backend/app/tests/test_auction_dashboard.py` with test fixtures (test user, test event, test auction items with varying types/categories/bids, test bids)

**Checkpoint**: Access control and query infrastructure ready. All user story endpoints can now build on this foundation.

---

## Phase 3: User Story 1 — Auction Items Overview Dashboard (Priority: P1) 🎯 MVP

**Goal**: Summary stats, sortable/searchable/filterable items table with card view, scope toggle

**Independent Test**: Navigate to auction dashboard for an event, see summary cards with correct totals, paginated items table, card view toggle, scope toggle works

### Implementation for User Story 1

- [ ] T010 [US1] Implement `get_summary()` method in `backend/app/services/auction_dashboard_service.py` — returns total items, total bids, total revenue (from current_bid_amount where bid exists), average bid amount; respects event scope and type/category filters
- [ ] T011 [US1] Implement `get_items()` method in `backend/app/services/auction_dashboard_service.py` — paginated, sortable, searchable (title + donated_by), filterable by type/category; includes event_name via join; 25 per page
- [ ] T012 [US1] Wire up `GET /admin/auction-dashboard/summary` endpoint in `backend/app/api/v1/admin_auction_dashboard.py` with auth dependency and query params (event_id, auction_type, category)
- [ ] T013 [US1] Wire up `GET /admin/auction-dashboard/items` endpoint in `backend/app/api/v1/admin_auction_dashboard.py` with auth, pagination (page, per_page), sort (sort_by, sort_order), search, and filter params
- [ ] T014 [P] [US1] Write backend tests for summary and items endpoints in `backend/app/tests/test_auction_dashboard.py` — test summary totals, pagination, sorting, search, type/category filtering, scope toggle
- [ ] T015 [P] [US1] Create `AuctionSummaryCards` component in `frontend/fundrbolt-admin/src/features/auction-dashboard/components/AuctionSummaryCards.tsx` — 4 stat cards (total items, total bids, total revenue, avg bid)
- [ ] T016 [P] [US1] Create `AuctionItemsTable` component in `frontend/fundrbolt-admin/src/features/auction-dashboard/components/AuctionItemsTable.tsx` — TanStack React Table with sortable columns (title, type, category, current bid, bid count, watchers, status, event name), search bar, pagination, clickable rows linking to item detail route
- [ ] T017 [P] [US1] Create `AuctionItemCard` component in `frontend/fundrbolt-admin/src/features/auction-dashboard/components/AuctionItemCard.tsx` — card layout showing item metrics, clickable to item detail route
- [ ] T018 [US1] Assemble `AuctionDashboardPage` in `frontend/fundrbolt-admin/src/features/auction-dashboard/AuctionDashboardPage.tsx` — ScopeToggle + SummaryCards + table/card view toggle + AuctionItemsTable/cards + refresh button; connect to React Query hooks with 60s auto-refresh

**Checkpoint**: User Story 1 complete — admin can view summary stats, browse items in table/card view, search/sort/filter, toggle scope, auto-refresh works.

---

## Phase 4: User Story 2 — Item Detail Drill-Down with Bid History (Priority: P1)

**Goal**: Full-page item detail with bid history table and bid-value timeline chart

**Independent Test**: Click any item from dashboard, see item details, bid history table with bidder#/name/amount/type/status, and timeline chart of bid values over time

### Implementation for User Story 2

- [ ] T019 [US2] Implement `get_item_detail()` method in `backend/app/services/auction_dashboard_service.py` — returns full item info (with event name), bid history (with bidder number + user first/last name via join), and bid timeline data points sorted by placed_at; excludes cancelled/withdrawn from timeline but includes in history table
- [ ] T020 [US2] Wire up `GET /admin/auction-dashboard/items/{item_id}` endpoint in `backend/app/api/v1/admin_auction_dashboard.py` with auth and item_id path param; 404 if not found or not accessible
- [ ] T021 [P] [US2] Write backend tests for item detail endpoint in `backend/app/tests/test_auction_dashboard.py` — test item info, bid history ordering/content, bidder name display, 404 on missing item, access control
- [ ] T022 [P] [US2] Create `ItemDetailHeader` component in `frontend/fundrbolt-admin/src/features/auction-dashboard/components/ItemDetailHeader.tsx` — show item name, description, type, category, starting bid, current bid, buy now price, donor, status, watcher count, bid count
- [ ] T023 [P] [US2] Create `BidHistoryTable` component in `frontend/fundrbolt-admin/src/features/auction-dashboard/components/BidHistoryTable.tsx` — TanStack table with columns: bidder (formatted as "#142 — Jane Smith"), amount, timestamp, bid type, bid status; sortable by all columns
- [ ] T024 [P] [US2] Create `BidTimelineChart` component in `frontend/fundrbolt-admin/src/features/auction-dashboard/components/BidTimelineChart.tsx` — Recharts LineChart with bid amounts (Y) over time (X), ReferenceLine for buy now price when applicable, responsive
- [ ] T025 [US2] Assemble `AuctionItemDetailPage` in `frontend/fundrbolt-admin/src/features/auction-dashboard/AuctionItemDetailPage.tsx` — breadcrumb back to dashboard + ItemDetailHeader + BidTimelineChart + BidHistoryTable; connect to useAuctionItemDetail hook; mobile responsive (stacked layout)

**Checkpoint**: User Story 2 complete — admin can drill down into any item, see full bid history with bidder identity, and timeline chart with buy now reference line.

---

## Phase 5: User Story 3 — Charts and Visual Breakdowns (Priority: P2)

**Goal**: Visual charts showing revenue/bid breakdowns by type, category, and top 10 items

**Independent Test**: Dashboard shows 6 charts with accurate data matching the table data

### Implementation for User Story 3

- [ ] T026 [US3] Implement `get_charts()` method in `backend/app/services/auction_dashboard_service.py` — returns revenue_by_type, revenue_by_category, bid_count_by_type, top_items_by_revenue (top 10), top_items_by_bid_count (top 10), top_items_by_watchers (top 10); respects scope and filters; handles buy_now as separate type bucket
- [ ] T027 [US3] Wire up `GET /admin/auction-dashboard/charts` endpoint in `backend/app/api/v1/admin_auction_dashboard.py` with auth and filter params
- [ ] T028 [P] [US3] Write backend tests for charts endpoint in `backend/app/tests/test_auction_dashboard.py` — test each chart dataset correctness, filter application, scope toggle
- [ ] T029 [P] [US3] Create `RevenueByTypeChart` component in `frontend/fundrbolt-admin/src/features/auction-dashboard/components/RevenueByTypeChart.tsx` — Recharts PieChart or BarChart showing revenue per type (silent/live/buy now), with legend
- [ ] T030 [P] [US3] Create `RevenueByCategoryChart` component in `frontend/fundrbolt-admin/src/features/auction-dashboard/components/RevenueByCategoryChart.tsx` — Recharts BarChart showing revenue per category
- [ ] T031 [P] [US3] Create `BidCountByTypeChart` component in `frontend/fundrbolt-admin/src/features/auction-dashboard/components/BidCountByTypeChart.tsx` — Recharts BarChart showing bid counts per type
- [ ] T032 [P] [US3] Create `TopItemsChart` component in `frontend/fundrbolt-admin/src/features/auction-dashboard/components/TopItemsChart.tsx` — reusable horizontal BarChart showing top 10 items by a given metric (revenue, bid count, or watcher count), with item name labels
- [ ] T033 [US3] Integrate all charts into `AuctionDashboardPage` in `frontend/fundrbolt-admin/src/features/auction-dashboard/AuctionDashboardPage.tsx` — add charts section below summary cards, above items table; charts respond to filter/scope changes

**Checkpoint**: User Story 3 complete — dashboard shows 6 visual charts that update with filters and scope toggle.

---

## Phase 6: User Story 4 — Filtering by Type and Category (Priority: P2)

**Goal**: Multi-select filter controls for type and category that update table and charts simultaneously

**Independent Test**: Apply a type filter (e.g., "Silent"), verify table and all charts show only silent items; combine with category filter, verify intersection; clear filters restores all data

### Implementation for User Story 4

- [ ] T034 [US4] Create filter state management in `frontend/fundrbolt-admin/src/features/auction-dashboard/AuctionDashboardPage.tsx` — useState for selectedTypes (string[]) and selectedCategories (string[]), passed as query params to all React Query hooks
- [ ] T035 [US4] Create `AuctionFilters` component in `frontend/fundrbolt-admin/src/features/auction-dashboard/components/AuctionFilters.tsx` — multi-select dropdowns for auction type (Silent, Live, Buy Now) and category (10 options), active filter badges, "Clear Filters" button; filters persist across table/card view switches
- [ ] T036 [US4] Wire filter params into summary, items, and charts API calls in `frontend/fundrbolt-admin/src/features/auction-dashboard/hooks/useAuctionDashboard.ts` — pass auction_type and category as comma-separated query params

**Checkpoint**: User Story 4 complete — filtering works across table, cards, summary stats, and charts simultaneously.

---

## Phase 7: User Story 5 — Event Scope Toggle (Priority: P2)

**Goal**: "This Event" vs "All Events" toggle with event column in table

**Independent Test**: User with 3+ events toggles to "All Events", sees combined stats, event column appears in table; toggle back hides column and shows single-event data

### Implementation for User Story 5

- [ ] T037 [US5] Add `ScopeToggle` component usage in `frontend/fundrbolt-admin/src/features/auction-dashboard/AuctionDashboardPage.tsx` — reuse or match the ScopeToggle from donor dashboard; controls whether event_id is passed to API hooks
- [ ] T038 [US5] Add conditional "Event" column to `AuctionItemsTable` in `frontend/fundrbolt-admin/src/features/auction-dashboard/components/AuctionItemsTable.tsx` — visible only when scope is "All Events", sortable and filterable
- [ ] T039 [US5] Add conditional "Event" column to `AuctionItemCard` in `frontend/fundrbolt-admin/src/features/auction-dashboard/components/AuctionItemCard.tsx` — show event name badge on card when scope is "All Events"

**Checkpoint**: User Story 5 complete — scope toggle works, event column appears/hides correctly, all data aggregates properly.

---

## Phase 8: User Story 6 — Export Auction Data (Priority: P3)

**Goal**: CSV export respecting current filters and scope

**Independent Test**: Apply filters, click export, downloaded CSV has correct filtered data and columns

### Implementation for User Story 6

- [ ] T040 [US6] Implement `export_items_csv()` method in `backend/app/services/auction_dashboard_service.py` — streaming CSV response with all visible columns, respecting scope/filters/sort; includes event_name column when no event_id filter; follows donor dashboard export pattern
- [ ] T041 [US6] Wire up `GET /admin/auction-dashboard/items/export` endpoint in `backend/app/api/v1/admin_auction_dashboard.py` with same filter/sort params as items list endpoint; returns StreamingResponse with CSV content type
- [ ] T042 [P] [US6] Write backend test for CSV export in `backend/app/tests/test_auction_dashboard.py` — test CSV content, column headers, filter application, scope-dependent columns
- [ ] T043 [US6] Add CSV export button to `AuctionDashboardPage` in `frontend/fundrbolt-admin/src/features/auction-dashboard/AuctionDashboardPage.tsx` — triggers download of export endpoint with current filter/scope params

**Checkpoint**: User Story 6 complete — CSV export works with all filters and scope toggles.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Empty states, mobile responsiveness, nav integration, final validation

- [ ] T044 Create empty state component in `frontend/fundrbolt-admin/src/features/auction-dashboard/components/EmptyState.tsx` — message and CTA to create auction items when no items exist for current scope/filters
- [ ] T045 Add auction dashboard nav link to event sidebar in the appropriate layout/navigation component — match positioning of donor dashboard and auctioneer links
- [ ] T046 Add loading skeleton states to `AuctionDashboardPage` and `AuctionItemDetailPage` for initial load and refresh
- [ ] T047 Mobile responsiveness pass — verify card view is default on mobile, charts stack vertically and are readable, detail page is fully responsive, filters are accessible
- [ ] T048 Run full backend CI checks: `cd backend && poetry run ruff check . && poetry run ruff format --check . && poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests' && poetry run pytest -v --tb=short`
- [ ] T049 Run full frontend CI checks: `cd frontend/fundrbolt-admin && pnpm lint && pnpm format:check && pnpm build`

---

## Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundation) → Phase 3 (US1/MVP) → Phase 4 (US2)
                                        ↘ Phase 5 (US3) can start after Phase 3
                                        ↘ Phase 6 (US4) can start after Phase 3
                                        ↘ Phase 7 (US5) can start after Phase 3
                                        ↘ Phase 8 (US6) can start after Phase 3
Phase 9 (Polish) → after all story phases complete
```

## Parallel Execution Opportunities

### Within Phase 1
- T002, T003, T004, T005, T006 are all independent (different files)

### Within Phase 3 (US1)
- T015, T016, T017 (frontend components) can parallel with T010-T013 (backend)
- T014 (tests) can parallel with T015-T017 (frontend components)

### Within Phase 4 (US2)
- T022, T023, T024 (frontend components) can parallel with T019-T020 (backend)
- T021 (tests) can parallel with T022-T024 (frontend components)

### Within Phase 5 (US3)
- T029, T030, T031, T032 (chart components) are all independent
- Backend T26-T28 can parallel with frontend T29-T32

### After Phase 3 (US1 MVP)
- Phases 4, 5, 6, 7, 8 can all be worked on in parallel since they extend the MVP independently

## Implementation Strategy

**MVP (minimum viable)**: Phase 1 + Phase 2 + Phase 3 (User Story 1) — delivers a working dashboard with summary stats, sortable table, card view, scope toggle, and auto-refresh.

**Incremental delivery order**:
1. MVP (US1) — core dashboard value
2. US2 (item drill-down) — actionable insights, also P1
3. US3 (charts) — visual analytics
4. US4 (filtering) — can integrate during US3
5. US5 (scope toggle) — likely integrated early in US1 but fully tested here
6. US6 (CSV export) — convenience feature, lowest priority
7. Polish — empty states, nav, mobile pass
