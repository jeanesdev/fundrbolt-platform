---
description: "Task list for event check-in page"
---

# Tasks: Event check-in page

**Input**: Design documents from `/specs/025-event-checkin-page/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested; no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Verify existing admin PWA and backend module locations for check-in feature in backend/app and frontend/fundrbolt-admin/src
- [ ] T002 [P] Create contracts reference note in docs/operations/ (or feature README) if required by team conventions

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [ ] T003 Define/extend SQLAlchemy models and migrations for check-in records and ticket transfer audit in backend/app/models/ and backend/alembic/versions/
- [ ] T004 [P] Add Pydantic schemas for check-in/search/dashboard payloads in backend/app/schemas/
- [ ] T005 [P] Add service layer scaffolding for check-in operations in backend/app/services/
- [ ] T006 [P] Add API router scaffolding for check-in endpoints in backend/app/api/
- [ ] T007 [P] Add admin PWA route placeholder for check-in page in frontend/fundrbolt-admin/src/routes/

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Check in registered guests (Priority: P1) 🎯 MVP

**Goal**: Search guests and perform individual check-in/check-out with audit logging and dashboard visibility.

**Independent Test**: Search for a known guest, check them in, verify status and timestamp, then check-out with a reason and verify audit entry and dashboard update.

### Implementation for User Story 1

- [ ] T008 [P] [US1] Implement search endpoint in backend/app/api/ for /checkins/search
- [ ] T009 [P] [US1] Implement check-in endpoint in backend/app/api/ for /checkins/{registration_id}/check-in
- [ ] T010 [P] [US1] Implement check-out endpoint with required reason in backend/app/api/ for /checkins/{registration_id}/check-out
- [ ] T011 [US1] Implement check-in service logic and audit logging in backend/app/services/
- [ ] T012 [P] [US1] Implement dashboard endpoint in backend/app/api/ for /checkins/dashboard
- [ ] T013 [P] [US1] Add admin PWA check-in page shell and route in frontend/fundrbolt-admin/src/pages/ and frontend/fundrbolt-admin/src/routes/
- [ ] T014 [P] [US1] Add search UI and results list in frontend/fundrbolt-admin/src/components/
- [ ] T015 [P] [US1] Add check-in/check-out actions UI with reason capture in frontend/fundrbolt-admin/src/components/
- [ ] T016 [US1] Integrate check-in API client in frontend/fundrbolt-admin/src/services/ and wire to page
- [ ] T017 [US1] Add dashboard totals + searchable checked-in list UI in frontend/fundrbolt-admin/src/components/

**Checkpoint**: User Story 1 is fully functional and independently testable

---

## Phase 4: User Story 2 - Update guest details at check-in (Priority: P2)

**Goal**: Update donor contact info, bidder/table numbers, and dinner selection during check-in.

**Independent Test**: Select a guest and update contact details, bidder/table numbers, and dinner selection; verify persistence and UI update.

### Implementation for User Story 2

- [ ] T018 [P] [US2] Implement donor update endpoint in backend/app/api/ for /registrations/{registration_id}/donor
- [ ] T019 [P] [US2] Implement seating update endpoint with uniqueness enforcement in backend/app/api/ for /registrations/{registration_id}/seating
- [ ] T020 [P] [US2] Implement dinner selection endpoint in backend/app/api/ for /registrations/{registration_id}/dinner-selection
- [ ] T021 [US2] Implement update logic in backend/app/services/ with validation and conflict handling
- [ ] T022 [P] [US2] Add donor info edit UI in frontend/fundrbolt-admin/src/components/
- [ ] T023 [P] [US2] Add bidder/table assignment UI with conflict feedback in frontend/fundrbolt-admin/src/components/
- [ ] T024 [P] [US2] Add dinner selection UI in frontend/fundrbolt-admin/src/components/
- [ ] T025 [US2] Wire update APIs in frontend/fundrbolt-admin/src/services/ and update page state

**Checkpoint**: User Story 2 works independently with User Story 1 intact

---

## Phase 5: User Story 3 - Handle last-minute registration and ticket changes (Priority: P3)

**Goal**: Register new donors and transfer tickets during check-in.

**Independent Test**: Register a new donor and check them in; transfer a ticket to another donor and verify ownership and eligibility to check in.

### Implementation for User Story 3

- [ ] T026 [P] [US3] Implement registration creation endpoint in backend/app/api/ for /registrations
- [ ] T027 [P] [US3] Implement ticket transfer endpoint in backend/app/api/ for /registrations/{registration_id}/transfer
- [ ] T028 [US3] Implement registration and transfer service logic with audit logging in backend/app/services/
- [ ] T029 [P] [US3] Add register new donor UI flow in frontend/fundrbolt-admin/src/components/
- [ ] T030 [P] [US3] Add ticket transfer UI flow in frontend/fundrbolt-admin/src/components/
- [ ] T031 [US3] Wire registration/transfer APIs in frontend/fundrbolt-admin/src/services/ and update page state

**Checkpoint**: User Story 3 works independently with User Stories 1 and 2 intact

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T032 [P] Add audit log visibility (read-only) in backend/app/api/ if required by admin tooling
- [ ] T033 Update quickstart validation steps in .specify/specs/025-event-checkin-page/quickstart.md if implementation differs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup completion
- **User Stories (Phase 3+)**: Depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2)
- **User Story 2 (P2)**: Can start after Foundational (Phase 2)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2)

### Parallel Opportunities

- Foundational tasks T004–T007 can run in parallel.
- Within each story, backend endpoints and frontend UI tasks marked [P] can run in parallel.

---

## Parallel Example: User Story 1

- T008 Implement search endpoint in backend/app/api/
- T009 Implement check-in endpoint in backend/app/api/
- T010 Implement check-out endpoint in backend/app/api/
- T013 Add admin PWA check-in page shell and route in frontend/fundrbolt-admin/src/pages/ and frontend/fundrbolt-admin/src/routes/
- T014 Add search UI and results list in frontend/fundrbolt-admin/src/components/

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate User Story 1 independently

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
