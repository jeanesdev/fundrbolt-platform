---
description: "Task list for Bulk Import Auction Items via Workbook + Images"
---

# Tasks: Bulk Import Auction Items via Workbook + Images

**Input**: Design documents from `/specs/018-auction-item-bulk/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: Not explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish shared types and documentation scaffolding

- [x] T001 Create import schema models in backend/app/schemas/auction_item_import.py
- [x] T002 [P] Add frontend import types in frontend/fundrbolt-admin/src/types/auctionItemImport.ts
- [x] T003 Update import contract fields in .specify/specs/018-auction-item-bulk/contracts/auction-item-import.yaml (add error report field if needed)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T004 Add external identifier field to backend/app/models/auction_item.py
- [x] T005 Create Alembic migration for auction_items external_id and unique constraint in backend/alembic/versions/*_auction_item_external_id.py
- [x] T006 Add import constants (row cap, category list, allowed image types) in backend/app/core/auction_item_import.py
- [x] T007 Implement ZIP safety utilities in backend/app/services/auction_item_import_zip.py
- [x] T008 [P] Add ZIP size/entry limits enforcement in backend/app/services/auction_item_import_zip.py
- [x] T009 [P] Add file signature validation for .xlsx and image types in backend/app/services/auction_item_import_zip.py
- [x] T010 Implement shared import service skeleton in backend/app/services/auction_item_import_service.py

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Preflight an auction item import (Priority: P1) 🎯 MVP

**Goal**: Admins can upload a ZIP package for a selected event and see validation results without any data changes.

**Independent Test**: Upload a valid ZIP and confirm only a preflight report is returned and no items change.

### Implementation for User Story 1

- [x] T011 [US1] Implement workbook parsing + row validation in backend/app/services/auction_item_import_service.py
- [x] T012 [US1] Implement error report export (CSV/JSON) in backend/app/services/auction_item_import_service.py and expose in backend/app/api/v1/admin_auction_item_import.py
- [x] T013 [US1] Add preflight API route in backend/app/api/v1/admin_auction_item_import.py
- [x] T014 [US1] Enforce environment-based import availability in backend/app/api/v1/admin_auction_item_import.py
- [x] T015 [US1] Register the import router in backend/app/api/v1/__init__.py
- [x] T016 [US1] Add preflight client method in frontend/fundrbolt-admin/src/services/auctionItemService.ts
- [x] T017 [US1] Build import modal + upload flow in frontend/fundrbolt-admin/src/features/events/sections/EventAuctionItemsSection.tsx
- [x] T018 [US1] Create report UI component in frontend/fundrbolt-admin/src/components/auction-items/AuctionItemImportReport.tsx

**Checkpoint**: Preflight validation works end-to-end and returns row-level errors without DB writes

---

## Phase 4: User Story 2 - Commit a validated import (Priority: P2)

**Goal**: Admins can commit a validated package to create/update items with a detailed report.

**Independent Test**: Commit a validated ZIP and confirm created/updated items match report results.

### Implementation for User Story 2

- [x] T019 [US2] Implement commit logic with upsert + image upload in backend/app/services/auction_item_import_service.py
- [x] T020 [US2] Add commit API route in backend/app/api/v1/admin_auction_item_import.py
- [x] T021 [US2] Add commit client method in frontend/fundrbolt-admin/src/services/auctionItemService.ts
- [x] T022 [US2] Wire commit action + refresh list in frontend/fundrbolt-admin/src/features/events/sections/EventAuctionItemsSection.tsx
- [x] T023 [US2] Add audit logging for import attempts in backend/app/services/audit_service.py

**Checkpoint**: Commit creates/updates items, uploads images, and returns a final report

---

## Phase 5: User Story 3 - Re-import to update items safely (Priority: P3)

**Goal**: Re-importing the same workbook updates items without creating duplicates.

**Independent Test**: Import the same package twice; item count remains stable and fields update.

### Implementation for User Story 3

- [x] T024 [US3] Add duplicate external_id detection per workbook in backend/app/services/auction_item_import_service.py
- [x] T025 [US3] Ensure import report differentiates created vs updated in backend/app/schemas/auction_item_import.py
- [x] T026 [US3] Render created vs updated statuses in frontend/fundrbolt-admin/src/components/auction-items/AuctionItemImportReport.tsx

**Checkpoint**: Re-imports update items in place with no duplication

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T027 [P] Add internal demo package generator in backend/scripts/generate_auction_item_import_pack.py
- [x] T028 [P] Add import helper text in frontend/fundrbolt-admin/src/features/events/sections/EventAuctionItemsSection.tsx
- [x] T029 [P] Update quickstart guidance in .specify/specs/018-auction-item-bulk/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: Depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2)
- **User Story 2 (P2)**: Can start after Foundational (Phase 2), relies on US1 validation/reporting
- **User Story 3 (P3)**: Can start after Foundational (Phase 2), builds on US2 upsert behavior

### Parallel Opportunities

- T002, T003, T006, T007, T008, T009 can run in parallel (different files)
- Frontend tasks T016–T018 can run in parallel after T001 is complete
- T019 and T020 can be parallelized once the import service skeleton exists
- T027–T029 can be parallelized during polish

---

## Parallel Example: User Story 1

```bash
Task: "Add preflight client method in frontend/fundrbolt-admin/src/services/auctionItemService.ts"
Task: "Create report UI component in frontend/fundrbolt-admin/src/components/auction-items/AuctionItemImportReport.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **Stop and validate**: Preflight works and no data changes occur

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Validate preflight
3. Add User Story 2 → Validate commit
4. Add User Story 3 → Validate re-import safety
5. Polish & cross-cutting updates
