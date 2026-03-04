# Quickstart: Duplicate Event (031)

**Feature**: 031-duplicate-event
**Estimated Complexity**: Medium (M)

## Prerequisites

- Python 3.11+ with Poetry installed
- Node.js 22+ with pnpm
- Docker (for PostgreSQL and Redis)
- Azure Storage Emulator or Azurite (for blob copy testing)

## Setup

```bash
# Start infrastructure
make docker-up

# Install dependencies
make install-backend
make install-frontend

# Run migrations (no new migrations for this feature)
make migrate

# Start dev servers
make dev-backend    # http://localhost:8000
make dev-frontend   # http://localhost:5173
```

## Implementation Order

### Phase 1: Backend Service Layer

1. **Add `copy_blob()` to `MediaService`** (`backend/app/services/media_service.py`)
   - New static async method: `copy_blob(source_blob_name, target_blob_name) -> str`
   - Uses Azure `start_copy_from_url()` for server-side copy
   - Returns new blob URL

2. **Add `duplicate_event()` to `EventService`** (`backend/app/services/event_service.py`)
   - Load source event with all relationships (eager load)
   - Create new Event with field mapping from data-model.md
   - Clone child entities: FoodOption, TicketPackage+CustomTicketOption, EventTable, Sponsor
   - Conditionally clone: EventMedia (with blob copy), EventLink, DonationLabel
   - Single transaction, rollback on failure

### Phase 2: Backend API Endpoint

3. **Add `POST /{event_id}/duplicate` endpoint** (`backend/app/api/v1/events.py`)
   - Request body: `DuplicateEventRequest(include_media, include_links, include_donation_labels)`
   - Auth: `get_current_active_user` + NPO permission check
   - Response: 201 with `EventDetailResponse`
   - Follow existing endpoint patterns (see `publish_event`, `close_event`)

4. **Add Pydantic schemas** (`backend/app/schemas/event.py`)
   - `DuplicateEventRequest` schema with three boolean fields (all default `false`)

### Phase 3: Frontend

5. **Add `duplicateEvent()` to event service** (`frontend/fundrbolt-admin/src/services/event-service.ts`)
   - `POST /events/{eventId}/duplicate` with request body
   - Returns `EventDetail`

6. **Add `duplicateEvent` action to Zustand store** (`frontend/fundrbolt-admin/src/stores/event-store.ts`)
   - Calls service method, adds new event to store, navigates to edit page

7. **Add `DuplicateEventDialog` component** (`frontend/fundrbolt-admin/src/features/events/components/DuplicateEventDialog.tsx`)
   - AlertDialog with three checkboxes (media, links, donation labels)
   - Confirm/Cancel buttons
   - Loading state during duplication

8. **Add Duplicate button to `EventListPage`** (`frontend/fundrbolt-admin/src/features/events/EventListPage.tsx`)
   - Copy icon button in EventCard action row
   - Opens DuplicateEventDialog on click

### Phase 4: Testing

9. **Backend tests** (`backend/app/tests/test_event_duplicate.py`)
   - Test field mapping for all cloned entities
   - Test optional inclusions (media, links, labels)
   - Test permission enforcement
   - Test 404 for non-existent event
   - Test sold_count reset, status=DRAFT, event_datetime=NULL

10. **Frontend tests** (if vitest configured)
    - Dialog render and checkbox state
    - API call with correct payload

## Key Files to Modify

| File | Change |
|---|---|
| `backend/app/services/media_service.py` | Add `copy_blob()` method |
| `backend/app/services/event_service.py` | Add `duplicate_event()` method |
| `backend/app/api/v1/events.py` | Add `POST /{event_id}/duplicate` endpoint |
| `backend/app/schemas/event.py` | Add `DuplicateEventRequest` schema |
| `frontend/.../services/event-service.ts` | Add `duplicateEvent()` method |
| `frontend/.../stores/event-store.ts` | Add `duplicateEvent` store action |
| `frontend/.../features/events/EventListPage.tsx` | Add Duplicate button to EventCard |

## New Files to Create

| File | Purpose |
|---|---|
| `frontend/.../features/events/components/DuplicateEventDialog.tsx` | Duplication dialog with options |
| `backend/app/tests/test_event_duplicate.py` | Backend test suite |

## Verification

```bash
# Run backend tests
cd backend && poetry run pytest app/tests/test_event_duplicate.py -v

# Run all backend CI checks
cd backend && poetry run ruff check .
cd backend && poetry run ruff format --check .
cd backend && poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests'
cd backend && poetry run pytest -v --tb=short

# Run frontend CI checks
cd frontend/fundrbolt-admin && pnpm lint
cd frontend/fundrbolt-admin && pnpm format:check
cd frontend/fundrbolt-admin && pnpm build
```

## API Testing (Manual)

```bash
# Duplicate event (default — includes links + donation labels, excludes media)
curl -X POST http://localhost:8000/api/v1/events/{event_id}/duplicate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Duplicate with all options explicitly enabled (media, links, donation labels)
curl -X POST http://localhost:8000/api/v1/events/{event_id}/duplicate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"include_media": true, "include_links": true, "include_donation_labels": true}'
```
