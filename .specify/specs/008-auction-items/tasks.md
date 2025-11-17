# Tasks: Auction Items

**Input**: Design documents from `/specs/008-auction-items/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by feature capability to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which capability this task belongs to (US1 = Core CRUD, US2 = Media Management, US3 = Status Workflow)
- Include exact file paths in descriptions

## Path Conventions

- Backend: `backend/app/` (models, schemas, services, api)
- Frontend Admin: `frontend/augeo-admin/src/`
- Tests: `backend/app/tests/` (unit, integration, e2e)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema and basic project setup

- [ ] T001 Create Alembic migration for auction_items tables in backend/alembic/versions/XXXX_add_auction_items.py
- [ ] T002 Run migration and verify tables created (auction_items, auction_item_media)
- [ ] T003 [P] Add AuctionItem relationship to Event model in backend/app/models/event.py

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core models and schemas that ALL features depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create AuctionType, ItemStatus, MediaType enums in backend/app/models/auction_item.py
- [ ] T005 [P] Create AuctionItem SQLAlchemy model in backend/app/models/auction_item.py
- [ ] T006 [P] Create AuctionItemMedia SQLAlchemy model in backend/app/models/auction_item.py
- [ ] T007 Create AuctionItemBase Pydantic schema in backend/app/schemas/auction_item.py
- [ ] T008 [P] Create AuctionItemCreate schema with validation in backend/app/schemas/auction_item.py
- [ ] T009 [P] Create AuctionItemUpdate schema (partial fields) in backend/app/schemas/auction_item.py
- [ ] T010 [P] Create AuctionItemResponse schema in backend/app/schemas/auction_item.py
- [ ] T011 [P] Create AuctionItemDetail schema (includes media) in backend/app/schemas/auction_item.py
- [ ] T012 [P] Create AuctionItemMedia schemas in backend/app/schemas/auction_item_media.py

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Core Auction Item CRUD (Priority: P1) 🎯 MVP

**Goal**: Event coordinators can create, read, update, and delete auction items with auto-assigned bid numbers

**Independent Test**: Create an auction item via API, verify bid number 100 assigned, retrieve item details, update fields, delete item

### Implementation for User Story 1

- [ ] T013 [P] [US1] Implement bid number assignment logic in backend/app/services/auction_item_service.py
- [ ] T014 [US1] Implement create_auction_item method in backend/app/services/auction_item_service.py
- [ ] T015 [US1] Implement get_auction_item_by_id method in backend/app/services/auction_item_service.py
- [ ] T016 [US1] Implement list_auction_items with pagination/filters in backend/app/services/auction_item_service.py
- [ ] T017 [US1] Implement update_auction_item method in backend/app/services/auction_item_service.py
- [ ] T018 [US1] Implement delete_auction_item with soft/hard delete logic in backend/app/services/auction_item_service.py
- [ ] T019 [US1] Create POST /api/v1/events/{event_id}/auction-items endpoint in backend/app/api/v1/auction_items.py
- [ ] T020 [P] [US1] Create GET /api/v1/events/{event_id}/auction-items endpoint in backend/app/api/v1/auction_items.py
- [ ] T021 [P] [US1] Create GET /api/v1/events/{event_id}/auction-items/{item_id} endpoint in backend/app/api/v1/auction_items.py
- [ ] T022 [P] [US1] Create PATCH /api/v1/events/{event_id}/auction-items/{item_id} endpoint in backend/app/api/v1/auction_items.py
- [ ] T023 [P] [US1] Create DELETE /api/v1/events/{event_id}/auction-items/{item_id} endpoint in backend/app/api/v1/auction_items.py
- [ ] T024 [US1] Add role-based access control (NPO Admin/Staff only) to auction item endpoints
- [ ] T025 [US1] Add audit logging for all auction item CRUD operations
- [ ] T026 [US1] Add sponsor attribution query (join with sponsors table)

### Tests for User Story 1

- [ ] T027 [P] [US1] Unit test bid number assignment (sequential 100-999) in backend/app/tests/unit/test_auction_item_service.py
- [ ] T028 [P] [US1] Unit test buy-now price validation (must be >= starting_bid) in backend/app/tests/unit/test_auction_item_service.py
- [ ] T029 [P] [US1] Unit test soft vs hard delete logic in backend/app/tests/unit/test_auction_item_service.py
- [ ] T030 [P] [US1] Integration test create auction item workflow in backend/app/tests/integration/test_auction_item_crud.py
- [ ] T031 [P] [US1] Integration test list items with pagination in backend/app/tests/integration/test_auction_item_crud.py
- [ ] T032 [P] [US1] Integration test update auction item in backend/app/tests/integration/test_auction_item_crud.py
- [ ] T033 [P] [US1] Integration test concurrent bid number assignment in backend/app/tests/integration/test_auction_item_crud.py
- [ ] T034 [P] [US1] Integration test sponsor attribution display in backend/app/tests/integration/test_auction_item_crud.py

### Frontend for User Story 1

- [ ] T035 [P] [US1] Create AuctionItemList component in frontend/augeo-admin/src/components/auction-items/AuctionItemList.tsx
- [ ] T036 [P] [US1] Create AuctionItemForm component in frontend/augeo-admin/src/components/auction-items/AuctionItemForm.tsx
- [ ] T037 [US1] Create auction items list page in frontend/augeo-admin/src/pages/events/[eventId]/auction-items/index.tsx
- [ ] T038 [P] [US1] Create auction item create page in frontend/augeo-admin/src/pages/events/[eventId]/auction-items/create.tsx
- [ ] T039 [P] [US1] Create auction item edit page in frontend/augeo-admin/src/pages/events/[eventId]/auction-items/[itemId]/edit.tsx
- [ ] T040 [US1] Implement auctionItemService API client in frontend/augeo-admin/src/services/auctionItemService.ts
- [ ] T041 [US1] Add filters (auction type, status, search) to item list
- [ ] T042 [US1] Add form validation with Zod schema matching Pydantic schema
- [ ] T043 [US1] Display auto-assigned bid number (read-only field)

**Checkpoint**: At this point, auction items can be created, viewed, edited, and deleted through admin UI

---

## Phase 4: User Story 2 - Media Management (Priority: P1) 🎯 MVP

**Goal**: Event coordinators can upload images/videos to auction items with drag-drop interface and reordering

**Independent Test**: Create auction item, upload 3 images, reorder them via drag-drop, delete one image, verify display order persists

### Implementation for User Story 2

- [ ] T044 [US2] Implement generate_upload_url for media in backend/app/services/auction_item_media_service.py
- [ ] T045 [US2] Implement confirm_media_upload with thumbnail generation in backend/app/services/auction_item_media_service.py
- [ ] T046 [US2] Implement reorder_media method in backend/app/services/auction_item_media_service.py
- [ ] T047 [US2] Implement delete_media with blob cleanup in backend/app/services/auction_item_media_service.py
- [ ] T048 [US2] Implement thumbnail generation with Pillow (200x200, 800x600) in backend/app/services/auction_item_media_service.py
- [ ] T049 [US2] Implement video URL validation (YouTube/Vimeo) in backend/app/services/auction_item_media_service.py
- [ ] T050 [US2] Create POST /api/v1/events/{event_id}/auction-items/{item_id}/media endpoint in backend/app/api/v1/auction_item_media.py
- [ ] T051 [P] [US2] Create PATCH /api/v1/events/{event_id}/auction-items/{item_id}/media/order endpoint in backend/app/api/v1/auction_item_media.py
- [ ] T052 [P] [US2] Create DELETE /api/v1/events/{event_id}/auction-items/{item_id}/media/{media_id} endpoint in backend/app/api/v1/auction_item_media.py
- [ ] T053 [US2] Add file size validation (10MB images, 100MB videos)
- [ ] T054 [US2] Add file type validation (JPEG, PNG, WebP for images; MP4, WebM for videos)
- [ ] T055 [US2] Add media count limits (20 images, 5 videos per item)
- [ ] T056 [US2] Generate signed SAS URLs with 15-minute expiry for media access

### Tests for User Story 2

- [ ] T057 [P] [US2] Unit test thumbnail generation with Pillow in backend/app/tests/unit/test_auction_item_media_service.py
- [ ] T058 [P] [US2] Unit test file size validation in backend/app/tests/unit/test_auction_item_media_service.py
- [ ] T059 [P] [US2] Unit test file type validation in backend/app/tests/unit/test_auction_item_media_service.py
- [ ] T060 [P] [US2] Unit test media count limits in backend/app/tests/unit/test_auction_item_media_service.py
- [ ] T061 [P] [US2] Integration test media upload workflow in backend/app/tests/integration/test_auction_item_media.py
- [ ] T062 [P] [US2] Integration test media reordering in backend/app/tests/integration/test_auction_item_media.py
- [ ] T063 [P] [US2] Integration test media deletion with blob cleanup in backend/app/tests/integration/test_auction_item_media.py

### Frontend for User Story 2

- [ ] T064 [P] [US2] Create MediaUploadZone component with drag-drop in frontend/augeo-admin/src/components/auction-items/MediaUploadZone.tsx
- [ ] T065 [P] [US2] Create MediaGallery component with reordering in frontend/augeo-admin/src/components/auction-items/MediaGallery.tsx
- [ ] T066 [US2] Integrate MediaUploadZone into AuctionItemForm
- [ ] T067 [US2] Add upload progress indicators for each file
- [ ] T068 [US2] Implement drag-and-drop reordering with react-beautiful-dnd or dnd-kit
- [ ] T069 [US2] Add image preview thumbnails before upload confirmation
- [ ] T070 [US2] Add video URL input field (YouTube/Vimeo alternative to upload)
- [ ] T071 [US2] Display media gallery in item detail view with lazy loading

**Checkpoint**: At this point, media can be uploaded, reordered, and deleted with proper thumbnails and validation

---

## Phase 5: User Story 3 - Status Workflow & Publishing (Priority: P1) 🎯 MVP

**Goal**: Event coordinators can publish items (draft → published), withdraw items, and see status-appropriate UI behaviors

**Independent Test**: Create draft item, publish it (visible to donors), withdraw it (hidden from donors), verify status transitions enforced

### Implementation for User Story 3

- [ ] T072 [US3] Implement publish_item method with validation in backend/app/services/auction_item_service.py
- [ ] T073 [US3] Implement withdraw_item method (soft delete) in backend/app/services/auction_item_service.py
- [ ] T074 [US3] Implement status transition validation in backend/app/services/auction_item_service.py
- [ ] T075 [US3] Create POST /api/v1/events/{event_id}/auction-items/{item_id}/publish endpoint in backend/app/api/v1/auction_items.py
- [ ] T076 [P] [US3] Create POST /api/v1/events/{event_id}/auction-items/{item_id}/withdraw endpoint in backend/app/api/v1/auction_items.py
- [ ] T077 [US3] Add public vs authenticated filtering (published items public, drafts require auth)
- [ ] T078 [US3] Validate required fields before publish (title, description, starting_bid)
- [ ] T079 [US3] Add warning if publishing item with no images (soft warning, not blocking)

### Tests for User Story 3

- [ ] T080 [P] [US3] Unit test status transition validation in backend/app/tests/unit/test_auction_item_service.py
- [ ] T081 [P] [US3] Unit test publish validation (required fields) in backend/app/tests/unit/test_auction_item_service.py
- [ ] T082 [P] [US3] Integration test publish workflow in backend/app/tests/integration/test_auction_item_crud.py
- [ ] T083 [P] [US3] Integration test withdraw workflow in backend/app/tests/integration/test_auction_item_crud.py
- [ ] T084 [P] [US3] Integration test public access filtering in backend/app/tests/integration/test_auction_item_crud.py

### Frontend for User Story 3

- [ ] T085 [US3] Add status badge display (draft/published/sold/withdrawn) to item list
- [ ] T086 [US3] Add "Publish" button to draft items in AuctionItemForm
- [ ] T087 [US3] Add "Withdraw" button to published items with confirmation modal
- [ ] T088 [US3] Add edit warning modal when editing published items
- [ ] T089 [US3] Add validation error display for publish action (required fields)
- [ ] T090 [US3] Add success/error toast notifications for status changes

**Checkpoint**: All user stories (CRUD, Media, Status) are complete and independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple features

- [ ] T091 [P] Add search functionality (title, bid number) to item list
- [ ] T092 [P] Add sort options (bid number, title, created date, status)
- [ ] T093 [P] Add bulk actions (publish, withdraw, export CSV - UI only, backend Phase 2)
- [ ] T094 [P] Add display priority field for featured items
- [ ] T095 [P] Add item webpage URL field with validation
- [ ] T096 Add Redis caching for item list queries
- [ ] T097 [P] Add Prometheus metrics for media uploads
- [ ] T098 [P] Add error tracking for blob storage failures
- [ ] T099 Optimize database queries with eager loading for sponsor relationship
- [ ] T100 Add database indexes validation (verify all indexes created)
- [ ] T101 [P] E2E test: Create item → upload media → publish → view as donor in backend/app/tests/e2e/test_auction_item_workflow.py
- [ ] T102 [P] E2E test: Edit published item → verify changes reflected in backend/app/tests/e2e/test_auction_item_workflow.py
- [ ] T103 [P] E2E test: Withdraw item → verify removed from public view in backend/app/tests/e2e/test_auction_item_workflow.py
- [ ] T104 [P] Frontend E2E test with Playwright in frontend/augeo-admin/tests/e2e/auction-items.spec.ts
- [ ] T105 Update API documentation with auction item endpoints
- [ ] T106 Update README with auction items feature documentation
- [ ] T107 Run full test suite and verify 80%+ coverage target

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User Story 1 (Core CRUD): Can start after Foundational
  - User Story 2 (Media): Can start after Foundational (independent of US1)
  - User Story 3 (Status): Can start after Foundational (independent of US1/US2)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (Core CRUD)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (Media Management)**: Can start after Foundational (Phase 2) - Independent of US1 (but typically integrated with item form)
- **User Story 3 (Status Workflow)**: Can start after Foundational (Phase 2) - Independent of US1/US2

### Within Each User Story

**Backend**:

- Service layer before API endpoints
- API endpoints before tests
- Unit tests can run in parallel with integration tests

**Frontend**:

- Components before pages
- API service before components
- All components for a story can be developed in parallel

### Parallel Opportunities

**Phase 1 (Setup)**: T001 (migration) → T002 (run migration) are sequential. T003 (Event model update) can run in parallel with T001-T002.

**Phase 2 (Foundational)**: T004 (enums) must complete first. T005-T006 (models) can run in parallel after T004. T007-T012 (schemas) can all run in parallel after models.

**User Story 1**: Backend tasks T013-T018 (service methods) can run in parallel. API endpoint tasks T019-T023 can all run in parallel after service layer. Test tasks T027-T034 can all run in parallel. Frontend tasks T035-T036 (components) can run in parallel. Frontend tasks T037-T039 (pages) can run in parallel after components.

**User Story 2**: Service methods T044-T049 can run in parallel. API endpoints T050-T052 can run in parallel. Test tasks T057-T063 can all run in parallel. Frontend components T064-T065 can run in parallel.

**User Story 3**: Service methods T072-T074 can run in parallel. API endpoints T075-T076 can run in parallel. Test tasks T080-T084 can all run in parallel. Frontend tasks T085-T090 can run in parallel.

**Phase 6 (Polish)**: Most tasks T091-T104 can run in parallel (different files). T105-T107 (documentation, coverage) are final steps.

---

## Parallel Example: User Story 1

```bash
# Backend service layer (all in parallel):
Task T013: "Implement bid number assignment logic"
Task T014: "Implement create_auction_item method"
Task T015: "Implement get_auction_item_by_id method"
Task T016: "Implement list_auction_items with pagination/filters"
Task T017: "Implement update_auction_item method"
Task T018: "Implement delete_auction_item with soft/hard delete logic"

# API endpoints (all in parallel after service layer):
Task T019: "Create POST endpoint"
Task T020: "Create GET list endpoint"
Task T021: "Create GET detail endpoint"
Task T022: "Create PATCH endpoint"
Task T023: "Create DELETE endpoint"

# Tests (all in parallel):
Task T027: "Unit test bid number assignment"
Task T028: "Unit test buy-now price validation"
Task T029: "Unit test soft vs hard delete logic"
Task T030: "Integration test create workflow"
Task T031: "Integration test list with pagination"
Task T032: "Integration test update"
Task T033: "Integration test concurrent bid numbers"
Task T034: "Integration test sponsor attribution"

# Frontend components (in parallel):
Task T035: "Create AuctionItemList component"
Task T036: "Create AuctionItemForm component"

# Frontend pages (in parallel after components):
Task T037: "Create list page"
Task T038: "Create create page"
Task T039: "Create edit page"
```

---

## Implementation Strategy

### MVP First (All Three User Stories)

The MVP requires all three user stories to be functional:

1. **Phase 1**: Setup (T001-T003) - 30 minutes
2. **Phase 2**: Foundational (T004-T012) - 1 hour
3. **Phase 3**: User Story 1 (T013-T043) - 1.5 days
4. **Phase 4**: User Story 2 (T044-T071) - 1.5 days
5. **Phase 5**: User Story 3 (T072-T090) - 1 day
6. **STOP and VALIDATE**: Test all features end-to-end
7. **Phase 6**: Polish (T091-T107) - 1 day

**Total MVP Time**: 5-6 days

### Incremental Delivery

1. **Setup + Foundational** → Foundation ready (2 hours)
2. **User Story 1** → CRUD operations working (1.5 days)
3. **User Story 2** → Media uploads working (1.5 days)
4. **User Story 3** → Publishing workflow working (1 day)
5. **Polish** → Production-ready (1 day)

### Parallel Team Strategy

With multiple developers (3 recommended):

1. **Together**: Complete Setup (Phase 1) + Foundational (Phase 2) - 2 hours
2. **Split by user story**:
   - **Developer A**: User Story 1 (Core CRUD) - T013-T043
   - **Developer B**: User Story 2 (Media) - T044-T071
   - **Developer C**: User Story 3 (Status) - T072-T090
3. **Integrate**: Bring all three stories together
4. **Together**: Polish phase (Phase 6) - T091-T107

Each developer can complete their story in 1.5-2 days, then all integrate for final polish.

---

## Task Summary

**Total Tasks**: 107

**Breakdown by Phase**: Phase 1 (Setup): 3 tasks, Phase 2 (Foundational): 9 tasks, Phase 3 (User Story 1 - CRUD): 31 tasks (13 backend, 8 tests, 9 frontend, 1 integration), Phase 4 (User Story 2 - Media): 28 tasks (13 backend, 7 tests, 8 frontend), Phase 5 (User Story 3 - Status): 19 tasks (8 backend, 5 tests, 6 frontend), Phase 6 (Polish): 17 tasks (cross-cutting)

**Breakdown by Type**: Backend Implementation (44 tasks), Frontend Implementation (25 tasks), Tests (23 tasks), Infrastructure/Setup (15 tasks)

**Parallelizable Tasks**: 68 tasks marked [P]

**Estimated Timeline**: Solo Developer (5-6 days), 2 Developers (3-4 days), 3 Developers (2-3 days, optimal)

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [US1], [US2], [US3] labels map tasks to specific capabilities
- All three user stories are part of MVP (auction items not useful without all three)
- Bid number assignment (T013) is critical - must handle concurrency correctly
- Media uploads (T044-T056) leverage existing MediaService patterns
- Status workflow (T072-T079) follows Event status pattern
- Tests target 80%+ coverage per constitution requirements
- Azure Blob Storage integration follows existing sponsor logo patterns
- Commit after each task or logical group
- Stop at any checkpoint to validate functionality
- Frontend uses existing Zustand patterns from sponsors/events features
