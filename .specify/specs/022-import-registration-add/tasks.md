---
description: "Task list for Event Registration Import"
---

# Tasks: Event Registration Import

**Input**: Design documents from `/specs/022-import-registration-add/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested in spec.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create registration import backend module placeholders in backend/app/api/v1/admin_registration_import.py, backend/app/services/registration_import_service.py, and backend/app/schemas/registration_import.py
- [ ] T002 [P] Create admin registration import service client stub in frontend/fundrbolt-admin/src/services/registration-import-service.ts
- [ ] T003 [P] Create registration import dialog component shell in frontend/fundrbolt-admin/src/components/admin/RegistrationImportDialog.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create Import Batch and Validation Issue models in backend/app/models/registration_import.py
- [ ] T005 [P] Add Alembic migration for import batch and validation issue tables in backend/alembic/versions/<new>_registration_import.py
- [ ] T006 [P] Define Pydantic schemas for preflight and confirm responses in backend/app/schemas/registration_import.py
- [ ] T007 Update API router registration to include admin registration import routes in backend/app/api/v1/__init__.py

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Preflight and confirm registration import (Priority: P1) 🎯 MVP

**Goal**: Provide a preflight + confirm import flow on the admin registrations page.

**Independent Test**: Upload a valid file, pass preflight, confirm import, and verify created/skipped counts in the UI.

### Implementation for User Story 1

- [ ] T008 [US1] Implement preflight validation (required fields, in-file duplicates, event_id mismatch warnings, row limit) in backend/app/services/registration_import_service.py
- [ ] T009 [US1] Implement confirm import logic (create records, skip existing duplicates, record batch summary) in backend/app/services/registration_import_service.py
- [ ] T010 [US1] Implement preflight and confirm endpoints in backend/app/api/v1/admin_registration_import.py
- [ ] T011 [US1] Add Import button to registrations page in frontend/fundrbolt-admin/src/features/events/sections/EventRegistrationsSection.tsx
- [ ] T012 [US1] Build preflight + confirm dialog UI in frontend/fundrbolt-admin/src/components/admin/RegistrationImportDialog.tsx
- [ ] T013 [US1] Wire dialog actions to API client in frontend/fundrbolt-admin/src/services/registration-import-service.ts
- [ ] T014 [US1] Add JSON/CSV example format display in frontend/fundrbolt-admin/src/components/admin/RegistrationImportDialog.tsx

**Checkpoint**: User Story 1 is fully functional and testable independently

---

## Phase 4: User Story 2 - Use supported file formats (Priority: P2)

**Goal**: Accept JSON, CSV, and Excel files for registration imports.

**Independent Test**: Preflight a valid JSON, CSV, and Excel file and verify each is accepted.

### Implementation for User Story 2

- [ ] T015 [US2] Implement JSON, CSV, and Excel parsing in backend/app/services/registration_import_service.py
- [ ] T016 [US2] Enforce accepted file types and extensions in frontend/fundrbolt-admin/src/components/admin/RegistrationImportDialog.tsx
- [ ] T017 [US2] Populate file_type in preflight responses from backend/app/services/registration_import_service.py and schemas in backend/app/schemas/registration_import.py

**Checkpoint**: User Stories 1 AND 2 work independently

---

## Phase 5: User Story 3 - Fix and re-run after errors (Priority: P3)

**Goal**: Provide actionable preflight errors and downloadable error reports.

**Independent Test**: Preflight an invalid file, view row-level issues, download error report, and verify no records are created.

### Implementation for User Story 3

- [ ] T018 [US3] Add error report generation in backend/app/services/registration_import_service.py
- [ ] T019 [US3] Add error report download endpoint in backend/app/api/v1/admin_registration_import.py
- [ ] T020 [US3] Show row-level errors/warnings and download link in frontend/fundrbolt-admin/src/components/admin/RegistrationImportDialog.tsx

**Checkpoint**: All user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T021 [P] Validate quickstart flow and update steps if needed in .specify/specs/022-import-registration-add/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 UI/service layer
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Builds on US1 preflight results

### Parallel Opportunities

- Phase 1 tasks T002 and T003 can run in parallel
- Phase 2 tasks T005 and T006 can run in parallel
- UI tasks T011 and T012 can run in parallel after API endpoints are available

---

## Parallel Example: User Story 1

```bash
Task: "Add Import button to registrations page in frontend/fundrbolt-admin/src/features/events/sections/EventRegistrationsSection.tsx"
Task: "Build preflight + confirm dialog UI in frontend/fundrbolt-admin/src/components/admin/RegistrationImportDialog.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Avoid scope creep; implement only spec requirements
