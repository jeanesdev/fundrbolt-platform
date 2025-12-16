# Implementation Tasks: Seating Assignment & Bidder Number Management

**Feature**: 012-seating-assignment | **Branch**: `012-seating-assignment` | **Date**: 2025-12-11

## Overview

This document provides a complete task breakdown for implementing the seating assignment and bidder number management feature. Tasks are organized by user story to enable independent implementation and testing of each feature increment.

**Total Tasks**: 93
**Estimated Effort**: 3-4 weeks (solo developer)
**MVP Scope**: User Story 1 + User Story 2 (foundation for all other stories)

## Task Format

Each task follows this format:

```text
- [ ] [TaskID] [P?] [Story?] Description with file path
```

- **TaskID**: Sequential identifier (T001, T002...)
- **[P]**: Parallel execution marker (can be done simultaneously with other [P] tasks)
- **[Story]**: User story label (US1, US2, etc.) for story-specific tasks
- **File paths**: Exact locations for code changes

---

## Phase 1: Setup & Infrastructure (Foundation)

**Goal**: Initialize project structure, database migrations, and shared infrastructure needed by all user stories.

**Duration**: 2-3 days

### Database Migrations

- [X] T001 Create migration 013_add_seating_configuration.py to add table_count and max_guests_per_table columns to events table in backend/alembic/versions/
- [X] T002 Create migration 014_add_seating_and_bidder_fields.py to add bidder_number, table_number, bidder_number_assigned_at columns to registration_guests table in backend/alembic/versions/
- [X] T003 Create migration 015_bidder_number_uniqueness_trigger.py to add database trigger for event-scoped bidder number uniqueness in backend/alembic/versions/
- [X] T004 Run alembic upgrade head to apply all seating migrations

### Model Extensions

- [X] T005 [P] Extend Event model with table_count, max_guests_per_table fields, has_seating_configuration property, and total_seating_capacity property in backend/app/models/event.py
- [X] T006 [P] Extend RegistrationGuest model with bidder_number, table_number, bidder_number_assigned_at fields, and computed properties (has_bidder_number, has_table_assignment, is_seated) in backend/app/models/registration_guest.py

### Pydantic Schemas

- [X] T007 [P] Create EventSeatingConfigRequest and EventSeatingConfigResponse schemas in backend/app/schemas/seating.py
- [X] T008 [P] Create TableAssignmentRequest, TableAssignmentResponse, BulkTableAssignmentRequest, BulkAssignmentResponse schemas in backend/app/schemas/seating.py
- [X] T009 [P] Create BidderNumberAssignmentRequest, BidderNumberAssignmentResponse, AvailableBidderNumbersResponse schemas in backend/app/schemas/seating.py
- [X] T010 [P] Create GuestSeatingInfo, GuestSeatingListResponse, TableOccupancyResponse, AutoAssignResponse schemas in backend/app/schemas/seating.py
- [X] T011 [P] Create SeatingInfoResponse schema for donor PWA in backend/app/schemas/seating.py

### Shared Services (Foundational)

- [X] T012 Create BidderNumberService class with assign_bidder_number(), validate_bidder_number_uniqueness(), get_available_bidder_numbers() methods in backend/app/services/bidder_number_service.py
- [X] T013 Create SeatingService class with validate_table_assignment(), get_table_occupancy(), get_guests_at_table() methods in backend/app/services/seating_service.py

---

## Phase 2: User Story 1 - Event Setup: Table Configuration (P1)

**Story Goal**: Enable NPO admins to configure seating capacity (table count and max guests per table) when creating or editing events.

**Independent Test**: Create an event with 15 tables and 8 guests per table, verify values are saved and displayed on event view.

**Depends On**: Phase 1 (models, migrations, schemas)

**Duration**: 2-3 days
**Task Count**: 10 tasks (T014-T022, including T015a)

### Backend Implementation

- [X] T014 [US1] Add PATCH /admin/events/{event_id}/seating/config endpoint to configure table_count and max_guests_per_table in backend/app/api/v1/admin/seating.py
- [X] T015 [US1] Implement validate_seating_config() in SeatingService to validate positive integers and enforce both-or-neither constraint (FR-006a) in backend/app/services/seating_service.py
- [X] T015a [US1] Add Pydantic schema validation in EventSeatingConfigRequest to enforce table_count and max_guests_per_table must be set together in backend/app/schemas/seating.py
- [X] T016 [US1] Add GET /admin/events/{event_id} response extension to include table_count and max_guests_per_table in backend/app/api/v1/events.py

### Frontend Implementation

- [X] T017 [P] [US1] Create SeatingConfigSection component with table count and max guests inputs in frontend/augeo-admin/src/features/events/components/SeatingConfigSection.tsx
- [X] T018 [P] [US1] Add seating configuration fields to EventEditForm component in frontend/augeo-admin/src/features/events/components/EventForm.tsx
- [X] T019 [US1] Implement updateEventSeating() API call in seating service in frontend/augeo-admin/src/services/seating-service.ts

### Integration & Testing

- [ ] T020 [P] [US1] Create unit test test_configure_event_seating() in backend/app/tests/unit/test_seating_service.py
- [ ] T021 [P] [US1] Create integration test test_event_seating_config_flow() in backend/app/tests/integration/test_seating_assignment.py
- [ ] T022 [US1] Verify seating config persists across page refreshes and displays correctly

---

## Phase 3: User Story 2 - Automatic Bidder Number Assignment (P1)

**Story Goal**: Automatically assign unique three-digit bidder numbers (100-999) to each guest upon registration.

**Independent Test**: Register 5 guests for an event, verify each receives a unique three-digit bidder number.

**Depends On**: Phase 1 (BidderNumberService), Phase 2 (event configuration)

**Duration**: 2-3 days

### Backend Implementation

- [ ] T023 [US2] Implement assign_bidder_number() algorithm (sequential with gap filling) in BidderNumberService in backend/app/services/bidder_number_service.py
- [ ] T024 [US2] Add automatic bidder number assignment hook in EventRegistrationService.create_registration() in backend/app/services/event_registration_service.py
- [ ] T025 [US2] Implement handle_registration_cancellation() to release bidder numbers in BidderNumberService in backend/app/services/bidder_number_service.py
- [ ] T026 [US2] Add GET /admin/events/{event_id}/seating/bidder-numbers/available endpoint to list available numbers in backend/app/api/v1/admin/seating.py

### Frontend Display

- [ ] T027 [P] [US2] Add bidder_number column to guest list table in Admin PWA in frontend/augeo-admin/src/components/guests/GuestListTable.tsx
- [ ] T028 [P] [US2] Display bidder number badge in guest detail view in frontend/augeo-admin/src/routes/events/$eventId/guests/$guestId.tsx

### Integration & Testing

- [ ] T029 [P] [US2] Create unit test test_assign_bidder_number_sequential() in backend/app/tests/unit/test_bidder_number_service.py
- [ ] T030 [P] [US2] Create unit test test_assign_bidder_number_fills_gaps() in backend/app/tests/unit/test_bidder_number_service.py
- [ ] T031 [P] [US2] Create unit test test_assign_bidder_number_exhaustion_error() in backend/app/tests/unit/test_bidder_number_service.py
- [ ] T032 [US2] Create integration test test_automatic_bidder_assignment_on_registration() in backend/app/tests/integration/test_bidder_number_flow.py
- [ ] T033 [US2] Verify bidder numbers persist and are unique across multiple registrations

---

## Phase 4: User Story 3 - Manual Bidder Number Management (P2)

**Story Goal**: Allow admins to manually change a guest's bidder number with automatic conflict resolution (previous holder gets reassigned).

**Independent Test**: Change Guest A's bidder number to 234 (already used by Guest B), verify Guest B is automatically reassigned a new unused number.

**Depends On**: Phase 3 (bidder number assignment infrastructure)

**Duration**: 2 days
**Task Count**: 13 tasks (T034-T044, including T041a, T041b)

### Backend Implementation

- [ ] T034 [US3] Implement reassign_bidder_number() method with conflict resolution in BidderNumberService in backend/app/services/bidder_number_service.py
- [ ] T035 [US3] Add PATCH /admin/events/{event_id}/guests/{guest_id}/bidder-number endpoint in backend/app/api/v1/admin/seating.py
- [ ] T036 [US3] Create audit log entry for bidder_number_reassigned action in reassignment flow in backend/app/services/bidder_number_service.py
- [ ] T037 [US3] Implement create_bidder_reassignment_notification() for in-app notification in backend/app/services/notification_service.py

### Frontend Implementation

- [ ] T038 [P] [US3] Create BidderNumberEdit component with input field and validation in frontend/augeo-admin/src/components/seating/BidderNumberEdit.tsx
- [ ] T039 [P] [US3] Add bidder number edit button to guest detail view in frontend/augeo-admin/src/routes/events/$eventId/guests/$guestId.tsx
- [ ] T040 [US3] Implement assignBidderNumber() API call in seating service in frontend/augeo-admin/src/services/seating.service.ts

### Donor Notification UI

- [ ] T041a [US3] Create BidderNumberReassignmentBanner component to display notification on donor PWA login in frontend/donor-pwa/src/components/notifications/BidderNumberReassignmentBanner.tsx
- [ ] T041b [US3] Add notification banner to donor PWA layout to check for unread bidder reassignment notifications in frontend/donor-pwa/src/layouts/MainLayout.tsx

### Integration & Testing

- [ ] T041 [P] [US3] Create unit test test_reassign_bidder_number_with_conflict() in backend/app/tests/unit/test_bidder_number_service.py
- [ ] T042 [P] [US3] Create unit test test_reassign_bidder_number_no_conflict() in backend/app/tests/unit/test_bidder_number_service.py
- [ ] T043 [US3] Create integration test test_manual_reassignment_with_conflict_resolution() in backend/app/tests/integration/test_bidder_number_flow.py
- [ ] T044 [US3] Verify previous holder receives new number and notification is created and displayed in donor PWA

---

## Phase 5: User Story 4 - Table Assignment Interface (P2)

**Story Goal**: Provide drag-and-drop seating chart interface for admins to assign guests to tables.

**Independent Test**: Navigate to Seating tab, drag a guest from Unassigned section to Table 3, verify assignment persists.

**Depends On**: Phase 1 (SeatingService), Phase 2 (event configuration), Phase 3 (guest data with bidder numbers)

**Duration**: 5-6 days

### Backend Implementation

- [ ] T045 [US4] Add PATCH /admin/events/{event_id}/guests/{guest_id}/table endpoint to assign guest to table in backend/app/api/v1/admin/seating.py
- [ ] T046 [US4] Add DELETE /admin/events/{event_id}/guests/{guest_id}/table endpoint to remove guest from table in backend/app/api/v1/admin/seating.py
- [ ] T047 [US4] Add GET /admin/events/{event_id}/seating/guests endpoint with pagination and filtering in backend/app/api/v1/admin/seating.py
- [ ] T048 [US4] Add GET /admin/events/{event_id}/seating/tables/{table_number}/occupancy endpoint in backend/app/api/v1/admin/seating.py
- [ ] T049 [US4] Implement assign_guest_to_table() with capacity validation in SeatingService in backend/app/services/seating_service.py
- [ ] T050 [US4] Implement remove_guest_from_table() in SeatingService in backend/app/services/seating_service.py

### Frontend State Management

- [ ] T051 [US4] Create Zustand seating store with table assignments, unassigned guests, and drag-drop state in frontend/augeo-admin/src/stores/seating.store.ts
- [ ] T052 [US4] Implement optimistic UI updates with rollback on error in seating store in frontend/augeo-admin/src/stores/seating.store.ts

### Frontend UI Components

- [ ] T053 [P] [US4] Create SeatingTab main container component in frontend/augeo-admin/src/routes/events/$eventId/seating.tsx
- [ ] T054 [P] [US4] Create TableCard component showing table number, capacity, and guest cards in frontend/augeo-admin/src/components/seating/TableCard.tsx
- [ ] T055 [P] [US4] Create GuestCard draggable component with guest info and bidder number in frontend/augeo-admin/src/components/seating/GuestCard.tsx
- [ ] T056 [P] [US4] Create UnassignedSection component listing guests without table assignments in frontend/augeo-admin/src/components/seating/UnassignedSection.tsx
- [ ] T057 [US4] Implement drag-and-drop handlers using react-beautiful-dnd or dnd-kit in frontend/augeo-admin/src/hooks/useSeatingDragDrop.ts
- [ ] T058 [US4] Add capacity validation and visual feedback (full table indicators) in TableCard component in frontend/augeo-admin/src/components/seating/TableCard.tsx
- [ ] T059 [US4] Implement party grouping visual indicators in GuestCard component in frontend/augeo-admin/src/components/seating/GuestCard.tsx

### API Integration

- [ ] T060 [US4] Implement assignGuestToTable(), removeGuestFromTable(), getSeatingGuests() in seating service in frontend/augeo-admin/src/services/seating.service.ts

### Integration & Testing

- [ ] T061 [P] [US4] Create unit test test_assign_guest_to_table() in backend/app/tests/unit/test_seating_service.py
- [ ] T062 [P] [US4] Create unit test test_validate_table_assignment_capacity_exceeded() in backend/app/tests/unit/test_seating_service.py
- [ ] T063 [P] [US4] Create unit test test_remove_guest_from_table() in backend/app/tests/unit/test_seating_service.py
- [ ] T064 [US4] Create integration test test_drag_drop_table_assignment() in backend/app/tests/integration/test_seating_assignment.py
- [ ] T065 [US4] Verify drag-and-drop completes within 500ms target with performance logging

### Auto-Assign Feature (Part of US4)

- [ ] T066 [US4] Create AutoAssignService with auto_assign_guests() party-aware algorithm in backend/app/services/auto_assign_service.py
- [ ] T067 [US4] Add POST /admin/events/{event_id}/seating/auto-assign endpoint in backend/app/api/v1/admin/seating.py
- [ ] T068 [P] [US4] Create AutoAssignButton component with confirmation dialog in frontend/augeo-admin/src/components/seating/AutoAssignButton.tsx
- [ ] T069 [US4] Create unit test test_auto_assign_keeps_parties_together() in backend/app/tests/unit/test_auto_assign_service.py
- [ ] T070 [US4] Create unit test test_auto_assign_fills_tables_sequentially() in backend/app/tests/unit/test_auto_assign_service.py

---

## Phase 6: User Story 5 - Manual Individual Table Assignment (P3) ✅

**Story Goal**: Provide dropdown-based table assignment as alternative to drag-and-drop.

**Independent Test**: Open guest detail modal, select Table 7 from dropdown, verify guest is assigned to Table 7.

**Depends On**: Phase 5 (table assignment API and service)

**Duration**: 1 day

**Status**: 3/4 tasks complete. Manual dropdown assignment fully functional, E2E test remaining.

### Frontend Implementation

- [x] T071 [P] [US5] Create TableAssignmentModal component with table dropdown in frontend/augeo-admin/src/components/seating/TableAssignmentModal.tsx
  - **Completed**: 184-line modal with Select dropdown, capacity validation, assignment preview
  - **Files**: TableAssignmentModal.tsx (new)
  - **Features**: Table selection dropdown with occupancy display (X/Y format), disabled full tables, preview of post-assignment occupancy, loading states
- [x] T072 [P] [US5] Add "Assign Table" button to GuestCard and integrate with modal state in seating page
  - **Completed**: Added optional "Assign Table" button to GuestCard component, integrated modal state management in seating.tsx
  - **Files**: GuestCard.tsx (updated with showAssignButton prop), UnassignedSection.tsx (updated with onAssignClick callback), seating.tsx (modal state + handlers)
  - **Implementation**: Modal state (modalOpen, selectedGuest), handlers (handleAssignClick, handleModalAssign), tableOccupancy calculation, full integration
- [x] T073 [US5] Add UI tests for TableAssignmentModal component
  - **Completed**: 10/10 tests passing
  - **Files**: TableAssignmentModal.test.tsx (new, 132 lines)
  - **Coverage**: Modal rendering, guest info display, dropdown structure, button states, visibility control, edge cases (null guest, different table counts)

### Testing

- [ ] T074 [US5] E2E test for manual dropdown assignment workflow (open modal → select table → verify assignment)

---

## Phase 7: User Story 6 - Donor View: My Seating Information (P2) ✅

**Story Goal**: Display seating information (table number, bidder number after check-in, tablemates) on donor event homepage.

**Independent Test**: Login as registered donor, view event homepage, verify seating section shows table number, check-in message (or bidder number if checked in), and tablemates with profile images.

**Depends On**: Phase 3 (bidder numbers), Phase 5 (table assignments)

**Duration**: 3 days

**Status**: 10/10 tasks complete. Full-stack donor seating view with check-in gating fully functional.

### Backend Implementation

- [x] T075 [US6] Add GET /donor/events/{event_id}/my-seating endpoint with tablemate aggregation and check-in gating in backend/app/api/v1/donor/events.py
  - **Completed**: New endpoint donor_seating.py (56 lines) with authentication and 404 error handling
  - **Files**: donor_seating.py (new), **init**.py (router registration)
  - **Features**: Returns SeatingInfoResponse with gated bidder numbers, tablemate list, capacity, assignment status
- [x] T076 [US6] Implement get_donor_seating_info() with check_in_time validation for bidder number visibility in backend/app/services/seating_service.py
  - **Completed**: New service method (87 lines, lines 330-444) with check-in gating logic
  - **Files**: seating_service.py (updated)
  - **Features**: Per-user check-in gating (hides bidder_number when check_in_time is None), per-tablemate check-in queries, tablemate aggregation with same table_number, capacity calculation, message generation (pending/check-in)

### Frontend Implementation

- [x] T077 [P] [US6] Create MySeatingSection collapsible component in frontend/donor-pwa/src/components/event/MySeatingSection.tsx
  - **Completed**: 154-line collapsible section component
  - **Files**: MySeatingSection.tsx (new), event-home/index.ts (export)
  - **Features**: Collapsible UI with open/close state, pending assignment alert, table number display with MapPin icon, bidder number integration via BidderNumberBadge, tablemates grid with capacity badge, empty state handling
- [x] T078 [P] [US6] Create BidderNumberBadge component with check-in conditional rendering in frontend/donor-pwa/src/components/event/BidderNumberBadge.tsx
  - **Completed**: 47-line conditional display component
  - **Files**: BidderNumberBadge.tsx (new), event-home/index.ts (export)
  - **Features**: Checked-in display (large Badge with CheckCircle2 icon), not checked-in display (Alert with "Check in at event" message), gated visibility logic
- [x] T079 [P] [US6] Create TablemateCard component showing profile image, name, company, bidder number in frontend/donor-pwa/src/components/event/TablemateCard.tsx
  - **Completed**: 84-line tablemate display card
  - **Files**: TablemateCard.tsx (new), event-home/index.ts (export)
  - **Features**: Avatar with profileImageUrl or initials fallback, horizontal name + bidder badge layout, optional company display, "Not checked in" italic text when bidderNumber is null
- [x] T080 [US6] Add MySeatingSection to event homepage before auction items section in frontend/donor-pwa/src/routes/events/$eventId/index.tsx
  - **Completed**: Integrated with useQuery hook and conditional rendering
  - **Files**: EventHomePage.tsx (updated)
  - **Implementation**: useQuery with 2-minute staleTime, conditional render between EventDetails and Event Description, silent error handling (non-blocking)
- [x] T081 [US6] Implement getMySeating() API call in event service in frontend/donor-pwa/src/services/event.service.ts
  - **Completed**: 52-line API service with TypeScript interfaces
  - **Files**: seating-service.ts (new)
  - **Features**: getMySeatingInfo() function, full TypeScript interfaces (MySeatingInfo, TablemateInfo, SeatingInfoResponse), axios client integration

### Integration & Testing

- [x] T082 [US6] Create integration test test_donor_seating_info_with_check_in_gating() verifying bidder number hidden before check-in in backend/app/tests/integration/test_seating_assignment.py
  - **Completed**: PASSING - Verifies bidder number is None before check-in, visible after check-in, message changes
  - **Coverage**: Core check-in gating logic for user's own bidder number
- [x] T083 [US6] Verify seating section shows "pending assignment" message when table_number is null
  - **Completed**: PASSING - test_donor_seating_pending_assignment() verifies has_table_assignment=False, pending message, empty tablemates
  - **Coverage**: Unassigned state handling and messaging
- [x] T084 [US6] Verify bidder number shows "Check in at the event to see your bidder number" before check-in
  - **Completed**: PASSING - test_donor_seating_tablemate_bidder_visibility() verifies per-tablemate check-in gating (alice visible, bob hidden)
  - **Coverage**: Per-tablemate check-in gating logic, mixed visibility scenario

---

## Phase 8: Polish & Cross-Cutting Concerns

**Goal**: Complete contract tests, seed data, documentation, and final integration testing.

**Duration**: 2-3 days

### Contract Testing

- [ ] T085 [P] Create contract test test_seating_endpoints_match_openapi_schema() in backend/app/tests/contract/test_seating_api.py
- [ ] T086 [P] Create contract test test_donor_seating_endpoint_matches_schema() in backend/app/tests/contract/test_seating_api.py

### Seed Data & Developer Tools

- [ ] T087 [P] Create seed_seating_data.py script to generate demo event with 10 tables, 30 guests, mixed assignments in backend/
- [ ] T088 Update quickstart.md with seating feature setup instructions

### Documentation

- [ ] T089 [P] Update backend README.md with seating API endpoint documentation
- [ ] T090 [P] Update frontend README.md with seating component usage examples

### Final Integration Testing

- [ ] T091 Run full test suite (pytest backend, vitest frontend) and verify 80%+ coverage for seating modules
- [ ] T092 Test complete flow: Configure event → Register guests → Auto-assign → Manual adjustments → Donor view
- [ ] T093 Verify performance targets: drag-drop <500ms, bidder assignment <100ms, page load <1.5s

---

## Dependencies & Execution Order

### User Story Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (US1: Event Config) ←─ Foundational
    ↓
Phase 3 (US2: Auto Bidder Assignment) ←─ Foundational
    ↓
Phase 4 (US3: Manual Bidder Management) ←─ Extends US2
    ↓
Phase 5 (US4: Table Assignment UI) ←─ Requires US1, US2, US3
    ↓
Phase 6 (US5: Manual Table Assignment) ←─ Alternative to US4
    ↓
Phase 7 (US6: Donor View) ←─ Requires US2, US4
    ↓
Phase 8 (Polish)
```

**Critical Path**: Phase 1 → Phase 2 → Phase 3 → Phase 5 → Phase 7

**Optional Extensions**: Phase 4 (manual bidder mgmt), Phase 6 (dropdown assignment)

### Parallel Execution Opportunities

**Within Phase 1 (Setup)**: T005, T006, T007-T011 can be done in parallel after migrations complete

**Within Phase 2 (US1)**: T017, T018, T020, T021 can be done in parallel

**Within Phase 3 (US2)**: T027, T028, T029-T031 can be done in parallel

**Within Phase 4 (US3)**: T038, T039, T041, T042 can be done in parallel

**Within Phase 5 (US4)**: T053-T056, T061-T063, T068 can be done in parallel

**Within Phase 6 (US5)**: T071, T072 can be done in parallel

**Within Phase 7 (US6)**: T077-T079 can be done in parallel

**Within Phase 8 (Polish)**: T085-T090 can be done in parallel

---

## Implementation Strategy

### MVP Scope (Week 1-2)

**Minimum Viable Product**: US1 (Event Config) + US2 (Auto Bidder Assignment)

This provides:

- Event seating configuration
- Automatic bidder number assignment on registration
- Foundation for all other features

**Rationale**: These two stories are foundational and required by all other features. Delivering them first enables parallel work on US3-US6.

### Incremental Delivery (Week 2-4)

**Iteration 1 (Week 2)**: Add US4 (Table Assignment UI) - provides core seating management
**Iteration 2 (Week 3)**: Add US3 (Manual Bidder Management) + US6 (Donor View) - completes end-to-end flow
**Iteration 3 (Week 4)**: Add US5 (Manual Assignment) + Polish - optional enhancements

### Testing Strategy

- **Unit Tests First**: Write unit tests for service layer (T020, T029-T031, T041-T042, T061-T063, T069-T070) before implementation
- **Integration Tests After**: Write integration tests after feature implementation to validate end-to-end flows
- **Contract Tests Last**: Write contract tests (T085-T086) after all endpoints are implemented

### Code Review Checkpoints

1. After Phase 1: Review migrations and model extensions
2. After Phase 2: Review event configuration flow
3. After Phase 3: Review bidder number assignment logic
4. After Phase 5: Review drag-and-drop implementation and performance
5. After Phase 7: Review complete donor-facing feature
6. After Phase 8: Final review before merge

---

## Task Summary

| Phase | Task Count | Parallel Tasks | Duration |
|-------|-----------|----------------|----------|
| Phase 1: Setup | 13 | 6 | 2-3 days |
| Phase 2: US1 (Event Config) | 10 | 4 | 2-3 days |
| Phase 3: US2 (Auto Bidder) | 11 | 5 | 2-3 days |
| Phase 4: US3 (Manual Bidder) | 13 | 4 | 2 days |
| Phase 5: US4 (Table UI) | 26 | 8 | 5-6 days |
| Phase 6: US5 (Manual Table) | 4 | 2 | 1 day |
| Phase 7: US6 (Donor View) | 10 | 3 | 3 days |
| Phase 8: Polish | 9 | 5 | 2-3 days |
| **Total** | **96** | **37** | **3-4 weeks** |

**Parallel Opportunities**: 40% of tasks (37/93) can be executed in parallel with other tasks in their phase.

**Independent Testing**: Each user story (US1-US6) has clear acceptance criteria and can be tested independently.

**Format Validation**: ✅ All tasks follow checklist format with checkbox, ID, optional [P] and [Story] labels, and file paths.

---

## Next Steps

1. **Review & Approve**: Review this task breakdown for completeness and accuracy
2. **Run /analyze**: Execute cross-artifact consistency check (requires tasks.md)
3. **Begin Implementation**: Start with Phase 1 (Setup) tasks T001-T013
4. **Track Progress**: Check off tasks as completed and commit regularly
5. **Test Incrementally**: Run tests after each phase to validate functionality

**Recommended First Task**: T001 (Create migration 013_add_seating_configuration.py)
