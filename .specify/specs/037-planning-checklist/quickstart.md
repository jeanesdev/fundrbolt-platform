# Quickstart: Event Planning Checklist

**Feature**: 037-planning-checklist
**Date**: 2026-04-03

## Prerequisites

- Python 3.11+ with Poetry installed
- Node.js 22+ with pnpm
- PostgreSQL running (via docker-compose)
- Redis running (via docker-compose)
- Backend and frontend dependencies installed

## Setup Steps

### 1. Start Infrastructure

```bash
make docker-up
```

### 2. Run Database Migration

```bash
cd backend && poetry run alembic upgrade head
```

This creates 3 new tables:
- `checklist_templates` — Reusable checklist templates (NPO-scoped + 1 system default)
- `checklist_template_items` — Task definitions within templates
- `checklist_items` — Concrete checklist items per event

To seed the system default template (26 items for the fundraising gala lifecycle), run:

```bash
cd backend && poetry run python seed_checklist_template.py
```

### 3. Start Backend

```bash
make dev-backend
```

### 4. Start Admin Frontend

```bash
make dev-frontend
```

### 5. Verify

1. Log in as an NPO Admin or Staff user
2. Create a new event — the checklist should be auto-populated with 26 default items
3. Navigate to the event edit page — the checklist panel should appear above the tab sections
4. Click on an item's status to toggle: Not Complete → In Progress → Complete
5. Add a new item, edit an existing item, delete an item
6. Click "Save as Template" to save the checklist as a reusable org template

## API Quick Test

```bash
# List checklist items for an event
curl -s http://localhost:8000/api/v1/admin/events/{event_id}/checklist \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Add a new item
curl -s -X POST http://localhost:8000/api/v1/admin/events/{event_id}/checklist \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test task", "due_date": "2026-06-01"}' | python3 -m json.tool

# Toggle item status
curl -s -X PATCH http://localhost:8000/api/v1/admin/events/{event_id}/checklist/{item_id}/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}' | python3 -m json.tool

# List templates for an NPO
curl -s http://localhost:8000/api/v1/admin/npos/{npo_id}/checklist-templates \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

## Key Files

| Layer | File | Purpose |
|-------|------|---------|
| Model | `backend/app/models/checklist.py` | SQLAlchemy models for 3 tables |
| Schema | `backend/app/schemas/checklist.py` | Pydantic request/response schemas |
| Service | `backend/app/services/checklist_service.py` | Business logic (CRUD, templates, reorder) |
| API | `backend/app/api/v1/admin_checklist.py` | FastAPI router (~14 endpoints) |
| Migration | `backend/alembic/versions/xxxx_add_checklist_tables.py` | DB migration |
| Types | `frontend/fundrbolt-admin/src/types/checklist.ts` | TypeScript interfaces |
| Service | `frontend/fundrbolt-admin/src/services/checklistService.ts` | API client |
| Store | `frontend/fundrbolt-admin/src/stores/checklistStore.ts` | Zustand state |
| UI | `frontend/fundrbolt-admin/src/features/events/components/ChecklistPanel.tsx` | Main panel component |
| Tests | `backend/app/tests/unit/test_checklist_service.py` | Service unit tests |
| Tests | `backend/app/tests/contract/test_checklist_api.py` | API contract tests |

## Running Tests

```bash
# Backend tests
cd backend && poetry run pytest app/tests/unit/test_checklist_service.py app/tests/contract/test_checklist_api.py -v

# Frontend lint + build
cd frontend/fundrbolt-admin && pnpm lint && pnpm build
```
