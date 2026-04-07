# Tasks: Donor Dashboard

**Input**: Design documents from `/specs/039-donor-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/donor-dashboard-api.yaml

**Tests**: Not explicitly requested — test tasks omitted. Tests can be added later.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the backend service, schemas, and API router skeleton; create the frontend feature module skeleton.

- [x] T001 Create Pydantic response schemas in backend/app/schemas/donor_dashboard.py — define DonorLeaderboardEntry, DonorLeaderboardResponse, DonorProfileResponse, EventAttendance, BidRecord, DonationRecord, TicketRecord, OutbidSummary, CategoryInterest, OutbidLeaderEntry, OutbidLeadersResponse, BidWarEntry, BidWarItem, BidWarsResponse, CategoryBreakdownResponse, GivingTypeEntry, AuctionCategoryEntry per contracts/donor-dashboard-api.yaml
- [x] T002 Create DonorDashboardService skeleton in backend/app/services/donor_dashboard_service.py — class with constructor accepting db session, stub methods for get_leaderboard, get_donor_profile, get_outbid_leaders, get_bid_wars, get_category_breakdown, export_leaderboard_csv
- [x] T003 Create API router skeleton in backend/app/api/v1/admin_donor_dashboard.py — define router with prefix="/admin/donor-dashboard", add stub endpoints matching contracts, apply @require_role("super_admin", "npo_admin", "event_coordinator", "auctioneer", "staff")
- [x] T004 Register router in backend/app/api/v1/__init__.py — import admin_donor_dashboard and call api_router.include_router(admin_donor_dashboard.router)
- [x] T005 [P] Create frontend feature module directory structure: frontend/fundrbolt-admin/src/features/donor-dashboard/pages/, components/, hooks/
- [x] T006 [P] Create API client service in frontend/fundrbolt-admin/src/services/donor-dashboard.ts — class with methods matching all 6 endpoints, using existing axios/fetch pattern from event-dashboard.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the NPO access resolution helper used by all endpoints.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T007 Implement _resolve_accessible_npo_ids helper in backend/app/api/v1/admin_donor_dashboard.py (or in service) — for super_admin: all NPOs; for auctioneer: NPOs from NPOMember; for npo_admin/event_coordinator/staff: their single NPO. Accept current_user and optional npo_id query param, return list of NPO UUIDs. Apply Event.status filter (ACTIVE, CLOSED only).
- [x] T008 Implement _build_event_filter helper in backend/app/services/donor_dashboard_service.py — accepts accessible_npo_ids and optional event_id, returns SQLAlchemy filter clause for Event.npo_id.in_(npo_ids) AND Event.status.in_(ACTIVE, CLOSED) AND optionally Event.id == event_id

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Donor Leaderboard Overview (Priority: P1) 🎯 MVP

**Goal**: Ranked donor list by total giving with category breakdown and event scope toggle.

**Independent Test**: Load dashboard, verify donors ranked by total giving, toggle event scope.

### Implementation for User Story 1

- [x] T009 [US1] Implement get_leaderboard in backend/app/services/donor_dashboard_service.py — aggregate TicketPurchase, Donation (status=ACTIVE), QuickEntryDonation, PaddleRaiseContribution, AuctionBid (WINNING only, exclude CANCELLED/WITHDRAWN per FR-015), QuickEntryBid (WINNING), QuickEntryBuyNowBid per user. Include inactive users but expose is_active flag. Only include RegistrationGuest records with user_id IS NOT NULL (exclude unlinked guests per edge case). Compute ticket_total, donation_total, silent_auction_total, live_auction_total, buy_now_total, total_given. Count events_attended via RegistrationGuest.checked_in. Support sort_by, sort_order, search (name/email ILIKE), pagination (page, per_page). Return DonorLeaderboardResponse.
- [x] T010 [US1] Wire GET /leaderboard endpoint in backend/app/api/v1/admin_donor_dashboard.py — call _resolve_accessible_npo_ids, pass to service.get_leaderboard along with query params (event_id, sort_by, sort_order, search, page, per_page). Return DonorLeaderboardResponse.
- [x] T011 [P] [US1] Create ScopeToggle component in frontend/fundrbolt-admin/src/features/donor-dashboard/components/ScopeToggle.tsx — toggle button group "This Event" / "All Events". Emits selected mode. When "This Event", uses current event from admin navigation context; when "All Events", passes no event_id.
- [x] T012 [P] [US1] Create useDonorLeaderboard hook in frontend/fundrbolt-admin/src/features/donor-dashboard/hooks/useDonorDashboard.ts — TanStack Query hook calling donor-dashboard.ts service getLeaderboard. Accept params: eventId, sortBy, sortOrder, search, page, perPage. refetchInterval: 60_000.
- [x] T013 [US1] Create DonorLeaderboard component in frontend/fundrbolt-admin/src/features/donor-dashboard/components/DonorLeaderboard.tsx — table with columns: Rank, Name, Total Given, Events Attended, Tickets, Donations, Silent Auction, Live Auction, Buy-Now. Sortable column headers. Pagination controls. Search input. Click row to select donor (for US2 drill-down). Show visual indicator (e.g., muted text or badge) for inactive donors (is_active=false).
- [x] T014 [US1] Create DonorDashboardPage in frontend/fundrbolt-admin/src/features/donor-dashboard/pages/DonorDashboardPage.tsx — page layout with ScopeToggle at top, tab navigation (Leaderboard, Outbid Leaders, Bid Wars, Categories), render DonorLeaderboard as default tab. Wire scope state to leaderboard query params.
- [x] T015 [US1] Add route for /donor-dashboard in TanStack Router config (frontend/fundrbolt-admin/src/routes/) — protected route requiring admin roles. Add navigation link in sidebar.

**Checkpoint**: Leaderboard loads with real data, scope toggle works, sorting and search functional.

---

## Phase 4: User Story 2 — Individual Donor Profile Drill-Down (Priority: P1)

**Goal**: Detailed profile view for a selected donor showing all activity.

**Independent Test**: Click donor in leaderboard, verify profile shows contact info, event history, bids, donations, tickets, category interests.

### Implementation for User Story 2

- [x] T016 [US2] Implement get_donor_profile in backend/app/services/donor_dashboard_service.py — query User by id, aggregate event_history (events with check-in status, per-event giving total, grouped by NPO for cross-NPO roles), bid_history (AuctionBid + QuickEntryBid + QuickEntryBuyNowBid with item title/category/status), donation_history (Donation + QuickEntryDonation + PaddleRaiseContribution), ticket_history (TicketPurchase with package name), category_interests (group bids by AuctionItem.category), outbid_summary (max bid per lost item, win rate). Respect event_id and npo_id scope filters.
- [x] T017 [US2] Wire GET /donors/{user_id} endpoint in backend/app/api/v1/admin_donor_dashboard.py — resolve NPO access, call service.get_donor_profile. Return 404 if user not found, 403 if no access to any NPO the donor has activity in.
- [x] T018 [P] [US2] Create useDonorProfile hook in frontend/fundrbolt-admin/src/features/donor-dashboard/hooks/useDonorDashboard.ts — TanStack Query calling getDonorProfile(userId, eventId, npoId). Enabled only when userId is set.
- [x] T019 [US2] Create DonorProfilePanel component in frontend/fundrbolt-admin/src/features/donor-dashboard/components/DonorProfilePanel.tsx — slide-out panel or full-page view. Sections: Contact Info (name, email, phone, active status), Event History (table with event name, date, NPO, checked-in, giving at event — group by NPO for cross-NPO), Bid History (table: item, amount, status, type, event, date), Donation History (table: amount, source, event, date), Ticket History (table: package, qty, price, event, date), Category Interests (bar chart via Recharts — bid count by category), Outbid Summary (stats cards: outbid amount, win rate, items won/lost).
- [x] T020 [US2] Wire DonorProfilePanel into DonorDashboardPage — when a donor is selected (click in leaderboard), open profile panel. Respect current scope (This Event / All Events). Add back/close button.

**Checkpoint**: Can click any donor and see full activity profile scoped to current selection.

---

## Phase 5: User Story 3 — Outbid & Untapped Potential Analysis (Priority: P2)

**Goal**: Rank donors by outbid amount to identify untapped spending potential.

**Independent Test**: View Outbid Leaders tab, verify ranking matches expected outbid calculations.

### Implementation for User Story 3

- [x] T021 [US3] Implement get_outbid_leaders in backend/app/services/donor_dashboard_service.py — CTE to find winning bid per AuctionItem, join donor's max bid per item where bid_status = OUTBID (exclude CANCELLED/WITHDRAWN per FR-015), sum outbid amounts per donor. Also compute items_bid_on, items_won, items_lost, win_rate. Paginate. Filter by event/NPO scope.
- [x] T022 [US3] Wire GET /outbid-leaders endpoint in backend/app/api/v1/admin_donor_dashboard.py — resolve access, call service, return OutbidLeadersResponse.
- [x] T023 [P] [US3] Create useOutbidLeaders hook in frontend/fundrbolt-admin/src/features/donor-dashboard/hooks/useDonorDashboard.ts — TanStack Query for outbid leaders endpoint.
- [x] T024 [US3] Create OutbidLeadersTab component in frontend/fundrbolt-admin/src/features/donor-dashboard/components/OutbidLeadersTab.tsx — table: Rank, Name, Outbid Amount, Items Bid On, Items Won, Items Lost, Win Rate. Click row opens DonorProfilePanel. Pagination.
- [x] T025 [US3] Wire OutbidLeadersTab into DonorDashboardPage tab navigation — renders when "Outbid Leaders" tab is selected.

**Checkpoint**: Outbid Leaders tab shows correctly ranked donors, click-through to profile works.

---

## Phase 6: User Story 4 — Bid War Engagement Analysis (Priority: P2)

**Goal**: Identify donors with competitive bidding patterns (3+ bids per item).

**Independent Test**: View Bid Wars tab, verify donors with 3+ bids per item appear correctly.

### Implementation for User Story 4

- [x] T026 [US4] Implement get_bid_wars in backend/app/services/donor_dashboard_service.py — GROUP BY (user_id, auction_item_id) from AuctionBid, HAVING count >= 3. Re-group by user_id for bid_war_count. Include top_war_items (top 5 items by bid count) with item title, bid count, highest bid, won status. Paginate. Filter by event/NPO scope.
- [x] T027 [US4] Wire GET /bid-wars endpoint in backend/app/api/v1/admin_donor_dashboard.py — resolve access, call service, return BidWarsResponse.
- [x] T028 [P] [US4] Create useBidWars hook in frontend/fundrbolt-admin/src/features/donor-dashboard/hooks/useDonorDashboard.ts — TanStack Query for bid wars endpoint.
- [x] T029 [US4] Create BidWarsTab component in frontend/fundrbolt-admin/src/features/donor-dashboard/components/BidWarsTab.tsx — table: Rank, Name, Bid War Count, Total Bids in Wars. Expandable row showing top_war_items (item title, bid count, highest bid, won). Pagination. Click name opens DonorProfilePanel.
- [x] T030 [US4] Wire BidWarsTab into DonorDashboardPage tab navigation.

**Checkpoint**: Bid Wars tab identifies competitive bidders accurately.

---

## Phase 7: User Story 5 — Giving by Category Visualization (Priority: P3)

**Goal**: Charts showing giving breakdown by type and auction item category.

**Independent Test**: View Categories tab, verify chart totals match aggregated data.

### Implementation for User Story 5

- [x] T031 [US5] Implement get_category_breakdown in backend/app/services/donor_dashboard_service.py — compute giving_type_breakdown (sum per category: tickets, donations_paddle_raise, silent_auction, live_auction, buy_now with donor_count per category) and auction_category_breakdown (aggregate by AuctionItem.category: total_bid_amount, total_revenue from winning bids, bid_count, item_count). Filter by event/NPO scope.
- [x] T032 [US5] Wire GET /category-breakdown endpoint in backend/app/api/v1/admin_donor_dashboard.py — resolve access, call service, return CategoryBreakdownResponse.
- [x] T033 [P] [US5] Create useCategoryBreakdown hook in frontend/fundrbolt-admin/src/features/donor-dashboard/hooks/useDonorDashboard.ts — TanStack Query for category breakdown endpoint.
- [x] T034 [US5] Create GivingCategoryCharts component in frontend/fundrbolt-admin/src/features/donor-dashboard/components/GivingCategoryCharts.tsx — two charts: (1) Pie/bar chart of giving type breakdown (tickets, donations, silent, live, buy-now) showing amounts and donor counts, (2) Bar chart of auction category breakdown (Experiences, Dining, Travel, etc.) showing bid activity and revenue. Use Recharts (PieChart, BarChart, ResponsiveContainer).
- [x] T035 [US5] Wire GivingCategoryCharts into DonorDashboardPage tab navigation as "Categories" tab.

**Checkpoint**: Category charts render with accurate aggregated data.

---

## Phase 8: User Story 6 — Cross-NPO Donor View (Priority: P3)

**Goal**: Super Admin/Auctioneer see donor activity across all accessible NPOs, grouped by NPO.

**Independent Test**: Log in as Super Admin, select donor with multi-NPO activity, verify grouped display.

### Implementation for User Story 6

- [x] T036 [US6] Update get_donor_profile in backend/app/services/donor_dashboard_service.py — when accessible_npo_ids contains multiple NPOs, group event_history by NPO (npo_id, npo_name). Ensure bid_history, donation_history, ticket_history include npo context. The existing profile endpoint already accepts npo_id filter — when omitted by Super Admin/Auctioneer, return cross-NPO data.
- [x] T037 [US6] Update DonorProfilePanel in frontend/fundrbolt-admin/src/features/donor-dashboard/components/DonorProfilePanel.tsx — when event_history contains multiple NPOs, render grouped sections with NPO name headers. Show NPO badge on each activity row.
- [x] T038 [US6] Update get_leaderboard in backend/app/services/donor_dashboard_service.py — when accessible_npo_ids contains multiple NPOs and no npo_id filter, aggregate across all accessible NPOs. Ensure donor appears once with cross-NPO totals.

**Checkpoint**: Cross-NPO view works for Super Admin/Auctioneer, data is correctly scoped.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: CSV export, empty states, final integration quality.

- [x] T039 [P] Implement export_leaderboard_csv in backend/app/services/donor_dashboard_service.py — StreamingResponse generating CSV with headers matching leaderboard columns. Same query as get_leaderboard but no pagination. Content-Disposition header for download.
- [x] T040 Wire GET /leaderboard/export endpoint in backend/app/api/v1/admin_donor_dashboard.py — resolve access, call service.export_leaderboard_csv, return StreamingResponse with media_type="text/csv".
- [x] T041 [P] Add CSV export button to DonorLeaderboard component in frontend/fundrbolt-admin/src/features/donor-dashboard/components/DonorLeaderboard.tsx — download button that triggers export endpoint with current scope/sort params. Use window.open or fetch+blob download pattern.
- [x] T042 [P] Add empty states to all dashboard tabs — DonorLeaderboard, OutbidLeadersTab, BidWarsTab, GivingCategoryCharts, DonorProfilePanel. Show friendly message when no data exists for the selected scope.
- [x] T043 [P] Add loading states/skeletons to all dashboard components — use existing loading patterns from event-dashboard feature.
- [x] T044 Run backend CI checks: ruff check, ruff format --check, mypy strict, pytest

**Checkpoint**: Feature complete with export, empty states, and passing CI.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001-T004) — BLOCKS all user stories
- **US1 Leaderboard (Phase 3)**: Depends on Foundational — MVP delivery
- **US2 Donor Profile (Phase 4)**: Depends on Foundational — can parallel with US1 backend, but frontend click-through needs US1 leaderboard
- **US3 Outbid Leaders (Phase 5)**: Depends on Foundational — independent from US1/US2
- **US4 Bid Wars (Phase 6)**: Depends on Foundational — independent from US1/US2/US3
- **US5 Category Charts (Phase 7)**: Depends on Foundational — independent
- **US6 Cross-NPO (Phase 8)**: Depends on US1 + US2 (extends existing service methods)
- **Polish (Phase 9)**: Depends on US1 (leaderboard for export) — can start after US1

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2
- **US2 (P1)**: Frontend depends on US1 leaderboard for click-through; backend independent
- **US3 (P2)**: Fully independent
- **US4 (P2)**: Fully independent
- **US5 (P3)**: Fully independent
- **US6 (P3)**: Extends US1 + US2 service/components

### Parallel Opportunities

- T005, T006 can run parallel with T001-T004
- T011, T012 can run parallel with T009, T010
- T023, T028, T033 (hooks) can all be created in parallel
- US3, US4, US5 backend implementations can all run in parallel
- T039, T041, T042, T043 (polish) can all run in parallel

---

## Implementation Strategy

**MVP (Ship First)**: Phase 1 + 2 + 3 (Leaderboard with scope toggle)
**Iteration 2**: Phase 4 (Donor Profile drill-down)
**Iteration 3**: Phase 5 + 6 in parallel (Outbid Leaders + Bid Wars)
**Iteration 4**: Phase 7 + 8 (Category Charts + Cross-NPO)
**Final**: Phase 9 (Polish)

**Total Tasks**: 44
**Per User Story**: US1=7, US2=5, US3=5, US4=5, US5=5, US6=3, Setup=6, Foundation=2, Polish=6
