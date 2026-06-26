# Tasks: Silent Auction Anti-Sniping Auto-Extension

**Input**: Design documents from `/home/jjeanes/dev/fundrbolt-platform/.specify/specs/051-auto-auction-extension/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare schema, API, and UI work surfaces for this feature.

- [ ] T001 Verify current branch and feature docs alignment in /home/jjeanes/dev/fundrbolt-platform/.specify/specs/051-auto-auction-extension/plan.md and /home/jjeanes/dev/fundrbolt-platform/.specify/specs/051-auto-auction-extension/spec.md
- [ ] T002 Add feature contract/reference note to /home/jjeanes/dev/fundrbolt-platform/docs/development/README.md
- [ ] T003 [P] Create backend test module skeletons in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/contract/test_silent_auction_extension_policy_api.py and /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/integration/test_silent_auction_auto_extension.py
- [ ] T004 [P] Create frontend test module skeleton in /home/jjeanes/dev/fundrbolt-platform/frontend/fundrbolt-admin/src/features/events/auction-items/components/__tests__/SilentAuctionExtensionPolicyCard.test.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend data model and plumbing required before user-story delivery.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

- [ ] T005 Create event-level policy model in /home/jjeanes/dev/fundrbolt-platform/backend/app/models/silent_auction_extension_policy.py
- [ ] T006 [P] Register new model exports in /home/jjeanes/dev/fundrbolt-platform/backend/app/models/__init__.py
- [ ] T007 [P] Add Event relationship for extension policy in /home/jjeanes/dev/fundrbolt-platform/backend/app/models/event.py
- [ ] T008 Create Alembic migration for policy table and defaults in /home/jjeanes/dev/fundrbolt-platform/backend/alembic/versions/
- [ ] T009 Create policy schemas and validation bounds in /home/jjeanes/dev/fundrbolt-platform/backend/app/schemas/silent_auction_extension_policy.py
- [ ] T010 [P] Register schema imports where needed in /home/jjeanes/dev/fundrbolt-platform/backend/app/schemas/__init__.py
- [ ] T011 Create extension domain service in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/silent_auction_extension_service.py
- [ ] T012 [P] Wire service exports/imports in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/__init__.py

**Checkpoint**: Foundational data + service layer is ready.

---

## Phase 3: User Story 1 - Fair Bidding Window Protection (Priority: P1) 🎯 MVP

**Goal**: Extend silent auction close time for qualifying accepted bids using server acceptance time and cap logic.

**Independent Test**: Place bids outside and inside window, then verify extension behavior and max-cap enforcement from backend API responses and persisted item timing.

### Tests for User Story 1

- [ ] T013 [P] [US1] Add contract coverage for bid response extension fields in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/contract/test_auction_bids_api.py
- [ ] T014 [P] [US1] Add integration tests for boundary and max-cap extension behavior in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/integration/test_silent_auction_auto_extension.py

### Implementation for User Story 1

- [ ] T015 [US1] Add extension metadata fields to bid response schemas in /home/jjeanes/dev/fundrbolt-platform/backend/app/schemas/auction_bid.py
- [ ] T016 [US1] Integrate extension evaluation into bid acceptance flow in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/auction_bid_service.py
- [ ] T017 [US1] Ensure extension eligibility uses server acceptance time and non-retroactive semantics in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/silent_auction_extension_service.py
- [ ] T018 [US1] Update bid API endpoint mapping to return extension metadata in /home/jjeanes/dev/fundrbolt-platform/backend/app/api/v1/auction_bids.py
- [ ] T019 [US1] Add structured logs for extension decisions and cap hits in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/silent_auction_extension_service.py

**Checkpoint**: US1 is independently functional and testable.

---

## Phase 4: User Story 2 - Event-Level Auction Extension Configuration (Priority: P2)

**Goal**: Let admins configure event-level anti-sniping settings from silent auction admin UI.

**Independent Test**: Admin can load current policy, save valid updates, receive validation on invalid bounds, and observe updated policy in follow-up reads.

### Tests for User Story 2

- [ ] T020 [P] [US2] Add contract tests for policy GET/PUT endpoints in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/contract/test_silent_auction_extension_policy_api.py
- [ ] T021 [P] [US2] Add API integration tests for authorization and validation bounds in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/integration/test_silent_auction_extension_policy_api.py
- [ ] T022 [P] [US2] Add component interaction tests for policy controls in /home/jjeanes/dev/fundrbolt-platform/frontend/fundrbolt-admin/src/features/events/auction-items/components/__tests__/SilentAuctionExtensionPolicyCard.test.tsx

### Implementation for User Story 2

- [ ] T023 [US2] Create admin policy endpoints in /home/jjeanes/dev/fundrbolt-platform/backend/app/api/v1/admin_silent_auction_extension.py
- [ ] T024 [US2] Register admin policy router in /home/jjeanes/dev/fundrbolt-platform/backend/app/api/v1/__init__.py
- [ ] T025 [US2] Implement policy read/update logic and bounds handling in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/silent_auction_extension_service.py
- [ ] T026 [US2] Add admin client methods for policy GET/PUT in /home/jjeanes/dev/fundrbolt-platform/frontend/fundrbolt-admin/src/services/auctionItemService.ts
- [ ] T027 [US2] Add event-level policy editor UI in /home/jjeanes/dev/fundrbolt-platform/frontend/fundrbolt-admin/src/features/events/auction-items/components/SilentAuctionExtensionPolicyCard.tsx
- [ ] T028 [US2] Mount policy editor in silent auction page in /home/jjeanes/dev/fundrbolt-platform/frontend/fundrbolt-admin/src/features/events/auction-items/AuctionItemsIndexPage.tsx
- [ ] T039 [US2] Initialize default event-level policy during event creation workflow in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/event_service.py

**Checkpoint**: US2 is independently functional and testable.

---

## Phase 5: User Story 3 - Transparent Closing-Time Behavior (Priority: P3)

**Goal**: Expose and persist effective close-time behavior clearly, including rollout handling for existing events without policy rows.

**Independent Test**: Existing event with no policy is auto-initialized from defaults; item timing and extension metadata remain consistent and visible after repeated qualifying bids.

### Tests for User Story 3

- [ ] T029 [P] [US3] Add integration test for lazy policy initialization on legacy events in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/integration/test_silent_auction_auto_extension.py
- [ ] T030 [P] [US3] Add integration test for immediate policy-change applicability (prospective only) in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/integration/test_silent_auction_auto_extension.py

### Implementation for User Story 3

- [ ] T031 [US3] Implement legacy-event auto-create defaults in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/silent_auction_extension_service.py
- [ ] T032 [US3] Expose effective close-time fields through auction item/read models in /home/jjeanes/dev/fundrbolt-platform/backend/app/schemas/auction_item.py
- [ ] T033 [US3] Populate effective close-time values in item queries/services in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/auction_item_service.py
- [ ] T034 [US3] Surface effective close-time information in admin silent auction item list in /home/jjeanes/dev/fundrbolt-platform/frontend/fundrbolt-admin/src/features/events/components/AuctionItemList.tsx

**Checkpoint**: US3 is independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, quality gates, and documentation.

- [ ] T035 [P] Update feature docs and contract links in /home/jjeanes/dev/fundrbolt-platform/.specify/specs/051-auto-auction-extension/quickstart.md and /home/jjeanes/dev/fundrbolt-platform/.specify/specs/051-auto-auction-extension/contracts/anti_sniping_extension.openapi.yaml
- [ ] T036 Run backend CI checks for touched backend files via /home/jjeanes/dev/fundrbolt-platform/backend (`poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests'`, `poetry run pytest -v --tb=short`)
- [ ] T037 Run frontend quality checks in /home/jjeanes/dev/fundrbolt-platform/frontend/fundrbolt-admin (`pnpm lint`, `pnpm format:check`, `pnpm build`)
- [ ] T038 Run quickstart scenario validation from /home/jjeanes/dev/fundrbolt-platform/.specify/specs/051-auto-auction-extension/quickstart.md and capture any deltas

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): starts immediately.
- Phase 2 (Foundational): depends on Phase 1 and blocks all user stories.
- Phase 3 (US1): depends on Phase 2.
- Phase 4 (US2): depends on Phase 2; may run after or alongside US1, but MVP is US1 first.
- Phase 5 (US3): depends on Phase 2 and partially on US1 extension engine.
- Phase 6 (Polish): depends on all selected stories being complete.

### User Story Dependencies

- US1 (P1): independent after foundation; defines core extension behavior.
- US2 (P2): independent after foundation; consumes shared policy model/service.
- US3 (P3): depends on extension service semantics from US1 and policy model from foundation.

### Parallel Opportunities

- Phase 1: T003 and T004 can run in parallel.
- Phase 2: T006, T007, T010, and T012 can run in parallel after T005/T009 where needed.
- US1: T013 and T014 can run in parallel; T015 can proceed while T014 is being expanded.
- US2: T020, T021, and T022 can run in parallel.
- US3: T029 and T030 can run in parallel.

## Parallel Example: US2

```bash
# Parallel test work
T020: backend contract tests
T021: backend integration tests
T022: frontend component tests

# Parallel implementation work once backend contract stabilizes
T026: frontend service wiring
T027: frontend policy editor component
```

## Implementation Strategy

### MVP First (US1)

1. Complete Phases 1-2.
2. Deliver US1 (Phase 3) and validate extension behavior in isolation.
3. Demo/verify anti-sniping core.

### Incremental Delivery

1. Add US2 admin control flow.
2. Add US3 transparency and rollout handling.
3. Execute polish checks and quickstart verification.

### Task Count Summary

- Total tasks: 39
- Setup + Foundational: 12
- US1: 7
- US2: 10
- US3: 6
- Polish: 4
