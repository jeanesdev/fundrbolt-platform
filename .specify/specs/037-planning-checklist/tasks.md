# Tasks: Event Planning Checklist

**Input**: Design documents from `/specs/037-planning-checklist/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/openapi.yaml ✅

**Tests**: Included per constitution requirement (80%+ code coverage). See Phase 8.

**Organization**: Tasks grouped by user story (5 stories: US1+US2 at P1, US3+US4 at P2, US5 at P3).

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1–US5)
- Paths relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migration, ORM models, and registration — all stories depend on these.

- [x] T001 Create Alembic migration for checklist_item_status_enum PostgreSQL enum and 3 new tables (checklist_templates, checklist_template_items, checklist_items) in backend/alembic/versions/xxxx_add_checklist_tables.py
- [x] T002 Create SQLAlchemy models (ChecklistTemplate, ChecklistTemplateItem, ChecklistItem) with UUIDMixin and TimestampMixin in backend/app/models/checklist.py
- [x] T003 Register checklist models in backend/app/models/__init__.py

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schemas, types, router skeleton, API client, store, and seed data — MUST complete before any user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 [P] Create Pydantic request/response schemas (ChecklistItemCreate, ChecklistItemUpdate, ChecklistItemStatusUpdate, ChecklistItemResponse, ChecklistResponse, ApplyTemplateRequest, SaveAsTemplateRequest, ChecklistTemplateResponse, ChecklistTemplateDetailResponse, ChecklistTemplateItemResponse, ChecklistTemplateUpdate, ChecklistReorderRequest) in backend/app/schemas/checklist.py
- [x] T005 [P] Create TypeScript type interfaces (ChecklistItem, ChecklistItemCreate, ChecklistItemUpdate, ChecklistItemStatusUpdate, ChecklistResponse, ChecklistTemplate, ChecklistTemplateDetail, ChecklistTemplateItem, ChecklistTemplateUpdate, ApplyTemplateRequest, SaveAsTemplateRequest, ChecklistReorderRequest) in frontend/fundrbolt-admin/src/types/checklist.ts
- [x] T006 Create admin_checklist.py API router with auth/role dependencies in backend/app/api/v1/admin_checklist.py and register it in backend/app/api/v1/__init__.py via api_router.include_router()
- [x] T007 [P] Create checklistService.ts API client with methods for all checklist and template endpoints in frontend/fundrbolt-admin/src/services/checklistService.ts
- [x] T008 [P] Create checklistStore.ts Zustand store with items, loading, error state, and action stubs in frontend/fundrbolt-admin/src/stores/checklistStore.ts
- [x] T009 Create seed script for system default template ("Fundraising Gala Default") with 26 template items matching spec's offset_days values in backend/seed_checklist_template.py

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — View and Manage Event Planning Checklist (Priority: P1) 🎯 MVP

**Goal**: Coordinators see a prominent checklist on the event edit page and can toggle item statuses (Not Complete ↔ In Progress ↔ Complete) with a single click.

**Independent Test**: Navigate to an event's edit page → see checklist panel above tabs → click an item's status badge to cycle through states → verify progress summary updates → refresh page to confirm persistence.

### Implementation for User Story 1

- [x] T010 [US1] Implement ChecklistService.get_event_checklist() returning items sorted by display_order/due_date/created_at with computed is_overdue and progress counts in backend/app/services/checklist_service.py
- [x] T011 [US1] Implement ChecklistService.update_item_status() with completed_at timestamp management (set on transition to complete, clear on transition away) in backend/app/services/checklist_service.py
- [x] T012 [US1] Implement GET /api/v1/admin/events/{event_id}/checklist and PATCH /api/v1/admin/events/{event_id}/checklist/{item_id}/status endpoints in backend/app/api/v1/admin_checklist.py
- [x] T013 [P] [US1] Create ChecklistItem.tsx component with status cycle-click badge (not_complete → in_progress → complete → not_complete), overdue visual flag, and completed strikethrough styling in frontend/fundrbolt-admin/src/features/events/components/ChecklistItem.tsx
- [x] T014 [P] [US1] Create ChecklistProgressBar.tsx component showing "X of Y complete" with visual progress bar and overdue count in frontend/fundrbolt-admin/src/features/events/components/ChecklistProgressBar.tsx
- [x] T015 [US1] Create ChecklistPanel.tsx persistent panel component that fetches checklist data, renders progress bar and item list in frontend/fundrbolt-admin/src/features/events/components/ChecklistPanel.tsx
- [x] T016 [US1] Wire checklistStore.ts actions: fetchChecklist(), updateItemStatus() with optimistic update in frontend/fundrbolt-admin/src/stores/checklistStore.ts
- [x] T017 [US1] Integrate ChecklistPanel into EventEditPage.tsx above the Outlet (tab content area) in frontend/fundrbolt-admin/src/features/events/EventEditPage.tsx

**Checkpoint**: User Story 1 complete — checklist is visible on event page with working status toggles and progress summary.

---

## Phase 4: User Story 2 — Add, Edit, and Delete Checklist Items (Priority: P1)

**Goal**: Coordinators can add new items with title + optional due date, edit existing items, and delete items with confirmation. Overdue items are visually flagged.

**Independent Test**: Open event checklist → click "Add Item" → enter title and due date → verify item appears → edit item title → delete item with confirmation → verify overdue styling on past-due items.

### Implementation for User Story 2

- [x] T018 [US2] Implement ChecklistService.create_item(), update_item(), and delete_item() methods in backend/app/services/checklist_service.py
- [x] T019 [US2] Implement POST /api/v1/admin/events/{event_id}/checklist, PATCH /{item_id}, and DELETE /{item_id} endpoints in backend/app/api/v1/admin_checklist.py
- [x] T020 [US2] Create ChecklistItemForm.tsx inline add/edit form with title input (required, max 200 chars) and optional date picker in frontend/fundrbolt-admin/src/features/events/components/ChecklistItemForm.tsx
- [x] T021 [US2] Add delete confirmation dialog, empty state ("No checklist items — add one or apply a template"), and "Add Item" button to ChecklistPanel.tsx in frontend/fundrbolt-admin/src/features/events/components/ChecklistPanel.tsx
- [x] T022 [US2] Wire checklistStore.ts actions: createItem(), updateItem(), deleteItem() in frontend/fundrbolt-admin/src/stores/checklistStore.ts

**Checkpoint**: User Stories 1 AND 2 complete — full checklist CRUD with status tracking. This is the P1 MVP.

---

## Phase 5: User Story 3 — Automatic Checklist from Default Template on Event Creation (Priority: P2)

**Goal**: New events are auto-populated with checklist items from the NPO's default template (or system default). Template due dates are calculated relative to the event date. Changing the event date recalculates template-derived due dates.

**Independent Test**: Run seed script → create a new event with a date → verify 26 checklist items appear with concrete due dates calculated from event date → change event date → verify template-derived due dates recalculate.

### Implementation for User Story 3

- [x] T023 [US3] Implement ChecklistService.resolve_default_template() to find NPO default template or fall back to system default in backend/app/services/checklist_service.py
- [x] T024 [US3] Implement ChecklistService.populate_from_template() to copy template items with due_date = event_date + offset_days in backend/app/services/checklist_service.py
- [x] T025 [US3] Hook checklist auto-population into EventService.create_event() — call populate_from_template() after event commit in backend/app/services/event_service.py
- [x] T026 [US3] Implement ChecklistService.recalculate_template_dates() for items where due_date_is_template_derived=True when event date changes in backend/app/services/checklist_service.py
- [x] T027 [US3] Hook date recalculation into event update flow — snapshot event_datetime before update, compare after, call recalculate_template_dates() if changed — in backend/app/services/event_service.py
- [x] T028 [US3] Implement POST /api/v1/admin/events/{event_id}/checklist/apply-template endpoint with replace/append mode in backend/app/api/v1/admin_checklist.py
- [x] T029 [US3] Create ApplyTemplateDialog.tsx with template selector dropdown and Replace/Append radio buttons in frontend/fundrbolt-admin/src/features/events/components/ApplyTemplateDialog.tsx
- [x] T030 [US3] Add "Apply Template" button to ChecklistPanel.tsx and wire applyTemplate() action in store in frontend/fundrbolt-admin/src/features/events/components/ChecklistPanel.tsx

**Checkpoint**: User Story 3 complete — new events auto-populate checklist, template application works with replace/append, event date changes recalculate template-derived due dates.

---

## Phase 6: User Story 4 — Save and Manage Checklist Templates at Organization Level (Priority: P2)

**Goal**: Admins can save an event checklist as a named template, view/edit/delete templates, and designate one as the NPO default.

**Independent Test**: View an event checklist → click "Save as Template" → name it → verify it appears in template list API → set it as default → create a new event → verify it uses the custom default.

### Implementation for User Story 4

- [x] T031 [US4] Implement ChecklistService template CRUD: list_templates(), get_template(), update_template(), delete_template(), set_default_template() in backend/app/services/checklist_service.py
- [x] T032 [US4] Implement ChecklistService.save_as_template() to convert event checklist items to template items with offset_days in backend/app/services/checklist_service.py
- [x] T033 [US4] Implement GET/PATCH/DELETE /api/v1/admin/npos/{npo_id}/checklist-templates and /{template_id} endpoints in backend/app/api/v1/admin_checklist.py
- [x] T034 [US4] Implement POST /api/v1/admin/npos/{npo_id}/checklist-templates/{template_id}/set-default endpoint in backend/app/api/v1/admin_checklist.py
- [x] T035 [US4] Implement POST /api/v1/admin/events/{event_id}/checklist/save-as-template endpoint in backend/app/api/v1/admin_checklist.py
- [x] T036 [P] [US4] Create SaveTemplateDialog.tsx with name input and save action in frontend/fundrbolt-admin/src/features/events/components/SaveTemplateDialog.tsx
- [x] T037 [US4] Wire checklistStore.ts template actions: fetchTemplates(), saveAsTemplate(), setDefaultTemplate() in frontend/fundrbolt-admin/src/stores/checklistStore.ts
- [x] T038 [US4] Add "Save as Template" button to ChecklistPanel.tsx header in frontend/fundrbolt-admin/src/features/events/components/ChecklistPanel.tsx
- [x] T039 [US4] Create TemplateManagementDialog.tsx with template list view, inline edit/rename, delete with confirmation, and set-default toggle in frontend/fundrbolt-admin/src/features/events/components/TemplateManagementDialog.tsx
- [x] T040 [US4] Wire checklistStore.ts template management actions: updateTemplate(), deleteTemplate(), and add "Manage Templates" button to ChecklistPanel.tsx header in frontend/fundrbolt-admin/src/stores/checklistStore.ts

**Checkpoint**: User Story 4 complete — full template lifecycle (save, list, edit, delete, set default). Combined with US3, the template system is fully functional.

---

## Phase 7: User Story 5 — Reorder Checklist Items via Drag-and-Drop (Priority: P3)

**Goal**: Coordinators can drag items to reorder them, with custom order persisted.

**Independent Test**: Open event checklist with multiple items → drag an item to a new position → verify new order → refresh page → verify order persists.

### Implementation for User Story 5

- [x] T041 [US5] Install @dnd-kit/core and @dnd-kit/sortable packages in frontend/fundrbolt-admin/package.json
- [x] T042 [US5] Implement ChecklistService.reorder_items() accepting ordered list of item IDs and updating display_order in backend/app/services/checklist_service.py
- [x] T043 [US5] Implement PATCH /api/v1/admin/events/{event_id}/checklist/reorder endpoint in backend/app/api/v1/admin_checklist.py
- [x] T044 [US5] Wrap ChecklistPanel item list with DndContext and SortableContext from @dnd-kit, add drag handles to ChecklistItem.tsx in frontend/fundrbolt-admin/src/features/events/components/ChecklistPanel.tsx
- [x] T045 [US5] Wire checklistStore.ts reorderItems() action with optimistic reorder in frontend/fundrbolt-admin/src/stores/checklistStore.ts

**Checkpoint**: User Story 5 complete — all 5 user stories implemented.

---

## Phase 8: Tests

**Purpose**: Backend unit and integration tests per constitution requirement (80%+ code coverage).

- [x] T046 [P] Write unit tests for ChecklistService CRUD operations (create, update, delete, status transitions, completed_at management, overdue computation, sort order) in backend/app/tests/test_checklist_service.py
- [x] T047 [P] Write unit tests for ChecklistService template operations (resolve_default_template, populate_from_template, save_as_template, recalculate_template_dates, apply-template replace/append modes) in backend/app/tests/test_checklist_service.py
- [x] T048 [P] Write API integration tests for checklist item endpoints (GET list, POST create, PATCH update, PATCH status, DELETE, reorder) with auth/role enforcement in backend/app/tests/test_admin_checklist.py
- [x] T049 [P] Write API integration tests for template endpoints (list, get, update, delete, set-default, apply-template, save-as-template) with auth/role enforcement in backend/app/tests/test_admin_checklist.py

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: CI validation, seed data, documentation.

- [x] T050 [P] Run backend CI checks: ruff check, ruff format, mypy strict, pytest in backend/
- [x] T051 [P] Run frontend CI checks: pnpm lint, pnpm format:check, pnpm build in frontend/fundrbolt-admin/
- [x] T052 Run seed_checklist_template.py and verify system default template in database
- [x] T053 Run quickstart.md validation steps to confirm all API endpoints work end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — first MVP increment
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1 (different endpoints/components) but logically builds on US1's ChecklistPanel
- **US3 (Phase 5)**: Depends on Phase 2 + seed data (T009) — template application logic
- **US4 (Phase 6)**: Depends on Phase 2 — template management (US3 and US4 can be developed in parallel)
- **US5 (Phase 7)**: Depends on Phase 2 + US1 (needs ChecklistPanel to add DnD to)
- **Tests (Phase 8)**: Can begin after Phase 4 for US1+US2 tests; after Phase 6 for template tests
- **Polish (Phase 9)**: Depends on all desired stories and tests being complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no story dependencies (core display + status toggle)
- **US2 (P1)**: After Phase 2 — shares ChecklistPanel with US1 but adds independent CRUD actions
- **US3 (P2)**: After Phase 2 — uses template tables but doesn't need US4's management UI (system default suffices)
- **US4 (P2)**: After Phase 2 — independent template CRUD, can develop in parallel with US3
- **US5 (P3)**: After Phase 2 + US1 — adds DnD to existing ChecklistPanel

### Within Each User Story

- Backend service methods before API endpoints
- API endpoints before frontend components
- Frontend components before store wiring
- Store wiring before integration into existing pages

### Parallel Opportunities

Phase 2 parallelism:
```
# Can run in parallel (different files, different projects):
T004: Pydantic schemas (backend)
T005: TypeScript types (frontend)
# Then in parallel:
T007: Frontend service
T008: Frontend store
```

US1 component parallelism:
```
# Can run in parallel (different component files):
T013: ChecklistItem.tsx
T014: ChecklistProgressBar.tsx
```

Cross-story parallelism (with multiple developers):
```
# After Phase 2 completes:
Developer A: US1 (Phase 3) → US2 (Phase 4)
Developer B: US3 (Phase 5) + US4 (Phase 6) — template system
Developer C: US5 (Phase 7) after US1 merge
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (view checklist + status toggle)
4. Complete Phase 4: User Story 2 (add/edit/delete items)
5. **STOP and VALIDATE**: Test P1 stories independently — coordinators can manage a full checklist
6. Deploy/demo if ready — this covers the core feature request

### Incremental Delivery

1. Setup + Foundational → Database and infrastructure ready
2. US1 + US2 → Full checklist CRUD — **MVP deployable** ✅
3. US3 + US4 → Template system — events auto-populate, templates reusable
4. US5 → Drag-and-drop polish — UX enhancement

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 53 |
| Phase 1 (Setup) | 3 |
| Phase 2 (Foundational) | 6 |
| Phase 3 (US1 - P1) | 8 |
| Phase 4 (US2 - P1) | 5 |
| Phase 5 (US3 - P2) | 8 |
| Phase 6 (US4 - P2) | 10 |
| Phase 7 (US5 - P3) | 5 |
| Phase 8 (Tests) | 4 |
| Phase 9 (Polish) | 4 |
| Parallelizable tasks | 14 |
| MVP scope | Phases 1–4 (22 tasks) |
