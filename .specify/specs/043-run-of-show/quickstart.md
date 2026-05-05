# Quickstart: Run-of-Show Management (043)

**Branch**: `043-run-of-show`

## Prerequisites

- Docker running (`make docker-up`)
- Python 3.11+ with Poetry (`cd backend && poetry install`)
- Node.js 22+ with pnpm (`cd frontend/fundrbolt-admin && pnpm install`)

## Backend Setup

```bash
# 1. Start infrastructure
make docker-up

# 2. Run the migration (creates 4 new tables + seeds 3-Hour Gala template)
make migrate
# or: cd backend && poetry run alembic upgrade head

# 3. Verify tables exist
cd backend && poetry run python -c "
from app.models.run_of_show import RunOfShowTemplate, RunOfShowItem
print('Models imported OK')
"

# 4. Start backend dev server
make dev-backend
# API: http://localhost:8000
# Docs: http://localhost:8000/docs  (look for run-of-show tag)
```

## Frontend Setup

```bash
# Admin PWA
cd frontend/fundrbolt-admin && pnpm install && pnpm dev
# http://localhost:5173
# Navigate: Events → [select event] → Run of Show

# Donor PWA
cd frontend/donor-pwa && pnpm install && pnpm dev
# http://localhost:5174
# Navigate: Event Home Page → Run of Show timeline card (collapsed, visible if items exist)
```

## Running Tests

```bash
# All backend tests
make test-backend

# Only run-of-show tests
cd backend && poetry run pytest app/tests/contract/test_run_of_show_api.py app/tests/integration/test_run_of_show_service.py -v

# Frontend lint + build
cd frontend/fundrbolt-admin && pnpm lint && pnpm build
cd frontend/donor-pwa && pnpm lint && pnpm build
```

## Key Development Flows

### Flow 1: Add a Run-of-Show Item (Admin)

1. `POST /api/v1/admin/events/{event_id}/run-of-show`
   ```json
   {
     "title": "Live Auction Begins",
     "scheduled_time": "2026-05-03T19:00:00Z",
     "donor_visible": true,
     "auctioneer_visible": true,
     "description": null
   }
   ```
2. Returns `RunOfShowItemResponse` with `id`, `has_notification: false`

### Flow 2: Apply the Default Template

1. Check event has `start_time` set
2. `POST /api/v1/admin/events/{event_id}/run-of-show/apply-template`
   ```json
   { "template_id": "<system-default-uuid>", "confirm_replace": true }
   ```
3. Returns `{"items": [...14 items...], "replaced_count": 0}`

To get the system default template ID:
```bash
curl http://localhost:8000/api/v1/admin/npos/{npo_id}/run-of-show-templates
# Look for "is_system_default": true
```

### Flow 3: Attach a Notification to an Item

```bash
POST /api/v1/admin/events/{event_id}/run-of-show/notification/{item_id}
{
  "message_body": "The live auction is now open! Start bidding!",
  "recipient_type": "checked_in_donors"
}
```

This schedules a Celery task with `eta = item.scheduled_time`. To cancel:
```bash
DELETE /api/v1/admin/events/{event_id}/run-of-show/notification/{item_id}
```

### Flow 4: Mark an Item Complete

```bash
POST /api/v1/admin/events/{event_id}/run-of-show/complete/{item_id}
# Returns updated RunOfShowItemResponse with is_complete: true, completed_at: "..."
```

## Celery Worker

Notification tasks require the Celery worker to be running:
```bash
cd backend && poetry run celery -A app.celery_app worker -Q notifications -l info
```

In development, `celery_task_always_eager=True` (from `get_settings()`) runs tasks synchronously, so you don't need a running worker for tests.

## Database Check

```sql
-- Verify system default template was seeded
SELECT id, name, is_system_default, npo_id FROM run_of_show_templates
WHERE is_system_default = true;

-- Verify 14 template items
SELECT title, offset_minutes, donor_visible_default, auctioneer_visible_default
FROM run_of_show_template_items
JOIN run_of_show_templates ON template_id = run_of_show_templates.id
WHERE is_system_default = true
ORDER BY display_order;
```

## Environment Variables

No new environment variables required. Feature uses existing:
- `DATABASE_URL` — PostgreSQL connection
- `CELERY_BROKER_URL` — Redis for task scheduling
- `CELERY_RESULT_BACKEND` — Redis for task results

## Common Issues

| Problem | Solution |
|---------|----------|
| Template application fails | Check `event.start_time` is not NULL — required for offset calculation |
| Notification not sent | Check Celery worker is running in `notifications` queue; check `delivery_status` in DB |
| Item shows for donor unexpectedly | Verify `donor_visible=true` on the item; FR-003 says default is `false` |
| Countdown shows "Program Complete" prematurely | All items are either `is_complete=true` OR `scheduled_time <= now()` — mark items as uncomplete or add future items |

## UAT Performance Targets (SC-001 / SC-002)

These are manual acceptance criteria — verify during UAT, not automated tests:

- **SC-001**: A coordinator should be able to build a complete run-of-show from scratch with 10+ items in **under 5 minutes**. Time yourself adding 10 items with realistic titles, times, and visibility settings.
- **SC-002**: Applying a saved template to a new event and editing 2–3 items should take **under 2 minutes**. Time from clicking "Apply Template" to finishing edits on 2–3 items.
