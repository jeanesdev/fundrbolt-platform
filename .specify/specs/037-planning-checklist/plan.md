# Implementation Plan: Event Planning Checklist

**Branch**: `037-planning-checklist` | **Date**: 2026-04-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/037-planning-checklist/spec.md`

## Summary

Add a planning checklist system to the Admin PWA that lets event coordinators track campaign tasks with due dates and statuses (Not Complete / In Progress / Complete). The checklist is rendered as a persistent panel above tab navigation on the event edit page. Checklist templates are saved at the NPO (organization) level and auto-applied when creating new events. A built-in 26-item default template covers the full fundraising gala lifecycle from 12 weeks pre-event through 2 weeks post-event.

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript 5.x (Frontend)
**Primary Dependencies**: FastAPI 0.120+, SQLAlchemy 2.0+, Pydantic 2.0+, Alembic (Backend); React 18+, Vite, TanStack Router, Zustand, Radix UI, Tailwind CSS 4 (Frontend)
**Storage**: Azure Database for PostgreSQL (3 new tables: checklist_items, checklist_templates, checklist_template_items)
**Testing**: pytest (backend), pnpm test (frontend)
**Target Platform**: Web application (Admin PWA only)
**Project Type**: Web (existing monorepo: /backend, /frontend/fundrbolt-admin)
**Performance Goals**: <2 sec checklist load and status update (SC-001)
**Constraints**: Multi-tenant (npo_id isolation), RBAC (NPO Admin/Staff+), last-write-wins concurrency
**Scale/Scope**: ~26 items per checklist, ~10 templates per NPO max realistic usage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| YAGNI / Minimalist Development | ✅ PASS | No speculative features; v1 excludes assignees, descriptions, notifications |
| Multi-Tenancy (npo_id isolation) | ✅ PASS | Templates scoped to NPO; checklist items scoped to Event (which belongs to NPO) |
| RBAC Role Enforcement | ✅ PASS | FR-019: NPO Admin/Staff+ for all write operations |
| Type Safety (mypy strict, TS strict) | ✅ PASS | Follows existing patterns with full type annotations |
| Testing Requirements | ✅ PASS | Unit + integration tests planned for service & API layers |
| Audit Logging | ✅ PASS | Status change timestamps tracked via completed_at field; follows existing sponsorService logging pattern |
| Data Security / Privacy | ✅ PASS | No PII in checklist data; standard auth enforcement |
| Solo Developer Efficiency | ✅ PASS | Leverages existing CRUD patterns; no new infrastructure |
| Conventional Commits | ✅ PASS | Standard feat/test/docs prefixes |

## Project Structure

### Documentation (this feature)

```
specs/037-planning-checklist/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml     # API contract
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```
backend/
├── app/
│   ├── models/
│   │   └── checklist.py           # ChecklistItem, ChecklistTemplate, ChecklistTemplateItem models
│   ├── schemas/
│   │   └── checklist.py           # Pydantic request/response schemas
│   ├── services/
│   │   └── checklist_service.py   # Business logic for items + templates
│   └── api/v1/
│       └── admin_checklist.py     # Admin API router for checklist & templates
├── alembic/versions/
│   └── xxxx_add_checklist_tables.py  # Migration for 3 new tables
└── app/tests/
    ├── test_checklist_service.py  # Service unit tests
    └── test_admin_checklist.py    # API integration tests

frontend/fundrbolt-admin/
├── src/
│   ├── types/
│   │   └── checklist.ts           # TypeScript interfaces
│   ├── services/
│   │   └── checklistService.ts    # API client
│   ├── stores/
│   │   └── checklistStore.ts      # Zustand state management
│   └── features/events/
│       ├── components/
│       │   ├── ChecklistPanel.tsx          # Persistent panel (above tabs)
│       │   ├── ChecklistItem.tsx           # Single item row with status toggle
│       │   ├── ChecklistItemForm.tsx       # Add/edit item form
│       │   ├── ChecklistProgressBar.tsx    # Progress summary bar
│       │   ├── SaveTemplateDialog.tsx      # Save as template dialog
│       │   └── ApplyTemplateDialog.tsx     # Apply template with Replace/Append
│       └── EventEditPage.tsx              # Modified to include ChecklistPanel
```

**Structure Decision**: Follows existing web application pattern with backend models/services/api and frontend services/stores/components. Single model file for all 3 checklist entities (like ticket_management.py groups related models). Single API router for all checklist endpoints under `/admin/events/{event_id}/checklist/...` and `/admin/npos/{npo_id}/checklist-templates/...`.

## Complexity Tracking

No constitution violations requiring justification.
