# Research: Run-of-Show Management (043)

**Date**: 2026-05-03 | **Branch**: `043-run-of-show`

## Unknowns Resolved

### R-001: How does the existing checklist pattern work?

**Question**: What exact ORM/service/API pattern should RoS follow?

**Resolution**: The checklist feature (`backend/app/models/checklist.py`, `services/checklist_service.py`, `api/v1/admin_checklist.py`) is the canonical pattern:
- Models use `UUIDMixin`, `TimestampMixin`, mapped_column with explicit `comment=`, `CheckConstraint` for non-empty strings
- Service is a class with `@staticmethod` methods; no `Repository` abstraction
- API uses a local `_require_event_access()` helper that checks `PermissionService.can_view_event()`
- Reorder endpoint accepts `{"items": [{"id": "...", "display_order": N}]}`
- Template application: loads template items → creates event items with computed dates/times → saves in one transaction

**Action**: Mirror this pattern exactly.

---

### R-002: How are Celery tasks scheduled with a future ETA?

**Question**: What is the correct way to schedule a one-time future notification via Celery in this codebase?

**Resolution**: Existing pattern in `backend/app/services/notification_scheduler.py`:
```python
result = send_auction_closing_soon_task.apply_async(
    args=[event_id, minutes_before],
    eta=eta,  # datetime object, timezone-aware UTC
)
task_ids.append(result.id)
```
Revocation: `celery_app.control.revoke(task_id, terminate=False)`

The `celery_app.py` has task routing: `"app.tasks.notification_tasks.*": {"queue": "notifications"}`. New RoS notification tasks should be added to the same queue.

**Action**: 
- Create `backend/app/tasks/run_of_show_tasks.py` with `send_ros_notification_task`
- Task receives `notification_id: str` (UUID string) — fetches message_body + recipients from DB at delivery time
- Store `celery_task_id` returned from `apply_async` in `ScheduledRunOfShowNotification.celery_task_id`
- On cancel: `celery_app.control.revoke(notification.celery_task_id)` then set `delivery_status = "cancelled"`

---

### R-003: What is the existing notification delivery mechanism?

**Question**: How does feature-035's `notification_service.py` deliver notifications, and how does RoS hook into it?

**Resolution**: `NotificationService` creates `Notification` rows and pushes via Socket.IO (`sio.emit`). For RoS:
- The Celery task calls `NotificationService.send_to_checked_in_donors(event_id, message)` or an equivalent method
- Recipient types map to:
  - `checked_in_donors` → donors checked in at delivery time
  - `auctioneer` → user with auctioneer role on the event
  - `all_checked_in` → all checked-in attendees
- The Celery task must use `AsyncSessionLocal` (same pattern as `_send_auction_opened_async` in `notification_tasks.py`)

**Action**: RoS Celery task uses `_run_async()` helper pattern from existing `notification_tasks.py` to call async notification service from sync Celery task.

---

### R-004: What happens to scheduled Celery tasks when an event is cancelled/archived?

**Question**: When `event.status` transitions to `cancelled` or `archived`, how are pending RoS notifications cancelled?

**Resolution**: No existing generic hook. Checklist doesn't need this. The cleanest approach:
- Add a `cancel_all_pending_ros_notifications(event_id)` method to `RunOfShowNotificationService`
- Call it from the event update/cancel endpoint (in `admin_events.py`) when status changes to `cancelled` or `archived`
- This revokes all Celery tasks + sets `delivery_status = "cancelled"` for matching `ScheduledRunOfShowNotification` rows

**Action**: Implement this in `run_of_show_notification_service.py` and hook into the event status-change path.

---

### R-005: Where does the auctioneer countdown live in the header?

**Question**: The auctioneer interface has a top-nav bar — where exactly does the countdown widget go?

**Resolution**: The Admin PWA uses `AuthenticatedLayout` → `TopNavBar`. The auctioneer dashboard is at `/events/$eventId/auctioneer`. The header at this route should include the `RosCountdownBadge`. Best approach: render the badge inside `AuctioneerDashboardPage.tsx` in a sticky top bar, or add it to the route's layout. Given current architecture (no per-route header), the countdown should be rendered as a sticky element at the top of `AuctioneerDashboardPage` content area — simpler than modifying the global `TopNavBar`.

**Action**: Add `RosCountdownBadge` as a sticky `<div>` at the top of `AuctioneerDashboardPage.tsx`. Clicking it scrolls to the `RunOfShowCard` section using `useRef`/`scrollIntoView`.

---

### R-006: Donor PWA — where is the event home page?

**Question**: Where in the donor PWA does the timeline card go?

**Resolution**: `frontend/donor-pwa/src/features/events/EventHomePage.tsx` has a tabbed layout with a "Home" tab. The home tab renders cards including `SponsorsCarousel`, `MySeatingSection`, etc. The `RunOfShowTimelineCard` should be added to the Home tab content, visible only when `donor_visible_items.length > 0` (FR-011).

**Action**: Add `RunOfShowTimelineCard` to the Home tab in `EventHomePage.tsx`. Fetch from `/api/v1/events/{event_id}/run-of-show` (new public endpoint). Collapse state managed with local `useState`.

---

### R-007: How does template reorder work — same as checklist?

**Question**: Are template items reordered via the same `/reorder` endpoint pattern?

**Resolution**: Checklist uses `POST /admin/events/{event_id}/checklist/reorder` with `{"items": [{"id": "...", "display_order": N}]}`. RoS template items can use the same pattern: `POST /admin/npos/{npo_id}/run-of-show-templates/{template_id}/reorder`.

**Action**: Use same reorder request/response pattern.

---

### R-008: System default template — seed or migration?

**Question**: Should the "3-Hour Gala" default be seeded in an Alembic migration or a separate seed script?

**Resolution**: The checklist system default uses `is_system_default=True, npo_id=NULL`. Existing pattern: seed inside the Alembic migration file itself (no separate seed script exists for checklist either — it was added in the migration). This keeps schema + data changes atomic.

**Action**: Seed the 14-item default template in the `ros_001_add_run_of_show_tables.py` migration's `upgrade()` function using `op.execute()` with INSERT SQL. The template has `npo_id=NULL, is_system_default=True, name="3-Hour Gala"`.

---

### R-009: Polling frequency for countdowns — 30s acceptable?

**Question**: SC-004 says "at least once per minute" for auctioneer countdown. Is 30s polling OK?

**Resolution**: Constitution says no WebSocket for countdowns (YAGNI). SC-006 says 30s for state changes. The countdown itself can tick in JS (`setInterval(1000)`) locally — it only needs to refresh the *item list* (to detect new "next item") at 30s. The visual second-by-second tick is pure JS arithmetic on the last-fetched `scheduled_time`.

**Action**: Frontend countdown components use `useEffect` with `setInterval(1000)` for visual tick + `useQuery` with `refetchInterval: 30000` for data freshness. This satisfies SC-004 and SC-006 simultaneously.

---

### R-010: Notification retry policy — standard Celery?

**Question**: FR-020 says "at least 2 retries within a 2-minute window". Is this standard Celery retry config?

**Resolution**: Yes. Celery task decorator supports `max_retries=2, default_retry_delay=60` (retry every 60s, max 2 retries = 2-minute window). On final failure, set `delivery_status = "failed"` in DB.

**Action**: `send_ros_notification_task` uses `@celery_app.task(max_retries=2, default_retry_delay=60)` and catches exceptions with `self.retry(exc=exc)`.

---

### R-011: Display order on template items — 0-indexed or 1-indexed?

**Question**: Should `display_order` start at 0 or 1?

**Resolution**: Checklist uses `server_default="0"` (0-indexed). Follow same convention.

**Action**: RoS items and template items: `display_order` starts at 0, increments by 1.

---

### R-012: What does "next item" mean exactly when all future items are complete?

**Question**: Edge case — all items either in the past or completed.

**Resolution**: Per spec Assumption 5: "Next item = earliest uncompleted item whose scheduled_time is in the future". If none exist → countdown shows "Program Complete" (US4 AC5). Query: `WHERE is_complete=False AND scheduled_time > NOW()` ordered by `scheduled_time ASC LIMIT 1`.

**Action**: Backend `GET /next-item` (or included in the main list response as `next_item` field). Frontend checks `next_item == null` → show "Program Complete" state.
