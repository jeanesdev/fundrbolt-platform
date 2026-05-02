# Tasks: Revenue Generators

**Input**: Design documents from `/specs/042-revenue-generators/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in spec — test tasks omitted.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

## Path Conventions
- **Backend models**: `backend/app/models/`
- **Backend schemas**: `backend/app/schemas/`
- **Backend services**: `backend/app/services/`
- **Backend API**: `backend/app/api/v1/`
- **Backend migrations**: `backend/alembic/versions/`
- **Admin frontend features**: `frontend/fundrbolt-admin/src/features/`
- **Admin frontend services**: `frontend/fundrbolt-admin/src/services/`
- **Donor PWA features**: `frontend/donor-pwa/src/features/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migration, model registration, and router registration. These must be complete before any feature work begins.

- [ ] T001 Create Alembic migration `backend/alembic/versions/042_add_revenue_generator_tables.py` — create `revenue_generator_winner_method` PostgreSQL ENUM (`random_draw`, `manual`); create `revenue_generator_items` table with all columns and CHECK constraint (price_per_entry > 0) and index on event_id; create `revenue_generator_entries` table with all columns and indexes on item_id and event_id; create `revenue_generator_winner_selections` table with all columns and index on item_id
- [ ] T002 [P] Create `RevenueGeneratorItem` SQLAlchemy model using UUIDMixin + TimestampMixin in `backend/app/models/revenue_generator_item.py`
- [ ] T003 [P] Create `RevenueGeneratorEntry` SQLAlchemy model using UUIDMixin + TimestampMixin in `backend/app/models/revenue_generator_entry.py`
- [ ] T004 [P] Create `RevenueGeneratorWinnerSelection` SQLAlchemy model using UUIDMixin + TimestampMixin in `backend/app/models/revenue_generator_winner_selection.py`
- [ ] T005 Register all three new models in `backend/app/models/__init__.py`
- [ ] T006 [P] Create `RevenueGeneratorService` stub class (empty methods, type-annotated signatures) in `backend/app/services/revenue_generator_service.py` — methods: `get_visible_items`, `get_admin_items`, `create_item`, `update_item`, `delete_item`, `purchase_entry`, `get_entries_for_item`, `record_entry_quick`, `draw_winner`, `select_winner_manual`, `get_winner_history`, `get_event_dashboard_summary`
- [ ] T007 [P] Create Pydantic schemas in `backend/app/schemas/revenue_generator.py` — include: `RevenueGeneratorItemCreate`, `RevenueGeneratorItemUpdate`, `RevenueGeneratorItemAdminResponse`, `RevenueGeneratorItemDonorResponse`, `RevenueGeneratorEntryRow`, `RevenueGeneratorEntryListResponse`, `EntryPurchaseResponse`, `ManualWinnerSelectRequest`, `WinnerSelectionResponse`
- [ ] T008 Register admin revenue generators router in `backend/app/api/v1/__init__.py` (or main router include file)
- [ ] T009 Register donor revenue generators router in `backend/app/api/v1/__init__.py`

**Checkpoint**: Run `cd backend && poetry run alembic upgrade head` to verify migration. Models importable without error.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core service infrastructure shared by multiple user stories. Must be complete before US1–US6.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T010 Implement `RevenueGeneratorService.get_admin_items(event_id)` — query all items for event regardless of visibility, include total_entries and total_revenue aggregates (COUNT/SUM from revenue_generator_entries), include current winner (latest winner_selection by selected_at), in `backend/app/services/revenue_generator_service.py`
- [ ] T011 [P] Implement `RevenueGeneratorService.create_item(event_id, data, created_by)` — validate price > 0, set created_by from current user, return `RevenueGeneratorItemAdminResponse`, in `backend/app/services/revenue_generator_service.py`
- [ ] T012 [P] Implement `RevenueGeneratorService.update_item(item_id, data)` — partial update using Pydantic `model_dump(exclude_unset=True)`, validate price > 0 if provided, in `backend/app/services/revenue_generator_service.py`
- [ ] T013 [P] Implement `RevenueGeneratorService.delete_item(item_id)` — soft delete or hard delete per existing pattern for event items, in `backend/app/services/revenue_generator_service.py`

**Checkpoint**: Admin CRUD service methods callable and type-check clean. Run `cd backend && poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests'`.

---

## Phase 3: User Story 1 — Donor Purchases Entries via Play Tab (Priority: P1) 🎯 MVP

**Goal**: Authenticated donors can see visible Revenue Generator items and purchase entries. Each purchase increments their personal entry count. No aggregate totals are exposed to donors.

**Independent Test**: Create item → make visible → log in as donor → GET /events/{event_id}/revenue-generators → POST entry → verify `my_entry_count` increments. GET again → confirm count persists and no total_entries field returned.

### Implementation for User Story 1

- [ ] T014 [US1] Implement `RevenueGeneratorService.get_visible_items(event_id, donor_registration_guest_id)` — filter by `is_visible=true`, include `my_entry_count` (count of entries for this guest), include `current_winner_name` (denormalized from latest winner selection), in `backend/app/services/revenue_generator_service.py`
- [ ] T015 [US1] Implement `RevenueGeneratorService.purchase_entry(item_id, event_id, registration_guest_id, recorded_by_user_id=None)` — validate item is visible and open for entries (raise 409 if not), insert entry row with amount_paid=item.price_per_entry, return updated `my_entry_count`, in `backend/app/services/revenue_generator_service.py`
- [ ] T016 [US1] Create donor revenue generators API router in `backend/app/api/v1/donor_revenue_generators.py` — GET `/events/{event_id}/revenue-generators` (calls `get_visible_items`) and POST `/events/{event_id}/revenue-generators/{item_id}/entries` (calls `purchase_entry`); require authenticated donor; validate donor has registration_guest for event
- [ ] T017 [US1] Create `frontend/donor-pwa/src/features/play/PlayTab.tsx` — conditionally render tab only when GET /revenue-generators returns non-empty list; show list of `RevenueGeneratorCard` components; poll every 5 seconds to reflect visibility changes within SC-002 threshold
- [ ] T018 [US1] [P] Create `frontend/donor-pwa/src/features/play/RevenueGeneratorCard.tsx` — display item name, description, price per entry, donor's `my_entry_count` ("You have N entries"), purchase button (disabled when `is_open_for_entries=false` with "Entries closed" label), winner name banner when `current_winner_name` is set
- [ ] T019 [US1] [P] Create `frontend/donor-pwa/src/features/play/EntryPurchaseModal.tsx` — confirmation step before purchase (shows price); on confirm POST entry; on success show updated entry count; handle 409 (item closed) gracefully
- [ ] T020 [US1] [P] Create `frontend/donor-pwa/src/features/play/index.ts` — export PlayTab, RevenueGeneratorCard, EntryPurchaseModal

**Checkpoint**: Donor can purchase entries end-to-end. Play tab hidden when no visible items. Personal entry count visible. Aggregate count not exposed.

---

## Phase 4: User Story 2 — Admin Creates and Manages Items (Priority: P1) 🎯 MVP

**Goal**: Admin can create Revenue Generator items, toggle visibility and entry status independently, and see all items (visible and hidden) in the admin Revenue Generators tab.

**Independent Test**: Create item → verify appears in admin list → toggle `is_visible=true` → verify donor app shows item → toggle `is_visible=false` → verify donor app hides item. Toggle `is_open_for_entries=false` → verify visible but purchase disabled.

### Implementation for User Story 2

- [ ] T021 [US2] Create admin revenue generators API router in `backend/app/api/v1/admin_revenue_generators.py` — implement all 4 CRUD endpoints (list, create, patch, delete) per `contracts/admin-revenue-generators.yaml`; require admin role; validate event ownership via PermissionService
- [ ] T022 [US2] Create `frontend/fundrbolt-admin/src/services/revenueGeneratorService.ts` — typed API client for all admin revenue generator endpoints (list, create, update, delete, list entries, draw, manual winner, winner history)
- [ ] T023 [US2] Create `frontend/fundrbolt-admin/src/features/revenue-generators/RevenueGeneratorList.tsx` — tabular/card list of all RG items for event; columns: name, price, visibility badge, entry status badge, entry count, revenue; row actions: edit, delete, toggle visibility, toggle open/closed
- [ ] T024 [US2] [P] Create `frontend/fundrbolt-admin/src/features/revenue-generators/RevenueGeneratorForm.tsx` — create/edit form; fields: name (required), description, price_per_entry (required, > 0), display_order; renders inside modal or side panel consistent with event admin UI patterns
- [ ] T025 [US2] [P] Create `frontend/fundrbolt-admin/src/features/revenue-generators/index.ts` — export RevenueGeneratorList, RevenueGeneratorForm, RevenueGeneratorEntryList, WinnerSelectionModal
- [ ] T026 [US2] Wire Revenue Generators tab into the event admin navigation in `frontend/fundrbolt-admin/src/` (event management section) — tab label "Revenue Generators", renders `RevenueGeneratorList`

**Checkpoint**: Admin CRUD complete. Visibility and entry status toggles work. Donor app reflects toggle within 5s (polling). All items visible in admin tab regardless of visibility state.

---

## Phase 5: User Story 3 — Quick Entry for Revenue Generator Entries (Priority: P2)

**Goal**: Admin/staff can record entries on behalf of donors via the Quick Entry tool using a bidder number. Rapid back-to-back submissions without navigating away.

**Independent Test**: Open Quick Entry → Revenue Generators tab → select item → enter bidder number → submit → verify success and entry_count increments → submit again immediately → verify second entry recorded.

### Implementation for User Story 3

- [ ] T027 [US3] Add Quick Entry Revenue Generator schemas to `backend/app/schemas/quick_entry/schemas.py` — add `QuickEntryRevenueGeneratorItem`, `QuickEntryRevenueGeneratorEntryCreate`, `QuickEntryRevenueGeneratorEntryResponse`
- [ ] T028 [US3] Implement `RevenueGeneratorService.record_entry_quick(item_id, event_id, bidder_number, recorded_by_user_id)` — look up registration_guest by bidder_number for event (raise 409 if not found), validate item is open for entries (raise 409 if not), insert entry with `recorded_by_user_id` set, return confirmation with updated donor entry count, in `backend/app/services/revenue_generator_service.py`
- [ ] T029 [US3] Add Revenue Generators tab endpoints to `backend/app/api/v1/admin_quick_entry.py` — GET `/admin/events/{event_id}/quick-entry/revenue-generators` (list open items) and POST `/admin/events/{event_id}/quick-entry/revenue-generators/entry` (record one entry); follow existing tab pattern in this file; require admin/staff role via existing PermissionService check
- [ ] T030 [US3] Add Revenue Generators tab to admin Quick Entry frontend component — new tab alongside existing live-auction/paddle-raise tabs; item selector dropdown (items from GET quick-entry/revenue-generators), bidder number input, submit button; form stays active after successful submission (no navigate-away) showing success confirmation inline; in `frontend/fundrbolt-admin/src/features/` (quick-entry section, extend existing component)

**Checkpoint**: Quick Entry Revenue Generators tab functional. Invalid bidder number shows error. Valid submissions increment count. Rapid back-to-back submissions work without page reload.

---

## Phase 6: User Story 4 — Winner Selection (Priority: P2)

**Goal**: Admin and auctioneer can view all entries for an item and select a winner by random draw or manually. Full winner history preserved. Notification shortcut shown after selection.

**Independent Test**: Add entries for 2+ donors → click "Random Draw" → verify winner from entry pool → draw again → verify new winner and history has 2 records → manual select → verify selection_method=manual.

### Implementation for User Story 4

- [ ] T031 [US4] Implement `RevenueGeneratorService.get_entries_for_item(item_id)` — query all entries grouped by registration_guest, return donor name, bidder number, entry count, total paid, last purchased_at; for the admin entry list endpoint; in `backend/app/services/revenue_generator_service.py`
- [ ] T032 [US4] Implement `RevenueGeneratorService.draw_winner(item_id, selected_by_user_id)` — load all entries as flat list (one element per entry row), raise 409 if empty, use `random.choices(entries, k=1)[0]` for weighted random selection, insert winner_selection record with method=`random_draw`, return `WinnerSelectionResponse` with `winner_name` and `bidder_number` populated (frontend constructs notification URL per FR-014), in `backend/app/services/revenue_generator_service.py`
- [ ] T033 [US4] [P] Implement `RevenueGeneratorService.select_winner_manual(item_id, registration_guest_id, selected_by_user_id)` — validate guest has at least one entry for this item (raise 404 if not), select the guest's most recent entry as `winning_entry_id`, insert winner_selection record with method=`manual`, return `WinnerSelectionResponse` with `winner_name` and `bidder_number` populated (frontend constructs notification URL from these), in `backend/app/services/revenue_generator_service.py`
- [ ] T034 [US4] [P] Implement `RevenueGeneratorService.get_winner_history(item_id)` — return all winner selections ordered by selected_at DESC (most recent = current winner), in `backend/app/services/revenue_generator_service.py`
- [ ] T035 [US4] Add winner selection endpoints to `backend/app/api/v1/admin_revenue_generators.py` — GET entries list (with page/per_page params), POST draw, POST manual winner (request body: `registration_guest_id`), GET winner history; require admin or auctioneer role via PermissionService
- [ ] T036 [US4] Create `frontend/fundrbolt-admin/src/features/revenue-generators/RevenueGeneratorEntryList.tsx` — display full donor entry list (bidder number, donor name, entry count, total paid); "Random Draw" button; "History" section showing previous selections with timestamps and method; accessible from item row action in RevenueGeneratorList
- [ ] T037 [US4] [P] Create `frontend/fundrbolt-admin/src/features/revenue-generators/WinnerSelectionModal.tsx` — random draw confirmation dialog with animation/countdown; result display (winner name + bidder number); FR-014 notification shortcut: construct URL `/admin/events/{event_id}/notifications?prefill_bidder={bidder_number}&prefill_name={winner_name}` client-side from response `winner_name` and `bidder_number` fields and render as a prominent link button in the result view; manual selection mode to pick a specific donor from entry list (sends `registration_guest_id`)

**Checkpoint**: Random draw produces valid entry as winner. History preserved across multiple draws. Manual selection records correctly. Notification shortcut rendered after selection.

---

## Phase 7: User Story 5 — Revenue Generator Tallies in Event Dashboard (Priority: P3)

**Goal**: Event dashboard shows a dedicated Revenue Generators section with combined totals and per-item breakdown, separate from silent and live auction figures.

**Independent Test**: Record entries → GET admin event dashboard → verify `revenue_generators` section with total_entries, total_revenue, and per-item rows → confirm values do not appear in auction totals.

### Implementation for User Story 5

- [ ] T038 [US5] Implement `RevenueGeneratorService.get_event_dashboard_summary(event_id)` — return aggregate (total_entries COUNT, total_revenue SUM) and per-item list (name, entry count, revenue); in `backend/app/services/revenue_generator_service.py`
- [ ] T039 [US5] Integrate RG summary into `backend/app/services/event_dashboard_service.py` — call `get_event_dashboard_summary` and include result under a `revenue_generators` key in the dashboard response; ensure it is NOT summed into silent or live auction totals
- [ ] T040 [US5] Add `revenue_generators` field to event dashboard Pydantic response schema in `backend/app/schemas/` (extend existing dashboard schema)
- [ ] T041 [US5] Add Revenue Generators section to admin event dashboard frontend — summary card showing total entries and total revenue; per-item breakdown list; visually separate from auction sections; in `frontend/fundrbolt-admin/src/features/` (event dashboard section)

**Checkpoint**: Revenue Generators section appears in dashboard. Totals accurate. Values isolated from auction totals per SC-006.

---

## Phase 8: User Story 6 — Auctioneer Monitors Revenue Generator Activity (Priority: P3)

**Goal**: Auctioneer dashboard has a dedicated Revenue Generators tab with entry lists and revenue totals. Sticky header shows compact per-item cards.

**Independent Test**: Log in as auctioneer → navigate to auctioneer dashboard → Revenue Generators tab → verify items with entry counts and revenue → scroll dashboard → verify sticky header cards for each RG item.

### Implementation for User Story 6

- [ ] T042 [US6] Extend `backend/app/services/auctioneer_service.py` (or equivalent) to include Revenue Generator data — reuse `RevenueGeneratorService.get_admin_items(event_id)` for full item+entry+revenue data; include in auctioneer dashboard API response
- [ ] T043 [US6] Add `revenue_generators` field to auctioneer dashboard Pydantic response schema
- [ ] T044 [US6] Add Revenue Generators tab to auctioneer dashboard frontend — tab in `frontend/fundrbolt-admin/src/features/` (auctioneer section); per-item display: item name, donor entry list (bidder, name, count), total entries, revenue; polling interval consistent with existing auctioneer dashboard refresh
- [ ] T045 [US6] [P] Add Revenue Generator sticky header cards to auctioneer dashboard — one compact card per RG item showing item name, entry count, revenue; cards rendered in the existing sticky header component alongside other auctioneer cards; in `frontend/fundrbolt-admin/src/features/` (auctioneer section)

**Checkpoint**: Auctioneer tab present and accurate. Sticky header cards visible while scrolling. Data refreshes near-real-time via existing polling.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Agent context update, documentation, and spec housekeeping after all user stories are complete.

- [ ] T046 [P] Update agent context: `cd /home/jjeanes/dev/fundrbolt-platform && .specify/scripts/bash/update-agent-context.sh copilot`
- [ ] T047 [P] Update `.specify/PARKING_LOT.md` if any out-of-scope items were identified during implementation
- [ ] T048 Run full CI suite: `cd backend && poetry run ruff check . && poetry run ruff format --check . && poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests' && poetry run pytest -v --tb=short`
- [ ] T049 [P] Run frontend CI: `cd frontend/fundrbolt-admin && pnpm lint && pnpm format:check && pnpm build`
- [ ] T050 [P] Validate quickstart.md scenarios against running local environment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — P1 priority, start first
- **US2 (Phase 4)**: Depends on Phase 2 — P1 priority, can run in parallel with US1
- **US3 (Phase 5)**: Depends on Phase 2 + US1 entry recording pattern established — P2
- **US4 (Phase 6)**: Depends on Phase 2 + US1 (entries must exist to select from) — P2
- **US5 (Phase 7)**: Depends on Phase 2 + US1 (entries needed for tallies) — P3
- **US6 (Phase 8)**: Depends on Phase 2 + US1 + US5 dashboard patterns — P3
- **Polish (Phase N)**: Depends on all desired user stories being complete

### Parallel Opportunities Within Phases

- T002, T003, T004 (model creation) — parallel, different files
- T006, T007 (schemas + service stub) — parallel, different files
- T011, T012, T013 (service CRUD methods) — parallel, same file but independent methods
- T018, T019, T020 (donor PWA components) — parallel, different files
- T023, T024, T025 (admin components) — parallel, different files
- T032, T033, T034 (winner service methods) — parallel, same file but independent methods
- T036, T037 (winner UI components) — parallel, different files

### Implementation Strategy: MVP First

1. Complete Phase 1 + Phase 2 (foundation)
2. Complete Phase 3 + Phase 4 (US1 + US2 — both P1, deploy together)
3. **STOP and VALIDATE**: donor purchase flow + admin management fully functional
4. Complete Phase 5 + Phase 6 (US3 + US4 — both P2)
5. Complete Phase 7 + Phase 8 (US5 + US6 — both P3)
6. Polish phase

---

## Notes

- No test tasks — spec does not request automated tests for this feature
- [P] tasks = different files, no dependencies; safe to parallelize
- User story labels ([US1]–[US6]) map each task to spec traceability
- `WinnerSelectionResponse.notifications_url` must be included in draw and manual-select responses (FR-014)
- RG entries recorded via Quick Entry and via donor app are identical in the DB — only `recorded_by_user_id` distinguishes them
- `is_visible=false` hides item from donor entirely (FR-006a); `is_open_for_entries=false` keeps item visible but disables purchase (FR-006b)
