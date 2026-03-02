# Tasks: Quick Bid Entry

**Input**: Design documents from `/specs/029-quick-bid-entry/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Include validation tasks from quickstart and CI-aligned checks; no test-first/TDD tasks were requested explicitly in the spec.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Backend: `backend/app/`, `backend/app/tests/`, `backend/alembic/versions/`
- Frontend: `frontend/fundrbolt-admin/src/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare quick-entry module scaffolding in backend and admin frontend.

- [X] T001 Create quick-entry feature folder scaffolding in `frontend/fundrbolt-admin/src/features/quick-entry/` (components, hooks, api, types)
- [X] T002 Create backend quick-entry module placeholders in `backend/app/services/quick_entry/` and `backend/app/schemas/quick_entry/`
- [X] T003 [P] Add quick-entry route placeholder in `frontend/fundrbolt-admin/src/routes/_authenticated/events/$eventId/quick-entry.tsx`
- [X] T004 [P] Add quick-entry API router placeholder in `backend/app/api/v1/admin_quick_entry.py`
- [X] T005 Wire router exports for quick-entry in `backend/app/api/v1/__init__.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared domain and API foundations required by all user stories.

**⚠️ CRITICAL**: No user story work should start until this phase is complete.

- [X] T006 Create Alembic migration for quick-entry persistence and indexes in `backend/alembic/versions/*_quick_entry_tables.py`
- [X] T007 [P] Implement SQLAlchemy model for live quick-entry bids in `backend/app/models/quick_entry_bid.py`
- [X] T008 [P] Implement SQLAlchemy model for paddle raise quick-entry donations in `backend/app/models/quick_entry_donation.py`
- [X] T009 [P] Implement SQLAlchemy model for donation label links in `backend/app/models/quick_entry_donation_label.py`
- [X] T010 Update model exports/relationships in `backend/app/models/__init__.py` and related existing models referencing event/bidder/donation entities
- [X] T011 Implement shared Pydantic request/response schemas in `backend/app/schemas/quick_entry/schemas.py`
- [X] T012 Implement role guard helper for quick-entry roles (Super Admin/NPO Admin/NPO Staff) in `backend/app/services/permission_service.py`
- [X] T013 Implement shared quick-entry service base (bidder lookup, amount validation, audit logging helpers) in `backend/app/services/quick_entry/service_base.py`
- [X] T014 Add quick-entry API router registration in `backend/app/main.py` (or central API registration module used by v1 routes)

**Checkpoint**: Foundation is complete and user stories can proceed.

---

## Phase 3: User Story 1 - Rapid live auction bid capture (Priority: P1) 🎯 MVP

**Goal**: Enable keyboard-first creation of live auction bids for a selected item with unmatched bidder rejection and deterministic first-in tie behavior.

**Independent Test**: Select a live auction item, enter repeated amount/bidder pairs using keyboard-only flow, and confirm bids are created with proper formatting/focus behavior and rejected when bidder is unmatched.

### Implementation for User Story 1

- [X] T015 [US1] Implement live bid creation service method (validation, bidder lookup reject, first-in ranking metadata) in `backend/app/services/quick_entry/live_auction_service.py`
- [X] T016 [US1] Implement `POST /admin/events/{event_id}/quick-entry/live-auction/bids` endpoint in `backend/app/api/v1/admin_quick_entry.py`
- [X] T017 [P] [US1] Add backend contract test for live bid create success/error paths in `backend/app/tests/contract/test_admin_quick_entry_live_bids.py`
- [X] T018 [P] [US1] Add backend integration test for unmatched bidder rejection and no-record behavior in `backend/app/tests/integration/test_quick_entry_live_bids.py`
- [X] T019 [P] [US1] Implement quick-entry API client methods for live bid create in `frontend/fundrbolt-admin/src/features/quick-entry/api/quickEntryApi.ts`
- [X] T020 [P] [US1] Build live mode entry form component (amount + bidder fields, formatting, keyboard focus cycle) in `frontend/fundrbolt-admin/src/features/quick-entry/components/LiveBidEntryForm.tsx`
- [X] T021 [US1] Implement quick-entry page route shell with mode selector and live item selector in `frontend/fundrbolt-admin/src/routes/_authenticated/events/$eventId/quick-entry.tsx`
- [X] T022 [US1] Connect live form submit flow (Enter/Tab behavior, reset/refocus, error toast/state) in `frontend/fundrbolt-admin/src/features/quick-entry/hooks/useLiveBidEntry.ts`

**Checkpoint**: US1 is fully functional and independently testable as MVP.

---

## Phase 4: User Story 2 - Live auction control and visibility (Priority: P2)

**Goal**: Show live bid log and metrics, allow bid deletion, and assign winner to highest valid bid with confirmation.

**Independent Test**: Enter multiple bids, verify current bid/unique bidder metrics and log details, delete one bid, then assign winner and confirm highest valid bid is selected.

### Implementation for User Story 2

- [X] T023 [US2] Implement live summary and bid-log query service methods in `backend/app/services/quick_entry/live_auction_service.py`
- [X] T024 [US2] Implement live bid delete endpoint `DELETE /admin/events/{event_id}/quick-entry/live-auction/bids/{bid_id}` in `backend/app/api/v1/admin_quick_entry.py`
- [X] T025 [US2] Implement winner assignment endpoint `POST /admin/events/{event_id}/quick-entry/live-auction/items/{item_id}/winner` with confirmation in `backend/app/api/v1/admin_quick_entry.py`
- [X] T026 [P] [US2] Add backend contract tests for delete/winner/summary endpoints in `backend/app/tests/contract/test_admin_quick_entry_live_controls.py`
- [X] T027 [P] [US2] Implement frontend live bid log + metrics cards + delete action in `frontend/fundrbolt-admin/src/features/quick-entry/components/LiveBidLogAndMetrics.tsx`
- [X] T028 [US2] Implement winner assignment confirmation action and refresh workflow in `frontend/fundrbolt-admin/src/features/quick-entry/hooks/useLiveAuctionControls.ts`

**Checkpoint**: US1 + US2 are independently testable and operational for live auction control.

---

## Phase 5: User Story 3 - Rapid paddle raise donation entry (Priority: P3)

**Goal**: Enable rapid paddle raise donation entry with optional labels/custom label, unmatched bidder rejection, and prominent paddle metrics.

**Independent Test**: In Paddle Raise mode, submit repeated donations while focus stays on bidder input, submit with and without labels, and verify totals/by-level/participation metrics update.

### Implementation for User Story 3

- [X] T029 [US3] Implement paddle donation creation and label-link persistence service logic in `backend/app/services/quick_entry/paddle_raise_service.py`
- [X] T030 [US3] Implement `POST /admin/events/{event_id}/quick-entry/paddle-raise/donations` and paddle summary mode branch in `backend/app/api/v1/admin_quick_entry.py`
- [X] T031 [P] [US3] Add backend contract tests for paddle donation create and summary responses in `backend/app/tests/contract/test_admin_quick_entry_paddle_raise.py`
- [X] T032 [P] [US3] Add backend integration tests for optional labels and unmatched bidder rejection in `backend/app/tests/integration/test_quick_entry_paddle_raise.py`
- [X] T033 [P] [US3] Implement paddle entry form + label checklist + custom label input in `frontend/fundrbolt-admin/src/features/quick-entry/components/PaddleRaiseEntryForm.tsx`
- [X] T034 [US3] Implement paddle submit behavior (bidder clear/refocus) and paddle metrics panel in `frontend/fundrbolt-admin/src/features/quick-entry/hooks/usePaddleRaiseEntry.ts`

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, docs alignment, and CI-quality validation across stories.

- [X] T035 [P] Update OpenAPI docs/examples to match implemented quick-entry behavior in `backend/app/api/v1/admin_quick_entry.py` and `backend/app/schemas/quick_entry/schemas.py`
- [X] T036 [P] Add frontend accessibility and keyboard interaction refinements for quick-entry controls in `frontend/fundrbolt-admin/src/features/quick-entry/components/`
- [X] T037 Add audit-log verification for create/delete/winner actions in `backend/app/services/quick_entry/service_base.py` and integration assertions in `backend/app/tests/integration/test_quick_entry_audit.py`
- [X] T038 Run backend CI checks (`ruff`, `ruff format --check`, `mypy`, `pytest`) from `backend/` and resolve any feature-related failures
- [X] T039 Run frontend CI checks (`pnpm lint`, `pnpm format:check`, `pnpm build`) from `frontend/fundrbolt-admin/` and resolve any feature-related failures
- [X] T040 Execute quickstart walkthrough and capture completion notes in `/home/jjeanes/dev/fundrbolt-platform/.specify/specs/029-quick-bid-entry/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all story work.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2; can start after Phase 3 API surface exists, but priority order is US1 then US2.
- **Phase 5 (US3)**: Depends on Phase 2; can proceed independently of US2 after shared quick-entry base is complete.
- **Phase 6 (Polish)**: Depends on completion of selected story phases.

### User Story Dependency Graph

- **US1 (P1)**: No story dependency after foundational phase.
- **US2 (P2)**: Uses live bid data model/service from US1 foundational live flow; implement after core live bid creation is in place.
- **US3 (P3)**: Independent from US2; depends only on foundational quick-entry base.

Execution order: `US1 -> (US2 || US3) -> Polish`

### Within Each User Story

- Backend service logic before endpoint wiring.
- Endpoint wiring before frontend integration.
- Contract/integration tests can be implemented in parallel with frontend after endpoint contracts stabilize.
- Story-specific checkpoint must pass before marking story complete.

### Parallel Opportunities

- **Setup**: T003 and T004 can run in parallel.
- **Foundational**: T007/T008/T009 can run in parallel; T011 and T012 can run in parallel.
- **US1**: T017/T018 and T019/T020 can run in parallel after T016 contract is stable.
- **US2**: T026 can run in parallel with T027 after T024/T025 endpoint signatures are set.
- **US3**: T031/T032 and T033 can run in parallel after T030 is stable.
- **Polish**: T035 and T036 can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Parallel backend/frontend work for US1 after live create endpoint signature is defined
Task: "T017 [US1] Contract tests in backend/app/tests/contract/test_admin_quick_entry_live_bids.py"
Task: "T018 [US1] Integration tests in backend/app/tests/integration/test_quick_entry_live_bids.py"
Task: "T019 [US1] API client in frontend/fundrbolt-admin/src/features/quick-entry/api/quickEntryApi.ts"
Task: "T020 [US1] Live entry form in frontend/fundrbolt-admin/src/features/quick-entry/components/LiveBidEntryForm.tsx"
```

## Parallel Example: User Story 2

```bash
# Parallel UI and contract checks after delete/winner endpoints are implemented
Task: "T026 [US2] Contract tests in backend/app/tests/contract/test_admin_quick_entry_live_controls.py"
Task: "T027 [US2] Live log/metrics UI in frontend/fundrbolt-admin/src/features/quick-entry/components/LiveBidLogAndMetrics.tsx"
```

## Parallel Example: User Story 3

```bash
# Parallel paddle work after donation endpoint is stable
Task: "T031 [US3] Contract tests in backend/app/tests/contract/test_admin_quick_entry_paddle_raise.py"
Task: "T032 [US3] Integration tests in backend/app/tests/integration/test_quick_entry_paddle_raise.py"
Task: "T033 [US3] Paddle form UI in frontend/fundrbolt-admin/src/features/quick-entry/components/PaddleRaiseEntryForm.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 (US1) end-to-end.
3. Validate US1 independent test criteria.
4. Demo/deploy MVP for live-bid rapid entry.

### Incremental Delivery

1. Foundation complete.
2. Add US1 and validate.
3. Add US2 live controls/visibility and validate.
4. Add US3 paddle raise flow and validate.
5. Run Phase 6 polish checks before merge.

### Parallel Team Strategy

1. One developer finalizes backend endpoints while another builds frontend quick-entry components.
2. After US1, split US2 (live controls) and US3 (paddle raise) across contributors.
3. Re-converge for cross-cutting CI and quickstart validation.

---

## Notes

- `[P]` tasks are safe parallel opportunities based on file separation and dependency ordering.
- `[US1]`, `[US2]`, `[US3]` labels map directly to spec user stories for traceability.
- All task lines use required checklist format with IDs, optional `[P]`, story labels where required, and explicit file paths.
- Keep scope aligned with clarified rules: first-in tie handling, unmatched bidder rejection, role restrictions, and optional paddle labels.
