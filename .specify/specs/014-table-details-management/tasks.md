---
description: "Implementation tasks for Table Details Management feature"
---

# Tasks: Table Details Management

**Input**: Design documents from `/specs/014-table-details-management/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are optional and not explicitly required by the specification. Tasks focus on implementation only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
- **Backend**: `backend/app/` for application code, `backend/alembic/versions/` for migrations
- **Frontend Admin**: `frontend/fundrbolt-admin/src/`
- **Frontend Donor**: `frontend/donor-pwa/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema and model setup for table customization

- [ ] T001 Create Alembic migration for event_tables table in backend/alembic/versions/[timestamp]_add_table_customization.py
- [ ] T002 Add is_table_captain field to registration_guests table in same migration file
- [ ] T003 Add unique constraint (event_id, table_number) to event_tables in migration
- [ ] T004 Add check constraints for capacity range (1-20) and non-empty table names in migration
- [ ] T005 Add indexes: event_tables(event_id), event_tables(table_captain_id), registration_guests(table_number, is_table_captain)
- [ ] T006 Create backfill data migration for existing events with table_count > 0
- [ ] T007 Apply migration with `poetry run alembic upgrade head`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core models and schemas that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 [P] Create EventTable model in backend/app/models/event_table.py with all fields and relationships
- [ ] T009 [P] Add is_table_captain field to RegistrationGuest model in backend/app/models/registration_guest.py
- [ ] T010 [P] Add tables relationship to Event model in backend/app/models/event.py
- [ ] T011 Export EventTable from backend/app/models/__init__.py
- [ ] T012 [P] Create EventTableBase Pydantic schema in backend/app/schemas/event_table.py
- [ ] T013 [P] Create EventTableUpdate schema with validators in backend/app/schemas/event_table.py
- [ ] T014 [P] Create EventTableResponse schema in backend/app/schemas/event_table.py
- [ ] T015 [P] Create TableCaptainSummary schema in backend/app/schemas/event_table.py
- [ ] T016 [P] Add is_table_captain field to RegistrationGuestResponse schema in backend/app/schemas/registration_guest.py
- [ ] T017 Create SeatingService class in backend/app/services/seating_service.py (if doesn't exist)
- [ ] T018 Add get_effective_capacity method to SeatingService
- [ ] T019 Add validate_table_capacity method to SeatingService
- [ ] T020 Add validate_captain_assignment method to SeatingService

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Customize Table Capacity (Priority: P1) 🎯 MVP

**Goal**: Event coordinators can set custom capacity per table, system enforces limits on guest assignment

**Independent Test**: Create event with tables, set table 1 capacity to 6, assign 6 guests successfully, attempt 7th assignment fails with tooltip message

### Implementation for User Story 1

- [ ] T021 [US1] Implement update_table_details method in SeatingService (handles capacity updates)
- [ ] T022 [US1] Implement PATCH /admin/events/{event_id}/tables/{table_number} endpoint in backend/app/api/v1/endpoints/admin/seating.py
- [ ] T023 [US1] Add capacity validation to assign_guest_to_table in SeatingService
- [ ] T024 [US1] Modify PATCH /admin/events/{event_id}/guests/{guest_id}/seating endpoint to check capacity before assignment
- [ ] T025 [US1] Add 409 Conflict response for over-capacity in admin seating endpoint
- [ ] T026 [US1] Implement GET /admin/events/{event_id}/tables endpoint for seating page in backend/app/api/v1/endpoints/admin/seating.py
- [ ] T027 [P] [US1] Create TableDetailsPanel component in frontend/fundrbolt-admin/src/components/admin/seating/TableDetailsPanel.tsx
- [ ] T028 [P] [US1] Create TableCapacityTooltip component in frontend/fundrbolt-admin/src/components/admin/seating/TableCapacityTooltip.tsx
- [ ] T029 [US1] Add capacity input field to TableDetailsPanel with 1-20 validation
- [ ] T030 [US1] Add updateTableDetails API function in frontend/fundrbolt-admin/src/services/api/seating.ts
- [ ] T031 [US1] Add fetchEventTables API function in frontend/fundrbolt-admin/src/services/api/seating.ts
- [ ] T032 [US1] Integrate TableDetailsPanel with SeatingChartTable component (add popover trigger)
- [ ] T033 [US1] Add capacity display to table cards in admin seating chart
- [ ] T034 [US1] Disable "Assign to Table" button when table full, show TableCapacityTooltip
- [ ] T035 [US1] Add optimistic update logic for capacity changes in admin UI
- [ ] T036 [US1] Handle error responses (400, 404, 409, 422) in admin UI with user-friendly messages

**Checkpoint**: Custom table capacity fully functional - coordinators can set limits and system prevents over-assignment

---

## Phase 4: User Story 2 - Assign Table Names (Priority: P2)

**Goal**: Event coordinators can assign friendly names to tables (e.g., "VIP Sponsors"), displayed in admin and donor views

**Independent Test**: Set table 5 name to "VIP Sponsors", verify name appears on admin seating chart and donor home page

### Implementation for User Story 2

- [ ] T037 [US2] Add table_name handling to update_table_details method in SeatingService (if not already included)
- [ ] T038 [US2] Add table_name validation (trim whitespace, reject empty strings) in EventTableUpdate schema validator
- [ ] T039 [US2] Add table name input field to TableDetailsPanel component (max 50 chars)
- [ ] T040 [US2] Add clear button to remove table name (set to null) in TableDetailsPanel
- [ ] T041 [US2] Display table_name in admin seating chart table cards
- [ ] T042 [US2] Add conditional rendering: show "Table {number}" if no name, "Table {number} - {name}" if named
- [ ] T043 [US2] Update EventTableResponse to include effective display name in API response
- [ ] T044 [US2] Handle null table_name gracefully in all frontend components

**Checkpoint**: Table naming fully functional - coordinators can name tables and names display correctly

---

## Phase 5: User Story 3 - Designate Table Captain (Priority: P2)

**Goal**: Event coordinators can designate one guest per table as captain, visible in admin and donor views

**Independent Test**: Assign Jane Doe to table 5, designate her as captain, verify she sees "You are table captain" and others see "Table Captain: Jane Doe"

### Implementation for User Story 3

- [ ] T045 [US3] Implement set_table_captain method in SeatingService with validation
- [ ] T046 [US3] Add captain assignment logic: clear previous captain, set new captain, update is_table_captain flags
- [ ] T047 [US3] Add table_captain_id handling to update_table_details method
- [ ] T048 [US3] Validate captain is assigned to correct table (table_number match) in SeatingService
- [ ] T049 [US3] Add automatic cleanup: clear is_table_captain when guest unassigned from table
- [ ] T050 [US3] Add captain dropdown to TableDetailsPanel (populate with guests at this table)
- [ ] T051 [US3] Add "Clear Captain" option to dropdown (sets table_captain_id to null)
- [ ] T052 [US3] Display captain name with crown/badge icon in admin seating chart
- [ ] T053 [US3] Update GET /admin/events/{event_id}/tables to include captain details in response
- [ ] T054 [US3] Handle edge case: guest deleted while captain (foreign key SET NULL)
- [ ] T055 [US3] Handle edge case: captain reassigned to different table (clear old table captain)

**Checkpoint**: Table captain designation fully functional - coordinators can assign captains with proper validation

---

## Phase 6: User Story 4 - Donor View of Table Assignment (Priority: P1) 🎯 MVP

**Goal**: Donors see their table number, name, and captain on home page after event starts

**Independent Test**: Assign donor to table 5 ("VIP Sponsors", captain: Jane Doe), start event, verify donor sees all details

### Implementation for User Story 4

- [ ] T056 [US4] Create TableAssignment schema in backend/app/schemas/event_table.py for donor API
- [ ] T057 [US4] Add get_table_assignment_for_guest method to SeatingService
- [ ] T058 [US4] Modify GET /donor/events/{event_slug} endpoint to include table_assignment field in backend/app/api/v1/endpoints/donor/events.py
- [ ] T059 [US4] Add conditional logic: return table_assignment only if event.start_datetime <= now
- [ ] T060 [US4] Include table_number, table_name, captain full_name, you_are_captain boolean in response
- [ ] T061 [P] [US4] Create TableAssignmentCard component in frontend/donor-pwa/src/components/events/TableAssignmentCard.tsx
- [ ] T062 [P] [US4] Create TableCaptainBadge component in frontend/donor-pwa/src/components/events/TableCaptainBadge.tsx
- [ ] T063 [US4] Add table assignment display to donor home page near top
- [ ] T064 [US4] Add conditional rendering: hide if event not started or not assigned
- [ ] T065 [US4] Add polling logic (10-second interval) in donor event route
- [ ] T066 [US4] Display "You are the table captain" badge when you_are_captain=true
- [ ] T067 [US4] Display "Table Captain: {full_name}" when captain exists and not you
- [ ] T068 [US4] Handle null table_name (show only table number)
- [ ] T069 [US4] Handle null table_captain (show no captain info)
- [ ] T070 [US4] Add loading state during polling updates
- [ ] T071 [US4] Add error handling for failed table assignment fetches

**Checkpoint**: Donor table view fully functional - donors see complete table info after event starts with 10-second updates

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T072 [P] Add ETag caching support to GET /donor/events/{slug} endpoint for bandwidth optimization
- [ ] T073 [P] Add comprehensive error logging for all table operations in SeatingService
- [ ] T074 [P] Update API documentation (OpenAPI schema) with new endpoints and fields
- [ ] T075 [P] Add database query optimization: use SELECT COUNT vs loading all guests
- [ ] T076 [P] Update EventTable and RegistrationGuest TypeScript types in frontend/fundrbolt-admin/src/types/seating.ts
- [ ] T077 [P] Update EventTable and RegistrationGuest TypeScript types in frontend/donor-pwa/src/types/events.ts
- [ ] T078 [P] Add audit logging for table customization changes (who changed what when)
- [ ] T079 Verify all acceptance scenarios from spec.md pass manually
- [ ] T080 Run backend linter: `cd backend && poetry run ruff check .`
- [ ] T081 Run backend formatter: `cd backend && poetry run black .`
- [ ] T082 Run frontend linters: `cd frontend/fundrbolt-admin && pnpm lint && cd ../donor-pwa && pnpm lint`
- [ ] T083 Verify database migration rollback works: `poetry run alembic downgrade -1 && alembic upgrade head`
- [ ] T084 Update .github/copilot-instructions.md with feature completion summary
- [ ] T085 Run quickstart.md validation (follow setup steps, verify they work)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately with database migration
- **Foundational (Phase 2)**: Depends on Setup (migration applied) - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundational - No dependencies on other stories
  - User Story 2 (P2): Can start after Foundational - Extends US1 but independently testable
  - User Story 3 (P2): Can start after Foundational - Extends US1 but independently testable
  - User Story 4 (P1): Can start after Foundational - Integrates with US1-3 but can work with defaults
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

**US1 - Customize Table Capacity**:
- Depends on: Foundational (Phase 2)
- No dependencies on other stories
- Core functionality: capacity validation

**US2 - Assign Table Names**:
- Depends on: Foundational (Phase 2)
- Weak dependency on US1 (uses same update endpoint)
- Independently testable: can name tables without custom capacity

**US3 - Designate Table Captain**:
- Depends on: Foundational (Phase 2)
- Weak dependency on US1 (uses same update endpoint)
- Independently testable: can assign captain without capacity/name customization

**US4 - Donor View of Table Assignment**:
- Depends on: Foundational (Phase 2)
- Integrates with US1-3 (displays capacity, name, captain)
- Independently testable: works with default values (no custom capacity/name/captain)

### Within Each User Story

- Backend service logic before API endpoints
- API endpoints before frontend components
- Frontend components before integration with existing pages
- Core implementation before error handling
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**: Tasks T001-T006 must be in migration file together, but T007 waits for completion

**Phase 2 (Foundational)**:
- T008, T009, T010 (models) can run in parallel
- T012-T016 (schemas) can run in parallel after models
- T017-T020 (service methods) sequential (within same service file)

**Phase 3 (US1)**:
- T027, T028 (frontend components) can run in parallel
- T030, T031 (API client functions) can run in parallel

**Phase 4 (US2)**: Mostly extends existing files, limited parallelism

**Phase 5 (US3)**: Mostly extends existing files, limited parallelism

**Phase 6 (US4)**:
- T061, T062 (donor components) can run in parallel

**Phase 7 (Polish)**:
- T072-T078 can run in parallel (different concerns)
- T080-T082 (linting) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all parallelizable tasks for User Story 1 together:

# Backend (after service methods complete):
Task T022: "Implement PATCH endpoint for table updates"
Task T026: "Implement GET endpoint for tables list"

# Frontend (can start together):
Task T027: "Create TableDetailsPanel component"
Task T028: "Create TableCapacityTooltip component"

# API client (can start together):
Task T030: "Add updateTableDetails API function"
Task T031: "Add fetchEventTables API function"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 4 Only)

**Rationale**: US1 (capacity) and US4 (donor view) provide core value - coordinators set limits, donors see assignments

1. Complete Phase 1: Setup (database migration)
2. Complete Phase 2: Foundational (models, schemas, services)
3. Complete Phase 3: User Story 1 (capacity customization)
4. Complete Phase 6: User Story 4 (donor view)
5. **STOP and VALIDATE**: Test capacity + donor view independently
6. Deploy/demo if ready

**Deferred for v2**: US2 (table names), US3 (table captains) - nice-to-have enhancements

### Incremental Delivery

1. **Foundation** (Setup + Foundational) → Database and models ready
2. **MVP** (US1 + US4) → Core capacity management + donor visibility → Deploy/Demo
3. **Enhancement 1** (US2) → Add table naming → Deploy/Demo
4. **Enhancement 2** (US3) → Add captain designation → Deploy/Demo
5. **Polish** (Phase 7) → Optimization and cleanup → Final Deploy

### Parallel Team Strategy

With multiple developers (after Foundational complete):

**Solo Developer** (recommended order):
1. US1 (capacity) - 2 days
2. US4 (donor view) - 1 day
3. US2 (names) - 0.5 days
4. US3 (captains) - 1 day
5. Polish - 0.5 days
**Total: 5 days**

**Two Developers**:
- Developer A: US1 + US2 (backend + admin UI)
- Developer B: US4 (donor UI) + US3 (captain logic)
- Both: Polish tasks in parallel
**Total: 3 days**

---

## Task Summary

**Total Tasks**: 85
- Setup (Phase 1): 7 tasks
- Foundational (Phase 2): 13 tasks (BLOCKING)
- User Story 1 (Phase 3): 16 tasks
- User Story 2 (Phase 4): 8 tasks
- User Story 3 (Phase 5): 11 tasks
- User Story 4 (Phase 6): 16 tasks
- Polish (Phase 7): 14 tasks

**Parallel Opportunities**: 18 tasks marked [P]

**MVP Scope** (Recommended): Setup + Foundational + US1 + US4 = 52 tasks (61% of total)

**Independent Test Criteria**:
- ✅ US1: Set table capacity, attempt over-assignment, see tooltip
- ✅ US2: Name table, see name in admin and donor views
- ✅ US3: Designate captain, verify captain sees badge, others see captain name
- ✅ US4: View table details on donor home after event starts

**Format Validation**: ✅ All 85 tasks follow checklist format (checkbox, ID, optional [P]/[Story], description with file path)

---

## Notes

- Tasks follow strict checklist format for AI execution
- Each user story delivers independent value
- [P] tasks indicate safe parallelization opportunities
- [Story] labels enable traceability to requirements
- File paths provided for all implementation tasks
- Tests optional (not included per spec guidance)
- MVP delivers capacity + donor view (core value)
- Names and captains are enhancements (defer if time-constrained)
- Commit after logical task groups
- Validate at each checkpoint before proceeding
