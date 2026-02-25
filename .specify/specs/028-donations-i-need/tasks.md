# Tasks: Donation Tracking and Attribution

**Input**: Design documents from `/home/jjeanes/dev/fundrbolt-platform/.specify/specs/028-donations-i-need/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/donations.openapi.yaml, quickstart.md

**Tests**: Included because the specification contains explicit independent test criteria and acceptance scenarios for each user story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare donation-domain file structure and API module registration points.

- [x] T001 Create donation domain module stubs in `backend/app/models/donation.py`, `backend/app/models/donation_label.py`, `backend/app/models/donation_label_assignment.py`, `backend/app/schemas/donation.py`, `backend/app/schemas/donation_label.py`, `backend/app/services/donation_service.py`, `backend/app/services/donation_label_service.py`, and `backend/app/api/v1/admin_donations.py`
- [x] T002 [P] Add donation test file scaffolds in `backend/app/tests/contract/test_admin_donations_api.py`, `backend/app/tests/contract/test_admin_donation_labels_api.py`, `backend/app/tests/integration/test_donation_access.py`, `backend/app/tests/integration/test_donation_attribution.py`, and `backend/app/tests/integration/test_donation_label_filters.py`
- [x] T003 [P] Add donation seed utility scaffold in `backend/seed_donation_labels.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared database and routing foundations required by all user stories.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [x] T004 Create Alembic migration for donation tables, constraints, and indexes in `backend/alembic/versions/028_add_donations_and_labels.py`
- [x] T005 [P] Implement SQLAlchemy `Donation` model with event/user linkage and void lifecycle fields in `backend/app/models/donation.py`
- [x] T006 [P] Implement SQLAlchemy `DonationLabel` and `DonationLabelAssignment` models in `backend/app/models/donation_label.py` and `backend/app/models/donation_label_assignment.py`
- [x] T007 Update model exports and cross-model relationships in `backend/app/models/__init__.py`, `backend/app/models/event.py`, and `backend/app/models/user.py`
- [x] T008 Add base donation API router wiring in `backend/app/api/v1/admin.py` and `backend/app/api/v1/admin_donations.py`
- [x] T009 Implement shared role guard utility for donation write/read scopes in `backend/app/services/permission_service.py`

**Checkpoint**: Foundation complete — user stories can now be implemented and validated independently.

---

## Phase 3: User Story 1 - Record a Donation With Donor and Amount (Priority: P1) 🎯 MVP

**Goal**: Allow admin/staff to create, read, update, and void event-linked donation records tied to donors, while enforcing reporting-role read-only behavior.

**Independent Test**: Create a donation with valid `event_id`, `donor_user_id`, and `amount`; retrieve and update it; void it and verify it is excluded from active listings; verify reporting role cannot write.

### Tests for User Story 1

- [x] T010 [P] [US1] Add contract tests for donation create/get/update/void endpoints in `backend/app/tests/contract/test_admin_donations_api.py`
- [x] T011 [P] [US1] Add integration tests for role-based read-only/write access in `backend/app/tests/integration/test_donation_access.py`

### Implementation for User Story 1

- [x] T012 [US1] Implement donation create/update/detail/list schemas with amount validation in `backend/app/schemas/donation.py`
- [x] T013 [US1] Implement donation CRUD + void business logic in `backend/app/services/donation_service.py`
- [x] T014 [US1] Implement event-scoped donation CRUD/void endpoints in `backend/app/api/v1/admin_donations.py`
- [x] T015 [US1] Enforce reporting-role write denial and admin/staff write permission checks in `backend/app/api/v1/admin_donations.py` and `backend/app/services/permission_service.py`
- [x] T016 [US1] Add default active-only listing behavior (`include_voided=false`) in `backend/app/services/donation_service.py`

**Checkpoint**: US1 is independently functional and demo-ready as MVP.

---

## Phase 4: User Story 2 - Attribute Donations to Fundraising Moments (Priority: P2)

**Goal**: Capture paddle raise designation and assign/remove attribution labels (including default Last Hero and Coin Toss) for donations.

**Independent Test**: Record donations with/without `is_paddle_raise`, assign and remove labels, and verify attribution is returned consistently in donation detail/list responses.

### Tests for User Story 2

- [x] T017 [P] [US2] Add contract tests for paddle raise and donation label assignment payload behavior in `backend/app/tests/contract/test_admin_donations_api.py`
- [x] T018 [P] [US2] Add integration tests for attribution assignment/removal workflows in `backend/app/tests/integration/test_donation_attribution.py`

### Implementation for User Story 2

- [x] T019 [US2] Extend donation schemas to support `is_paddle_raise` and label assignment fields in `backend/app/schemas/donation.py`
- [x] T020 [US2] Implement attribution assignment/removal methods with assignment timestamp handling in `backend/app/services/donation_service.py`
- [x] T021 [US2] Seed event-scoped default labels (`Last Hero`, `Coin Toss`) in `backend/seed_donation_labels.py`
- [x] T022 [US2] Return paddle raise and assigned label data from donation endpoints in `backend/app/api/v1/admin_donations.py`

**Checkpoint**: US2 attribution workflows are independently functional.

---

## Phase 5: User Story 3 - Manage Event Labels and Query by Label (Priority: P3)

**Goal**: Manage event-scoped labels dynamically and query event donations by labels using default `ALL` and optional `ANY` match mode.

**Independent Test**: Create/rename/retire event labels, assign labels to multiple donations, query by multiple labels with default `ALL` and toggle `ANY`, and confirm cross-event label assignment is rejected.

### Tests for User Story 3

- [x] T023 [P] [US3] Add contract tests for label management endpoints in `backend/app/tests/contract/test_admin_donation_labels_api.py`
- [x] T024 [P] [US3] Add integration tests for `label_match_mode=all|any` query behavior in `backend/app/tests/integration/test_donation_label_filters.py`
- [x] T024A [US3] Add integration test proving multiple donations for the same donor within one event are accepted in `backend/app/tests/integration/test_donation_label_filters.py`

### Implementation for User Story 3

- [x] T025 [US3] Implement donation label create/update/list/retire schemas in `backend/app/schemas/donation_label.py`
- [x] T026 [US3] Implement event-scoped donation label service with uniqueness and retirement rules in `backend/app/services/donation_label_service.py`
- [x] T027 [US3] Implement event-scoped donation label endpoints in `backend/app/api/v1/admin_donations.py`
- [x] T028 [US3] Implement multi-label filtering with default `ALL` and optional `ANY` in `backend/app/services/donation_service.py`
- [x] T029 [US3] Enforce same-event label assignment validation in `backend/app/services/donation_service.py`

**Checkpoint**: US3 label management and filtering are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize documentation, quality gates, and contract alignment.

- [x] T030 [P] Update donation API docstrings and response examples in `backend/app/api/v1/admin_donations.py`
- [x] T031 [P] Validate backend implementation in `backend/app/api/v1/admin_donations.py` and `backend/app/schemas/` against `.specify/specs/028-donations-i-need/contracts/donations.openapi.yaml`; update code (not contract) unless contract defect is confirmed
- [x] T032 Run backend quality gates and resolve donation-related failures in `backend/app/models/donation.py`, `backend/app/schemas/donation.py`, `backend/app/services/donation_service.py`, `backend/app/api/v1/admin_donations.py`, and `backend/app/tests/`
- [ ] T033 Enforce unit test coverage threshold (>=80%) using `cd backend && poetry run pytest --cov=app --cov-report=term-missing --cov-fail-under=80`
- [x] T034 Add performance verification tests for SC-002 and SC-003 in `backend/app/tests/integration/test_donation_performance.py`
- [x] T035 Add KPI verification assertions for SC-001, SC-004, and SC-005 in `backend/app/tests/integration/test_donation_kpis.py` (SC-001: >=95% complete required fields on first submit in fixture run; SC-004: >=90% donations carry paddle raise or >=1 label; SC-005: assert 3 attribution queries return totals without manual transformations)
- [x] T036 Update backend feature documentation for donation operations and KPI/performance validation steps in `backend/README.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Starts immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2; MVP slice.
- **Phase 4 (US2)**: Depends on Phase 2 and integrates with US1 donation endpoints.
- **Phase 5 (US3)**: Depends on Phase 2 and builds on label entities introduced in Foundation.
- **Phase 6 (Polish)**: Depends on completion of selected user stories.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories after Foundation.
- **US2 (P2)**: Can start after Phase 2; may reuse shared donation components but remains independently testable.
- **US3 (P3)**: Can start after Phase 2; may reuse shared donation/label components but remains independently testable.

### Dependency Graph

- `US1, US2, US3 (parallel after Phase 2)`

---

## Parallel Execution Opportunities

### US1
- T010 and T011 can run in parallel (different test files).

### US2
- T017 and T018 can run in parallel (different test files).

### US3
- T023 and T024 can run in parallel (different test files).

### Cross-Phase Parallelism
- In Phase 1: T002 and T003 can run in parallel.
- In Phase 2: T005 and T006 can run in parallel.
- In Phase 6: T030 and T031 can run in parallel.
- In Phase 6: T034 and T035 can run in parallel.

---

## Implementation Strategy

### MVP First (US1 only)
1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate US1 independent test criteria.
4. Demo/deploy MVP donation lifecycle.

### Incremental Delivery
1. Add US2 attribution behavior and validate independently.
2. Add US3 label management and filtering behavior and validate independently.
3. Finish Phase 6 polish and backend quality gates.

### Suggested MVP Scope
- **MVP = Phase 1 + Phase 2 + Phase 3 (US1)**
