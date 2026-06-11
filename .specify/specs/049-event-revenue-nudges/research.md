# Research Notes — 049 Event Revenue Nudges

## Codebase Investigation Summary

### 1. Existing Dashboard Components

**Event Dashboard:**
- Route: `frontend/fundrbolt-admin/src/routes/_authenticated/events/$eventId/dashboard.tsx`
- Component: `frontend/fundrbolt-admin/src/features/event-dashboard/` (full feature directory)
  - `EventDashboardPage` is the main component
  - Sub-components: `PacingChart`, `SummaryCards`, `SegmentHeatmap`, `ProjectionControls`, `SourceBreakdownChart`
- Backend service: `backend/app/services/event_dashboard_service.py`
- Backend schemas: `backend/app/schemas/event_dashboard.py`
- Backend API: `backend/app/api/v1/admin_event_dashboard.py`

**Auctioneer Dashboard:**
- Route: `frontend/fundrbolt-admin/src/routes/_authenticated/events/$eventId/auctioneer/index.tsx`
- Component: `frontend/fundrbolt-admin/src/features/auctioneer/pages/AuctioneerDashboardPage.tsx`
- Backend service: `backend/app/services/auctioneer_service.py`

**Top-level dashboards (not per-event):**
- `EventDashboard.tsx` — placeholder for Staff role (my events / checkin stats)
- `AuctioneerDashboard.tsx` — placeholder for event_coordinator role (my events / items)
- These are the global home-screen dashboards, NOT the event-scoped dashboards.

**Decision:** Nudge panel goes into:
1. **Event Dashboard page** — `frontend/fundrbolt-admin/src/features/event-dashboard/` alongside existing dashboard feature components
2. **Auctioneer Dashboard page** — `frontend/fundrbolt-admin/src/features/auctioneer/pages/AuctioneerDashboardPage.tsx`

### 2. Source Data for Nudge Computation

All nudge queries are over existing tables:

| Nudge Type | Tables Needed |
|---|---|
| Watchers without bids | `watch_list_entries`, `auction_bids` (JOIN to find watchers with no active bid on same item) |
| Items no bids | `auction_items`, `auction_bids` (LEFT JOIN, filter no bids) |
| Items most bids | `auction_items`, `auction_bids` (GROUP BY + ORDER BY bid count) |
| Closing soon with watchers | `auction_items` (close datetime), `watch_list_entries`, `auction_bids` |
| Outbid still watching | `auction_bids` (status=outbid), `watch_list_entries` |
| Non-participating attendees | `event_registrations`, `registration_guests`, `auction_bids`, `quick_entry_donations`, `revenue_generator_entries` (LEFT JOIN all, find no activity) |
| Revenue generator participation | `revenue_generator_items`, `revenue_generator_entries`, `event_registrations` |
| Goal progress | `events.fundraising_goal` + sum of all revenue sources (reuse `EventDashboardService._get_source_actuals`) |
| Pareto donors | `auction_bids`, `quick_entry_donations`, `npo_donations` (all revenue by user, 80/20 analysis) |
| Paddle raise momentum | `auction_bids` (type=paddle_raise), `paddle_raise_contributions` |

### 3. WatchListEntry Model

Location: `backend/app/models/watch_list_entry.py`

Fields: `item_id` (FK→auction_items), `event_id` (FK→events), `user_id` (FK→users)
UNIQUE constraint: `(item_id, user_id)`

Key query for watchers-without-bids:
```sql
SELECT wl.item_id, ai.title, COUNT(DISTINCT wl.user_id) as watcher_count
FROM watch_list_entries wl
JOIN auction_items ai ON ai.id = wl.item_id AND ai.event_id = :event_id
LEFT JOIN auction_bids ab ON ab.item_id = wl.item_id AND ab.user_id = wl.user_id AND ab.status != 'cancelled'
WHERE wl.event_id = :event_id AND ab.id IS NULL
GROUP BY wl.item_id, ai.title
HAVING COUNT(DISTINCT wl.user_id) >= 2
ORDER BY watcher_count DESC
```

### 4. NotificationService — Action Links

Action links in nudges are frontend navigation URLs (not backend calls). They use TanStack Router path patterns:
- Notification pre-filter: `/events/$eventId/notifications?audience=...`
- Donor Dashboard filter: `/events/$eventId/donor-dashboard?filter=non_participating`
- Auction Items: `/events/$eventId/auction-items?filter=no_bids`
- Auction Dashboard: `/events/$eventId/auction-dashboard`
- Revenue Generators: `/events/$eventId/revenue-generators`

The backend returns `action_url` as a relative path string; the frontend concatenates the event base path.

### 5. Event.fundraising_goal Field

Location: `backend/app/models/event.py`
Type: `Decimal | None` (nullable)
Used by: `event_dashboard_service.py` for pacing calculations

Nudge logic: if `fundraising_goal` is None → skip goal progress nudge.

### 6. Dismissal Persistence Strategy

**Decision: Server-side with PostgreSQL + short-lived rows.**

New table: `event_nudge_dismissals`
- `id` (UUID PK)
- `event_id` (FK→events, CASCADE)
- `user_id` (FK→users, CASCADE)
- `nudge_key` (VARCHAR 200 — e.g., `watchers_no_bid:abc-123-uuid`)
- `action` (VARCHAR 20 — `dismissed` or `actioned`)
- `expires_at` (TIMESTAMPTZ nullable — NULL means suppressed for full session)
- `created_at` (TIMESTAMPTZ)
- UNIQUE: `(event_id, user_id, nudge_key)`

**Cleanup:** Rows where `expires_at < NOW()` are excluded in queries (no background job needed — just filter at query time). Periodic cleanup could be a future maintenance task.

### 7. Frontend Swipe Interaction

The existing codebase doesn't appear to use a dedicated swipe library. Options:
1. **CSS-only swipe with Framer Motion** — `framer-motion` may already be in the frontend deps
2. **Touch gesture via `@use-gesture/react`** — clean API
3. **Simple swipe with `onTouchStart`/`onTouchEnd`** — no extra deps
4. **Buttons for desktop, swipe for mobile** — hybrid approach

**Decision:** Use Framer Motion for drag-to-dismiss (same library pattern used in React community for card swipes). Check if `framer-motion` is already a dep; if not, use simple button-based dismiss with directional visual feedback. Swipe left = dismiss (red), swipe right = actioned (green). Desktop shows button icons on hover.

Check: `grep -r "framer-motion" frontend/fundrbolt-admin/package.json` to determine availability.

### 8. API Design

Single endpoint per nudge fetch:
- `GET /admin/events/{event_id}/nudges` — returns all computed nudges (excluding dismissed/actioned that are still suppressed) sorted by rank ascending
- `POST /admin/events/{event_id}/nudges/{nudge_key}/dismiss` — body: `{"action": "dismissed"|"actioned"}`
- `DELETE /admin/events/{event_id}/nudges/dismissals` — clear all dismissals for this user/event (full reset)

No pagination needed — total active nudges per event expected to be < 30.

### 9. Router Tag

New router: `backend/app/api/v1/admin_event_nudges.py`
Prefix: `/admin/events/{event_id}/nudges`
Tag: `admin-event-nudges`
Auth: requires NPO Admin, NPO Staff, or Auctioneer role for the event.

### 10. Async Notification Strategy

**Celery is already configured** (`backend/app/celery_app.py` exists; notification tasks already use `@celery_app.task`).

**New task file:** `backend/app/tasks/nudge_tasks.py`
- `fan_out_nudge_scans_task` — registered with Celery Beat every 5 minutes; queries events with `EventStatus.ACTIVE` only and calls `nudge_scan_task.delay(event_id)` for each
- `nudge_scan_task(event_id: str)` — per-event computation + notification dispatch

**Notification targeting:**
- NPO Admins for the event's NPO (via `user_role_assignments` or `npo_members` — check existing pattern)
- Users with an `AuctioneerEventSettings` row for this specific event
- NPO Staff / check-in staff do NOT receive nudge notifications

**Notification threshold:** rank ≤ 2 only (ranks 1 and 2). Rank 3+ are panel-only.

**Deduplication via `event_nudge_notification_logs`:**
- `nudge_key` for milestones: `goal_milestone_75`, `goal_milestone_85`, `goal_milestone_90`, `goal_milestone_95`, `goal_milestone_100` — each fires once
- INSERT with ON CONFLICT DO NOTHING prevents double-notification
- When the nudge condition resolves, the log row is deleted → next occurrence fires a fresh notification

**New `NotificationTypeEnum` value:** `NUDGE_ALERT = "nudge_alert"` — extend the existing PostgreSQL enum in the nudge migration.

### 11. `NudgeService.compute_all_nudges` vs `get_nudges`

- `compute_all_nudges(event_id)` → raw computation, no dismissal filtering, no user scoping. Used by Celery task.
- `get_nudges(event_id, user_id, include_dismissed)` → calls `compute_all_nudges`, then filters by dismissals, sets `is_dismissed`. Used by API.

### 12. Event Settings Addition

The `Event` model needs one new field: `nudge_closing_soon_minutes: int` (default 20) — the window for the `closing_soon_watchers` nudge threshold. This is added to the event details/edit page in the admin PWA as a field under "Auction Settings." Migration: ALTER TABLE events ADD COLUMN nudge_closing_soon_minutes INTEGER NOT NULL DEFAULT 20.
