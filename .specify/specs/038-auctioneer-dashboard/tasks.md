# Tasks: Auctioneer Dashboard

**Input**: Design documents from `/specs/038-auctioneer-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-contracts.md

**Tests**: Not explicitly requested — test tasks omitted.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Backend**: `backend/app/`
- **Frontend**: `frontend/fundrbolt-admin/src/`
- **Migrations**: `backend/alembic/versions/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migration, new models, and role system updates

- [ ] T001 Create Alembic migration to add auctioneer role to roles table (including seed row insert), add AUCTIONEER to MemberRole enum, create auctioneer_item_commissions table, create auctioneer_event_settings table, add live_auction_start_datetime column to events, in backend/alembic/versions/038_add_auctioneer_role_and_tables.py
- [ ] T002 [P] Create AuctioneerItemCommission and AuctioneerEventSettings SQLAlchemy models in backend/app/models/auctioneer.py
- [ ] T003 [P] Map existing auction_close_datetime column and add live_auction_start_datetime to Event model in backend/app/models/event.py
- [ ] T004 [P] Add AUCTIONEER value to MemberRole enum in backend/app/models/npo_member.py
- [ ] T005 Register new models in backend/app/models/__init__.py

**Checkpoint**: Database schema and models ready. Run `poetry run alembic upgrade head` to verify migration.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Permission system updates and shared service infrastructure that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Update PermissionService to recognize auctioneer role: add to ROLES_CAN_VIEW_USERS, add auctioneer-specific permission checks (can_view_event, can_edit_auction_items), add commission data visibility check (auctioneer + super_admin only) in backend/app/services/permission_service.py
- [ ] T007 Update NPOPermissionService to handle AUCTIONEER member role: add to permission matrix (read-only for most sections, edit for auction items) in backend/app/services/npo_permission_service.py
- [ ] T008 [P] Create Pydantic request/response schemas for auctioneer commissions, settings, dashboard, and live auction in backend/app/schemas/auctioneer.py
- [ ] T009 [P] Create AuctioneerService with commission CRUD methods (create/update/delete commission, get commissions for event, upsert event settings, get event settings) in backend/app/services/auctioneer_service.py

**Checkpoint**: Permission checks and core service methods ready. Auctioneer role can be assigned and permission-checked.

---

## Phase 3: User Story 1 - Auctioneer Role & Invitation-Only Sign Up (Priority: P1) 🎯 MVP

**Goal**: NPO Admin can invite an auctioneer via link; auctioneer signs up, gets associated with NPO and event, has correct read-only/edit permissions.

**Independent Test**: Generate auctioneer invitation as NPO Admin, accept as new user, verify access to event admin sections with correct read/write restrictions.

### Implementation for User Story 1

- [ ] T010 [US1] Extend invitation creation to accept role="auctioneer" with required event_id parameter. Embed event_id in JWT token payload. Validate event has not ended (reject with 422 if event status is past/ended). Update validation in backend/app/services/invitation_service.py
- [ ] T011 [US1] Update invitation acceptance flow to handle auctioneer role: create NPOMember with role=AUCTIONEER, set user.role_name="auctioneer" and user.npo_id on acceptance. Validate event has not ended at acceptance time (reject with clear error). If user already has NPOMember for this NPO, update role to AUCTIONEER (do not create duplicate). In backend/app/api/v1/invitations.py
- [ ] T012 [US1] Add auctioneer role to admin UI role checks: grant read-only access to event details, registrants, sponsors, tickets, seating, event dashboard; grant edit access to auction items. Update role-based route guards and navigation visibility in frontend/fundrbolt-admin/src/lib/permissions.ts (or equivalent permission utility)
- [ ] T013 [US1] Update admin frontend invitation form to include "Auctioneer" role option with required event selector dropdown in frontend/fundrbolt-admin/src/features/npo-management/components/ (invitation form component)
- [ ] T014 [US1] Update frontend invitation acceptance page to handle auctioneer role display (role badge, event name context) in frontend/fundrbolt-admin/src/pages/invitations/accept-invitation.tsx

**Checkpoint**: Auctioneer can be invited, sign up, and navigate admin with correct permissions. This is the MVP.

---

## Phase 4: User Story 2 - Commission & Fee Tracking on Auction Items (Priority: P2)

**Goal**: Auctioneer can enter commission %, flat fee, and notes on each auction item. Data visible only to owning auctioneer and Super Admins.

**Independent Test**: Sign in as auctioneer, navigate to auction item, enter commission/fee/notes, verify saved. Sign in as different role, verify commission fields are hidden.

### Implementation for User Story 2

- [ ] T015 [US2] Create auctioneer commission API endpoints: GET /admin/events/{event_id}/auctioneer/commissions, PUT /admin/events/{event_id}/auctioneer/commissions/{auction_item_id}, DELETE /admin/events/{event_id}/auctioneer/commissions/{auction_item_id} in backend/app/api/v1/admin_auctioneer.py
- [ ] T016 [US2] Register auctioneer API router in backend/app/api/v1/__init__.py (or main router file)
- [ ] T017 [US2] Add earnings calculation methods to AuctioneerService: calculate per-item earnings (winning_bid × commission_% + flat_fee), exclude withdrawn/cancelled items in backend/app/services/auctioneer_service.py
- [ ] T018 [US2] Create commission entry UI component that shows on auction item detail page when user is auctioneer: commission_percent input (0-100%, required), flat_fee input (non-negative, required), notes textarea (max 2000 chars), save/delete buttons with frontend validation matching API rules in frontend/fundrbolt-admin/src/features/auctioneer/components/ItemCommissionForm.tsx
- [ ] T019 [US2] Create API client functions for commission CRUD operations in frontend/fundrbolt-admin/src/features/auctioneer/api/auctioneerApi.ts
- [ ] T020 [US2] Integrate ItemCommissionForm into existing auction item detail page, conditionally rendered for auctioneer and super_admin roles only, in frontend/fundrbolt-admin/src/features/auction-items/ (auction item detail component)

**Checkpoint**: Auctioneer can manage commissions on items. Commission data is role-restricted.

---

## Phase 5: User Story 3 - Auctioneer Earnings Dashboard (Priority: P3)

**Goal**: Dedicated dashboard showing category percentages, earnings total, item commission gallery, and event revenue totals.

**Independent Test**: Sign in as auctioneer with commissions set, enter category percentages, verify earnings totals are accurate and match manual calculation.

### Implementation for User Story 3

- [ ] T021 [US3] Add auctioneer event settings API endpoints: GET and PUT /admin/events/{event_id}/auctioneer/settings in backend/app/api/v1/admin_auctioneer.py
- [ ] T022 [US3] Add dashboard API endpoint: GET /admin/events/{event_id}/auctioneer/dashboard with earnings calculation (per-item + category-level, no double-counting), event revenue totals (live/paddle/silent/total), and timer data in backend/app/api/v1/admin_auctioneer.py
- [ ] T023 [US3] Implement dashboard earnings aggregation in AuctioneerService: query winning bids (exclude withdrawn, cancelled, and refunded items), calculate category pools excluding commissioned items, apply category percentages, sum totals from existing event_dashboard_service patterns in backend/app/services/auctioneer_service.py
- [ ] T024 [P] [US3] Create CategoryPercentages component for entering live auction %, paddle raise %, silent auction % with save functionality in frontend/fundrbolt-admin/src/features/auctioneer/components/CategoryPercentages.tsx
- [ ] T025 [P] [US3] Create EarningsSummary component showing total earnings, per-item subtotal, and per-category subtotals in frontend/fundrbolt-admin/src/features/auctioneer/components/EarningsSummary.tsx
- [ ] T026 [P] [US3] Create CommissionGallery component showing item cards with image, title, commission %, flat fee, quantity remaining, cost to NPO in frontend/fundrbolt-admin/src/features/auctioneer/components/CommissionGallery.tsx
- [ ] T027 [P] [US3] Create EventTotals component showing live auction, paddle raise, silent auction, and event total raised amounts in frontend/fundrbolt-admin/src/features/auctioneer/components/EventTotals.tsx
- [ ] T028 [US3] Create useAuctioneerEarnings hook for fetching dashboard data with auto-refresh (60s interval) in frontend/fundrbolt-admin/src/features/auctioneer/hooks/useAuctioneerEarnings.ts
- [ ] T029 [US3] Create AuctioneerDashboardPage composing EarningsSummary, CategoryPercentages, CommissionGallery, and EventTotals with tab navigation in frontend/fundrbolt-admin/src/features/auctioneer/pages/AuctioneerDashboardPage.tsx
- [ ] T030 [US3] Add auctioneer dashboard route at /events/$eventSlug/auctioneer, accessible to auctioneer and super_admin roles only, in frontend/fundrbolt-admin/src/routes/_authenticated/events/$eventSlug/auctioneer/index.tsx
- [ ] T031 [US3] Add "Auctioneer Dashboard" navigation item to event sidebar, visible only for auctioneer and super_admin roles, in frontend/fundrbolt-admin/src/components/layout/ (sidebar/navigation component)

**Checkpoint**: Auctioneer has a dedicated dashboard with accurate earnings. Category percentages are configurable.

---

## Phase 6: User Story 4 - Live Auction Tab (Priority: P4)

**Goal**: Live Auction tab showing current item, high bidder details, bid history, and real-time updates via Socket.IO.

**Independent Test**: Start live auction, place bids from multiple donors, verify auctioneer sees current item, high bidder (bidder #, name, table #, profile pic), and bid history updating in real time.

### Implementation for User Story 4

- [ ] T032 [US4] Add live auction API endpoint: GET /admin/events/{event_id}/auctioneer/live-auction returning current live item, high bidder details (bidder_number, name, table_number, profile_picture_url), bid history in backend/app/api/v1/admin_auctioneer.py
- [ ] T033 [US4] Implement live auction query logic in AuctioneerService: find current live item (most recently opened item with auction_type=LIVE and bidding_open=True), get winning bid with user details and registration_guest for bidder_number/table_number, get bid history ordered by placed_at in backend/app/services/auctioneer_service.py
- [ ] T034 [US4] Add Socket.IO event emission for auction:bid_placed and auction:item_changed to event-wide room (event:{event_id}) when bids are placed on live items in backend/app/websocket/notification_ws.py
- [ ] T035 [US4] Integrate Socket.IO bid emission into bid placement service: emit auction:bid_placed after successful bid on LIVE auction item in backend/app/services/ (bid service or quick entry service)
- [ ] T036 [P] [US4] Create CurrentItemCard component displaying live auction item details (title, image, starting bid, current bid) in frontend/fundrbolt-admin/src/features/auctioneer/components/CurrentItemCard.tsx
- [ ] T037 [P] [US4] Create HighBidderCard component displaying bidder number, full name, table number, and profile picture in frontend/fundrbolt-admin/src/features/auctioneer/components/HighBidderCard.tsx
- [ ] T038 [P] [US4] Create BidHistory component displaying chronological list of bids with bidder number, name, amount, timestamp in frontend/fundrbolt-admin/src/features/auctioneer/components/BidHistory.tsx
- [ ] T039 [US4] Create useLiveAuctionBids hook subscribing to Socket.IO auction:bid_placed and auction:item_changed events, with fallback polling (5s) in frontend/fundrbolt-admin/src/features/auctioneer/hooks/useLiveAuctionBids.ts
- [ ] T040 [US4] Create LiveAuctionTab page composing CurrentItemCard, HighBidderCard, BidHistory with real-time updates and empty state for no active auction in frontend/fundrbolt-admin/src/features/auctioneer/pages/LiveAuctionTab.tsx
- [ ] T041 [US4] Add Live Auction tab route at /events/$eventSlug/auctioneer/live and integrate as tab within auctioneer dashboard navigation in frontend/fundrbolt-admin/src/routes/_authenticated/events/$eventSlug/auctioneer/live.tsx

**Checkpoint**: Auctioneer can see live auction activity in real time with bidder details.

---

## Phase 7: User Story 5 - Event Timing Countdowns (Priority: P5)

**Goal**: Persistent countdown timers for live auction start and silent auction end, visible across all dashboard views.

**Independent Test**: Set live_auction_start_datetime and auction_close_datetime on event, verify countdowns display accurately and persist across tab navigation.

### Implementation for User Story 5

- [ ] T042 [US5] Add live_auction_start_datetime and auction_close_datetime to event admin edit form so coordinators can set these times in frontend/fundrbolt-admin/src/features/event-management/ (event edit form component)
- [ ] T043 [US5] Update event update API schema to accept live_auction_start_datetime and auction_close_datetime fields in backend/app/schemas/event.py
- [ ] T044 [US5] Create CountdownTimers component showing time remaining until live auction start and silent auction end, with status labels (not started/in progress/ended), hidden when times not configured in frontend/fundrbolt-admin/src/features/auctioneer/components/CountdownTimers.tsx
- [ ] T045 [US5] Integrate CountdownTimers into AuctioneerDashboardPage as a persistent header element visible across all tabs in frontend/fundrbolt-admin/src/features/auctioneer/pages/AuctioneerDashboardPage.tsx

**Checkpoint**: Countdown timers visible and accurate across the auctioneer dashboard.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, validation, and cleanup

- [ ] T046 [P] Add auctioneer role to OpenAPI documentation tags and endpoint descriptions in backend/app/main.py
- [ ] T047 [P] Add audit logging for auctioneer commission creates/updates/deletes in backend/app/services/auctioneer_service.py
- [ ] T048 Verify all auctioneer endpoints enforce role-based access control (auctioneer + super_admin for commission data, read-only for other admin sections) across backend/app/api/v1/admin_auctioneer.py
- [ ] T049 Run quickstart.md validation: create auctioneer via invitation, set commissions, check dashboard earnings, verify live auction tab

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (models + migration must exist)
- **User Story 1 (Phase 3)**: Depends on Phase 2 (permissions must be in place)
- **User Story 2 (Phase 4)**: Depends on Phase 2, benefits from US1 for testing with real auctioneer user
- **User Story 3 (Phase 5)**: Depends on Phase 2, uses US2 commission data for earnings calculation
- **User Story 4 (Phase 6)**: Depends on Phase 2, independent of US2/US3
- **User Story 5 (Phase 7)**: Depends on Phase 2, independent of other stories
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundation only — MVP standalone
- **US2 (P2)**: Foundation only — can run in parallel with US1
- **US3 (P3)**: Benefits from US2 (commission data drives earnings) but can show empty state without it
- **US4 (P4)**: Foundation only — fully independent
- **US5 (P5)**: Foundation only — fully independent

### Parallel Opportunities

- T002, T003, T004 can run in parallel (different model files)
- T006, T007 are independent (different permission services)
- T008, T009 can run in parallel (schemas vs service)
- T024, T025, T026, T027 can run in parallel (independent UI components)
- T036, T037, T038 can run in parallel (independent UI components)
- US1 and US2 can be worked on in parallel after Phase 2
- US4 and US5 can be worked on in parallel after Phase 2

---

## Parallel Example: User Story 3

```bash
# Launch independent UI components together:
Task: "Create CategoryPercentages component" (T024)
Task: "Create EarningsSummary component" (T025)
Task: "Create CommissionGallery component" (T026)
Task: "Create EventTotals component" (T027)

# Then compose them:
Task: "Create AuctioneerDashboardPage" (T029) — depends on T024-T027
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational (T006–T009)
3. Complete Phase 3: User Story 1 (T010–T014)
4. **STOP and VALIDATE**: Auctioneer can sign up via invitation link, navigate admin with correct permissions
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Schema and permissions ready
2. US1 → Auctioneer role working → MVP! Deploy
3. US2 → Commission tracking working → Deploy
4. US3 → Earnings dashboard → Deploy
5. US4 → Live auction tab → Deploy
6. US5 → Countdown timers → Deploy
7. Polish → Final cleanup → Deploy

---

## Notes

- Total tasks: 49
- US1: 5 tasks, US2: 6 tasks, US3: 8 tasks, US4: 10 tasks, US5: 4 tasks
- Setup: 5 tasks, Foundational: 4 tasks, Polish: 4 tasks
- Key parallel opportunities: 7 groups of parallelizable tasks
- MVP scope: Phases 1-3 (14 tasks)
