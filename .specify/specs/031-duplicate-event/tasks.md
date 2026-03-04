# Tasks: Duplicate Event

**Input**: Design documents from `/specs/031-duplicate-event/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/duplicate-event-api.yaml, research.md, quickstart.md

**Tests**: Included — the spec requires verifiable acceptance scenarios and the plan includes test files.

**Organization**: Tasks grouped by user story. US1 is the MVP (core duplication). US2 adds a second entry point. US3-US5 add optional inclusion toggles.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: No new project structure or dependencies needed. This feature builds on existing infrastructure. Setup is limited to the Pydantic request schema and TypeScript type.

- [ ] T001 [P] Add `DuplicateEventRequest` Pydantic schema to `backend/app/schemas/event.py` with fields: `include_media: bool = False`, `include_links: bool = False`, `include_donation_labels: bool = False`
- [ ] T002 [P] Add `DuplicateEventOptions` TypeScript interface to `frontend/fundrbolt-admin/src/types/event.ts` with fields: `include_media?: boolean`, `include_links?: boolean`, `include_donation_labels?: boolean`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `copy_blob()` method in MediaService is needed before any media-inclusive duplication can work. The core `duplicate_event()` service method is the foundation for all user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Add `copy_blob(source_blob_name: str, target_blob_name: str) -> str` static async method to `backend/app/services/media_service.py` — use Azure `start_copy_from_url()` with source SAS URL for server-side copy; return the new blob URL
- [ ] T004 Implement `duplicate_event()` async method in `backend/app/services/event_service.py` — accept `event_id`, `user_id`, and `DuplicateEventRequest` options; load source event with eager-loaded relationships (`food_options`, `ticket_packages` with `custom_options`, `tables`, `sponsors`, `media`, `links`, `donation_labels`); create new Event per data-model.md field mapping (name="{name} (Copy)" truncated to 255 chars, status=DRAFT, event_datetime=None, version=1, slug via `_generate_unique_slug()`); clone always-included children (FoodOption, TicketPackage+CustomTicketOption with sold_count=0, EventTable without captain, Sponsor with shared logo refs); conditionally clone EventMedia (with `copy_blob` deep-copy), EventLink, DonationLabel based on request options; wrap in single transaction; return the new Event

**Checkpoint**: Core duplication logic is in place. API and UI can now be built.

---

## Phase 3: User Story 1 — Duplicate Event from Event List (Priority: P1) 🎯 MVP

**Goal**: Admin clicks "Duplicate" on event list, gets a new DRAFT event with cloned data, and is redirected to the edit page.

**Independent Test**: Duplicate any existing event from the list; verify new DRAFT event has correct cloned data, no transactional data, cleared date, unique slug.

### Implementation for User Story 1

- [ ] T005 [US1] Add `POST /{event_id}/duplicate` endpoint to `backend/app/api/v1/events.py` — accept `DuplicateEventRequest` body (defaults to empty/all-false); authenticate via `get_current_active_user`; verify NPO access via `PermissionService`; call `EventService.duplicate_event()`; log duplication action to audit trail referencing both source and new event IDs (FR-019); return 201 with `EventDetailResponse` including SAS URLs for media; handle 404 (event not found) and 403 (no permission)
- [ ] T006 [US1] Add `duplicateEvent(eventId: string, options?: DuplicateEventOptions): Promise<EventDetail>` method to `frontend/fundrbolt-admin/src/services/event-service.ts` — POST to `/events/${eventId}/duplicate` with options body
- [ ] T007 [US1] Add `duplicateEvent` async action to Zustand store in `frontend/fundrbolt-admin/src/stores/event-store.ts` — call `eventService.duplicateEvent()`, set loading/error state, return new event data
- [ ] T008 [US1] Create `DuplicateEventDialog` component at `frontend/fundrbolt-admin/src/features/events/components/DuplicateEventDialog.tsx` — Radix UI AlertDialog with: source event name display, three checkboxes (Include media files — unchecked default, Include external links — checked default, Include donation labels — checked default), Confirm/Cancel buttons, loading spinner during duplication, calls store action on confirm, shows success toast with new event name, triggers navigation to new event edit page on success
- [ ] T009 [US1] Add "Duplicate" button to `EventCard` in `frontend/fundrbolt-admin/src/features/events/EventListPage.tsx` — add Copy icon button in the action row alongside existing Edit/Publish/Delete/Close buttons; clicking opens `DuplicateEventDialog` with the event's ID and name passed as props

**Checkpoint**: US1 complete — admin can duplicate events from the event list page with full dialog flow.

---

## Phase 4: User Story 2 — Duplicate Event from Event Detail Page (Priority: P1)

**Goal**: Admin clicks "Duplicate Event" from the event detail/edit page. Identical behavior to US1 but different entry point.

**Independent Test**: Navigate to any event's edit page, click "Duplicate Event", verify same cloning behavior.

### Implementation for User Story 2

- [ ] T010 [US2] Add "Duplicate Event" action button to `frontend/fundrbolt-admin/src/features/events/EventEditPage.tsx` — add a button (Copy icon + "Duplicate Event" label) in the page header action area; clicking opens the same `DuplicateEventDialog` component created in T008; pass current event's ID and name as props

**Checkpoint**: US2 complete — admin can duplicate from both the event list and event detail page.

---

## Phase 5: User Story 3 — Optionally Include Media (Priority: P2)

**Goal**: When duplicating, the "Include media files" checkbox triggers deep-copy of all event media blobs to new storage paths.

**Independent Test**: Duplicate an event with media files — once with checkbox checked (verify media present on clone with independent blob paths), once unchecked (verify no media).

### Implementation for User Story 3

_Note: The dialog checkbox UI (T008), backend option handling (T004), and `copy_blob` method (T003) were implemented in earlier phases. This phase validates the media deep-copy integration works end-to-end._

- [ ] T011 [US3] Write backend test for media deep-copy in `backend/app/tests/test_event_duplicate.py` — test that when `include_media=True`, each source EventMedia record produces a new EventMedia on the clone with a different `blob_name` and `file_url`; verify `copy_blob` is called for each media file; test that when `include_media=False`, no EventMedia records are created on the clone
- [ ] T012 [US3] Write backend test for `copy_blob` in `backend/app/tests/test_event_duplicate.py` — mock the Azure blob client; verify `start_copy_from_url()` is called with correct source SAS URL and target blob name; verify returned URL matches new blob path

**Checkpoint**: US3 complete — media deep-copy is implemented and tested.

---

## Phase 6: User Story 4 — Optionally Include Event Links (Priority: P3)

**Goal**: "Include external links" checkbox (checked by default) controls whether EventLink records are cloned.

**Independent Test**: Duplicate with links included — verify links present. Duplicate with links excluded — verify no links.

### Implementation for User Story 4

_Note: The dialog checkbox and backend conditional cloning were implemented in T004 and T008. This phase adds test coverage._

- [ ] T013 [US4] Write backend test for link cloning in `backend/app/tests/test_event_duplicate.py` — test that when `include_links=True`, all source EventLink records are cloned with new IDs and correct event_id; verify `link_type`, `url`, `label`, `platform`, `display_order` are copied; test that when `include_links=False`, no EventLink records are created

**Checkpoint**: US4 complete — link inclusion/exclusion is tested.

---

## Phase 7: User Story 5 — Optionally Include Donation Labels (Priority: P3)

**Goal**: "Include donation labels" checkbox (checked by default) controls whether DonationLabel records are cloned.

**Independent Test**: Duplicate with labels included — verify labels present. Duplicate with labels excluded — verify no labels.

### Implementation for User Story 5

- [ ] T014 [US5] Write backend test for donation label cloning in `backend/app/tests/test_event_duplicate.py` — test that when `include_donation_labels=True`, all source DonationLabel records are cloned with new IDs, correct event_id, same `name` and `is_active`, and `retired_at=None`; test that when `include_donation_labels=False`, no DonationLabel records are created

**Checkpoint**: US5 complete — donation label inclusion/exclusion is tested.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Core duplication tests, edge cases, and CI validation.

- [ ] T015 [P] Write core duplication backend tests in `backend/app/tests/test_event_duplicate.py` — test Event field mapping (name with " (Copy)" suffix, status=DRAFT, event_datetime=None, version=1, unique slug, same NPO); test FoodOption cloning (name, description, display_order preserved); test TicketPackage cloning (all config fields preserved, sold_count=0, is_enabled preserved, version=1) with CustomTicketOption children; test EventTable cloning (table_number, custom_capacity, table_name preserved, table_captain_id=None); test Sponsor cloning (all fields copied, logo URLs shared); test name truncation at 255 chars
- [ ] T016 [P] Write API-level tests in `backend/app/tests/test_event_duplicate_api.py` — test 201 response with correct EventDetailResponse; test 404 for non-existent event; test 403 for unauthorized user; test default options (no media/links/labels); test with all options enabled
- [ ] T017 [P] Run all backend CI checks: `cd backend && poetry run ruff check . && poetry run ruff format --check . && poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests' && poetry run pytest -v --tb=short`
- [ ] T018 [P] Run all frontend CI checks: `cd frontend/fundrbolt-admin && pnpm lint && pnpm format:check && pnpm build`
- [ ] T019 Run end-to-end manual validation per quickstart.md — duplicate an event via curl, verify response; duplicate from event list UI; duplicate from event edit page UI; verify all cloned data; verify redirect to edit page; verify success toast

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001 and T002 can run in parallel immediately
- **Foundational (Phase 2)**: T003 has no dependencies (can start with Phase 1). T004 depends on T001 (schema) and T003 (copy_blob)
- **US1 (Phase 3)**: T005 depends on T004. T006-T007 depend on T002. T008 depends on T007. T009 depends on T008.
- **US2 (Phase 4)**: T010 depends on T008 (reuses DuplicateEventDialog)
- **US3 (Phase 5)**: T011-T012 depend on T004 and T003 (test the implementations)
- **US4 (Phase 6)**: T013 depends on T004
- **US5 (Phase 7)**: T014 depends on T004
- **Polish (Phase 8)**: T015-T016 depend on T004-T005. T017-T018 depend on all implementation tasks.

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 2) — core MVP
- **US2 (P1)**: Depends on US1 (reuses DuplicateEventDialog from T008)
- **US3 (P2)**: Depends on Foundational only — tests validate existing implementation
- **US4 (P3)**: Depends on Foundational only — tests validate existing implementation
- **US5 (P3)**: Depends on Foundational only — tests validate existing implementation
- **US3, US4, US5 can run in parallel** with each other (all are test-only phases)

### Within Each User Story

- Backend endpoint before frontend service
- Frontend service before store
- Store before components
- Components before page integration

### Parallel Opportunities

- T001 and T002 can run in parallel (different languages, different files)
- T003 can start in parallel with T001 (different files)
- T006 and T007 can start once T002 is done (frontend work parallel to backend endpoint)
- T011-T014 can all run in parallel (all independent test files)
- T015, T016 can run in parallel (different test files)
- T017, T018 can run in parallel (backend vs frontend CI)

---

## Parallel Example: User Story 1

```bash
# After Foundational is done, launch backend and frontend in parallel:

# Backend (sequential):
Task T005: "Add POST /{event_id}/duplicate endpoint to backend/app/api/v1/events.py"

# Frontend (sequential chain, can start at same time as T005):
Task T006: "Add duplicateEvent() method to frontend/.../services/event-service.ts"
Task T007: "Add duplicateEvent action to frontend/.../stores/event-store.ts"
Task T008: "Create DuplicateEventDialog component"
Task T009: "Add Duplicate button to EventListPage"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002) — ~10 minutes
2. Complete Phase 2: Foundational (T003-T004) — ~45 minutes
3. Complete Phase 3: US1 (T005-T009) — ~60 minutes
4. **STOP and VALIDATE**: Duplicate an event from the list, verify all cloned data
5. Deploy/demo the core duplication feature

### Incremental Delivery

1. Setup + Foundational → Core logic ready
2. Add US1 → Test from event list → Deploy (MVP!)
3. Add US2 → Test from event edit page → Deploy (both entry points)
4. Add US3-US5 tests → Validate all optional inclusions → Deploy (full feature)
5. Polish → CI validation, edge case tests → Release

### Parallel Team Strategy

With two developers after Foundational:

1. Both complete Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 backend (T005) → US1 tests (T015-T016)
   - Developer B: US1 frontend (T006-T009) → US2 (T010)
3. Either developer: US3-US5 test tasks (T011-T014)
4. Both: Polish (T017-T019)

---

## Notes

- No database migrations needed — all existing tables support cloning
- The `DuplicateEventDialog` component is shared between US1 (event list) and US2 (event edit page)
- US3-US5 are primarily test phases because the conditional cloning logic and dialog checkboxes are built into the foundational service method (T004) and dialog component (T008)
- The dialog defaults: media=unchecked, links=checked, donation labels=checked (per spec FR-013, FR-014, FR-015)
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
