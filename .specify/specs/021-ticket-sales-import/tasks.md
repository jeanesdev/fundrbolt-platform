---
description: "Task list for ticket sales import implementation"
---

# Tasks: Ticket Sales Import

**Input**: Design documents from `/specs/021-ticket-sales-import/`
**Prerequisites**: plan.md (required), spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: Not requested in the feature specification.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create feature module scaffolding for backend and frontend.

- [ ] T001 Create backend module skeletons in backend/app/api/v1/admin_ticket_sales_import.py, backend/app/services/ticket_sales_import_service.py, backend/app/schemas/ticket_sales_import.py
- [ ] T002 [P] Create frontend module skeletons in frontend/fundrbolt-admin/src/features/events/tickets/components/TicketSalesImportDialog.tsx and frontend/fundrbolt-admin/src/features/events/tickets/services/ticketSalesImport.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data model and routing prerequisites for all stories.

- [ ] T003 Add migration for ticket purchase import fields and import tables in backend/alembic/versions/xxxx_create_ticket_sales_import_tables.py
- [ ] T004 Update TicketPurchase fields and constraints for import data in backend/app/models/ticket_management.py
- [ ] T005 [P] Add import batch and issue models in backend/app/models/ticket_sales_import.py and export in backend/app/models/__init__.py
- [ ] T006 [P] Define preflight/import response schemas in backend/app/schemas/ticket_sales_import.py
- [ ] T007 Register ticket sales import router in backend/app/api/v1/__init__.py

**Checkpoint**: Foundational data model and routing ready.

---

## Phase 3: User Story 1 - Bulk import with preflight (Priority: P1) 🎯 MVP

**Goal**: CSV-based preflight and import flow with required validations and confirmation.

**Independent Test**: Upload a valid CSV, pass preflight, confirm import, and see created/skipped counts.

### Implementation

- [ ] T008 [US1] Implement CSV preflight validation (required fields, ticket type exists, row limit) in backend/app/services/ticket_sales_import_service.py
- [ ] T009 [US1] Implement preflight/import endpoints in backend/app/api/v1/admin_ticket_sales_import.py
- [ ] T010 [P] [US1] Add API client functions for preflight/import in frontend/fundrbolt-admin/src/features/events/tickets/services/ticketSalesImport.ts
- [ ] T011 [US1] Add import button and dialog wiring in frontend/fundrbolt-admin/src/features/events/tickets/TicketPackagesIndexPage.tsx and frontend/fundrbolt-admin/src/features/events/tickets/components/TicketSalesImportDialog.tsx
- [ ] T012 [P] [US1] Add frontend types for preflight/import responses in frontend/fundrbolt-admin/src/types/ticket-management.ts

**Checkpoint**: User Story 1 complete and independently usable for CSV imports.

---

## Phase 4: User Story 2 - Use supported file formats (Priority: P2)

**Goal**: Add JSON and Excel support and display example formats.

**Independent Test**: Preflight accepts valid JSON and Excel files and shows example formats in the UI.

### Implementation

- [ ] T013 [US2] Extend parsing to JSON and Excel in backend/app/services/ticket_sales_import_service.py
- [ ] T014 [US2] Display JSON/CSV examples and accepted formats in frontend/fundrbolt-admin/src/features/events/tickets/components/TicketSalesImportDialog.tsx

**Checkpoint**: User Story 2 complete with multi-format support.

---

## Phase 5: User Story 3 - Fix and re-run after errors (Priority: P3)

**Goal**: Provide actionable error feedback, warnings, and downloadable error report.

**Independent Test**: Preflight an invalid file, see row-level errors and warnings, download the error report, and confirm no import occurs.

### Implementation

- [ ] T015 [US3] Add existing `external_sale_id` warning/skip logic in backend/app/services/ticket_sales_import_service.py
- [ ] T016 [US3] Generate error report output and include `error_report_url` in backend/app/schemas/ticket_sales_import.py
- [ ] T017 [US3] Update contract to include `error_report_url` in .specify/specs/021-ticket-sales-import/contracts/ticket-sales-import.yaml
- [ ] T018 [US3] Render row-level issues, warnings, and error report download in frontend/fundrbolt-admin/src/features/events/tickets/components/TicketSalesImportDialog.tsx

**Checkpoint**: User Story 3 complete with actionable feedback and retry flow.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T019 [P] Validate UI copy and alignment with quickstart steps in frontend/fundrbolt-admin/src/features/events/tickets/components/TicketSalesImportDialog.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) → Foundational (Phase 2) → User Stories (Phases 3–5) → Polish (Phase 6)

### User Story Dependencies

- US1 can start after Foundational.
- US2 can start after Foundational (independent of US1 once shared service exists).
- US3 can start after Foundational; benefits from US1 UI/service structures.

### Parallel Opportunities

- Phase 1: T001 and T002 can run in parallel.
- Phase 2: T005 and T006 can run in parallel after T003 starts.
- US1: T010 and T012 can run in parallel while backend endpoints are being built.
- US2: T013 and T014 can run in parallel.
- US3: T015–T018 can be split between backend and frontend in parallel.

---

## Parallel Example: User Story 1

- T010 [P] [US1] Add API client functions in frontend/fundrbolt-admin/src/features/events/tickets/services/ticketSalesImport.ts
- T012 [P] [US1] Add frontend types in frontend/fundrbolt-admin/src/types/ticket-management.ts

---

## Parallel Example: User Story 2

- T013 [US2] Extend parsing to JSON and Excel in backend/app/services/ticket_sales_import_service.py
- T014 [US2] Display example formats in frontend/fundrbolt-admin/src/features/events/tickets/components/TicketSalesImportDialog.tsx

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup + Foundational
2. Implement US1 tasks (CSV preflight/import + UI)
3. Validate CSV import end-to-end and stop

### Incremental Delivery

1. US1 (CSV import)
2. US2 (JSON/Excel + examples)
3. US3 (error report + warnings + retry UX)

---

## Task Count Summary

- Setup: 2 tasks
- Foundational: 5 tasks
- User Story 1: 5 tasks
- User Story 2: 2 tasks
- User Story 3: 4 tasks
- Polish: 1 task

Total: 19 tasks
