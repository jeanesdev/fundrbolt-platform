# Tasks: Admin User Import

**Input**: Design documents from `/specs/027-short-name-import/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Minimal API tests are included to align with constitution requirements.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create admin user import router scaffold in backend/app/api/v1/admin_user_import.py and register it in backend/app/api/v1/__init__.py
- [ ] T002 [P] Create import schemas in backend/app/schemas/user_import.py
- [ ] T003 [P] Create import batch models in backend/app/models/user_import.py
- [ ] T004 Create migration for user import tables in backend/alembic/versions/<timestamp>_user_import_batches.py
- [ ] T005 [P] Create frontend API client in frontend/fundrbolt-admin/src/features/users/api/users-import-api.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [ ] T006 Implement file parsing, checksum, and row limit validation in backend/app/services/user_import_service.py
- [ ] T007 Add audit logging helper for user imports in backend/app/services/audit_service.py
- [ ] T008 Implement error report generation in backend/app/services/user_import_service.py
- [ ] T009 Add preflight token + checksum binding enforcement in backend/app/services/user_import_service.py
- [ ] T010 Add NPO identifier mismatch warnings in backend/app/services/user_import_service.py
- [ ] T011 Enforce user-management role checks in backend/app/api/v1/admin_user_import.py
- [ ] T012 Validate NPO-scoped roles and reject Super Admin rows in backend/app/services/user_import_service.py

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Preflight and confirm user import (Priority: P1) 🎯 MVP

**Goal**: Upload a file, run preflight validation, and confirm import with a completion summary.

**Independent Test**: Upload a valid file, run preflight, confirm import, and verify created and skipped counts in the UI.

### Tests for User Story 1

- [ ] T013 [P] [US1] Add preflight API test in backend/app/tests/test_user_import_preflight.py
- [ ] T014 [P] [US1] Add commit API test in backend/app/tests/test_user_import_commit.py

### Implementation for User Story 1

- [ ] T015 [US1] Implement preflight endpoint in backend/app/api/v1/admin_user_import.py
- [ ] T016 [US1] Implement commit endpoint in backend/app/api/v1/admin_user_import.py
- [ ] T017 [US1] Implement preflight/commit workflows in backend/app/services/user_import_service.py
- [ ] T018 [US1] Add import dialog component in frontend/fundrbolt-admin/src/features/users/components/users-import-dialog.tsx
- [ ] T019 [US1] Wire preflight call and summary rendering in frontend/fundrbolt-admin/src/features/users/components/users-import-dialog.tsx
- [ ] T020 [US1] Wire confirm import call and completion summary in frontend/fundrbolt-admin/src/features/users/components/users-import-dialog.tsx
- [ ] T021 [US1] Add error report download action in frontend/fundrbolt-admin/src/features/users/components/users-import-dialog.tsx
- [ ] T022 [US1] Add import entry point in frontend/fundrbolt-admin/src/features/users/components/users-primary-buttons.tsx
- [ ] T023 [US1] Add dialog state wiring in frontend/fundrbolt-admin/src/features/users/components/users-dialogs.tsx

**Checkpoint**: User Story 1 is fully functional and independently testable

---

## Phase 4: User Story 2 - Use supported file formats (Priority: P2)

**Goal**: Support JSON and CSV files with example formats in the UI.

**Independent Test**: Preflight succeeds for one valid JSON file and one valid CSV file.

### Implementation for User Story 2

- [ ] T024 [US2] Add JSON/CSV example panels and download links in frontend/fundrbolt-admin/src/features/users/components/users-import-dialog.tsx
- [ ] T025 [US2] Enforce required CSV headers and JSON schema validation in backend/app/services/user_import_service.py
- [ ] T026 [US2] Add file type guardrails for .json and .csv in frontend/fundrbolt-admin/src/features/users/components/users-import-dialog.tsx

**Checkpoint**: User Story 2 works independently and supports both formats

---

## Phase 5: User Story 3 - Handle duplicates and temporary passwords (Priority: P3)

**Goal**: Handle duplicate users, existing memberships, and temporary password email flow.

**Independent Test**: Preflight shows duplicate warnings, skips existing NPO members, and adds memberships for existing users in other NPOs.

### Implementation for User Story 3

- [ ] T027 [US3] Implement duplicate detection and issue severity reporting in backend/app/services/user_import_service.py
- [ ] T028 [US3] Implement existing user handling (skip in NPO, add membership in other NPO) in backend/app/services/user_import_service.py
- [ ] T029 [US3] Integrate temporary password generation and reset email send in backend/app/services/user_import_service.py using backend/app/services/email_service.py
- [ ] T030 [US3] Surface duplicate, skipped, and membership-added warnings in frontend/fundrbolt-admin/src/features/users/components/users-import-dialog.tsx

**Checkpoint**: User Story 3 works independently and reports duplicate handling and email delivery expectations

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T031 Update user import API docs in backend/app/api/v1/admin_user_import.py docstrings
- [ ] T032 Run quickstart validation steps from .specify/specs/027-short-name-import/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2

### Parallel Opportunities

- T002 and T003 can be done in parallel
- T005 can be done in parallel with backend setup tasks
- T013 and T014 can be done in parallel
- T015 and T016 can be done in parallel after T017 is complete
- T018-T023 can be done in parallel once API endpoints are ready
- T024 and T026 can be done in parallel

---

## Parallel Example: User Story 1

```bash
Task: "Wire preflight call and summary rendering in frontend/fundrbolt-admin/src/features/users/components/users-import-dialog.tsx"
Task: "Add import entry point in frontend/fundrbolt-admin/src/features/users/components/users-primary-buttons.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Stop and validate User Story 1 independently

### Incremental Delivery

1. Complete Setup + Foundational
2. Add User Story 1 → Validate
3. Add User Story 2 → Validate
4. Add User Story 3 → Validate
5. Complete Polish phase
