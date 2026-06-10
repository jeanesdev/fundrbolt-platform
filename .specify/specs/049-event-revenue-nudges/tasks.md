# Tasks: 049 Event Revenue Nudges

**Input**: Design documents from `/specs/049-event-revenue-nudges/`
**Branch**: `049-event-revenue-nudges`

---

## Phase 1: Foundational — Data Layer & Backend Scaffold

**Purpose**: New DB model, schemas, migration, service stub, and router registration. Nothing else can proceed until complete.

- [ ] T001 [P] Create `backend/app/models/event_nudge_dismissal.py` — `EventNudgeDismissal` model (see data-model.md)

- [ ] T001b [P] Create `backend/app/models/event_nudge_notification_log.py` — `EventNudgeNotificationLog` model:
  - Fields: `id` UUID PK, `event_id` FK→events CASCADE NOT NULL INDEX, `nudge_key` VARCHAR(200) NOT NULL, `notified_at` TIMESTAMPTZ NOT NULL, `created_at` TIMESTAMPTZ NOT NULL
  - `UniqueConstraint("event_id", "nudge_key", name="uq_event_nudge_notification_log")`

- [ ] T001c Add `nudge_closing_soon_minutes: Mapped[int]` column (NOT NULL, DEFAULT 20) to `Event` model in `backend/app/models/event.py`

- [ ] T002 Update `backend/app/models/__init__.py` to import `EventNudgeDismissal` and `EventNudgeNotificationLog`

- [ ] T003 [P] Create `backend/app/schemas/nudge.py` with all schemas:
  - `NudgeType` enum: all 13 types from spec (see data-model.md)
  - `NUDGE_BASE_RANKS: dict[NudgeType, int]` constant mapping each type to its base rank (1–5)
  - `NOTIFYING_NUDGE_TYPES: frozenset[NudgeType]` — types where `rank ≤ 2` (ranks 1 and 2 only)
  - `GOAL_MILESTONE_THRESHOLDS: list[int] = [75, 85, 90, 95, 100]` — each fires its own notification
  - `NudgeItem` Pydantic model: `nudge_key`, `nudge_type`, `rank: int` (1–5), `title`, `description`, `action_url: str | None`, `action_label: str | None`, `affected_count: int`, `metadata: dict[str, Any]`, `is_dismissible: bool`, `notifies_on_appear: bool`, `is_dismissed: bool`
  - `NudgesResponse`: `nudges: list[NudgeItem]`, `total_count: int`, `active_count: int`, `computed_at: datetime`
  - `DismissNudgeRequest`: `action: Literal["dismissed", "actioned"]`
  - `DismissNudgeResponse`: `nudge_key: str`, `action: str`, `expires_at: datetime | None`

- [ ] T004 [P] Create stub `backend/app/services/nudge_service.py` with `NudgeService` class:
  - `__init__(self, db: AsyncSession) -> None`
  - `async def get_nudges(self, event_id: UUID, user_id: UUID) -> NudgesResponse` — stub returns empty list
  - `async def dismiss_nudge(self, event_id: UUID, user_id: UUID, nudge_key: str, action: str) -> DismissNudgeResponse` — stub returns placeholder

- [ ] T005 [P] Create `backend/app/api/v1/admin_event_nudges.py` router:
  - Prefix: `/admin/events/{event_id}/nudges`
  - Tag: `admin-event-nudges`
  - `GET /` → `list_nudges(event_id, include_dismissed, current_user, db)` — calls `NudgeService.get_nudges`
  - `POST /{nudge_key}/dismiss` → `dismiss_nudge(event_id, nudge_key, request, current_user, db)` — calls `NudgeService.dismiss_nudge`; returns 422 if `is_dismissible=False` for `goal_progress` key
  - `DELETE /dismissals` → `clear_dismissals(event_id, current_user, db)` — deletes all `EventNudgeDismissal` rows for `(event_id, user_id)`
  - Auth: require NPO Admin, NPO Staff, or Auctioneer role (use existing `require_role` decorator pattern)

- [ ] T006 Register new router in `backend/app/api/v1/__init__.py`

- [ ] T007 [P] Create `backend/alembic/versions/nudge_001_add_event_nudge_tables.py` migration:
  - CREATE TABLE `event_nudge_dismissals` with all columns, constraints, and indexes from data-model.md
  - CREATE TABLE `event_nudge_notification_logs` with all columns and unique constraint from data-model.md
  - `ALTER TABLE events ADD COLUMN nudge_closing_soon_minutes INTEGER NOT NULL DEFAULT 20`
  - Extend `NotificationTypeEnum` PostgreSQL enum with value `nudge_alert`
  - Verify with `cd backend && poetry run alembic upgrade head`

- [ ] T008 Run `cd backend && poetry run alembic upgrade head` to verify migration applies cleanly

---

## Phase 2: NudgeService — Computation Engine

**Purpose**: Implement all 13 nudge types as individual async query methods. Pure reads from existing tables.

**Prerequisite**: Phase 1 complete.

- [ ] T009 [P] Implement `NudgeService._get_dismissed_keys(event_id, user_id) -> set[str]`:
  - Query `event_nudge_dismissals` WHERE `event_id=`, `user_id=`, AND (`expires_at IS NULL OR expires_at > NOW()`)
  - Returns set of `nudge_key` strings that are still within TTL

- [ ] T010 [P] Implement `NudgeService._compute_watchers_no_bid(event_id) -> list[NudgeItem]`:
  - Query: count distinct items that have ≥1 watcher with no active bid on that item
  - **Single summary nudge** (not per-item): key=`watchers_no_bid`
  - `affected_count` = number of distinct items with unwatched bidders
  - Description: "{N} auction items have watchers who haven't placed a bid yet."
  - Action URL: `/events/{event_id}/auction-dashboard` (not per-item link)
  - base rank = 2; `notifies_on_appear = True`
  - `metadata`: `item_count`, `top_items: [{item_id, item_name, watcher_count}]` (top 3 by watcher count)

- [ ] T011 [P] Implement `NudgeService._compute_items_no_bids(event_id) -> list[NudgeItem]`:
  - Query: auction items for event with LEFT JOIN on bids, having no bids
  - Single nudge: key=`items_no_bids`; `affected_count` = item count
  - Action URL: `/events/{event_id}/auction-items?filter=no_bids`
  - base rank = 3; adjust to rank 2 if count > 5 or event closes within 60 minutes
  - `notifies_on_appear = True`
  - `metadata`: `item_names: list[str]` (first 5)

- [ ] T012 [P] Implement `NudgeService._compute_items_most_bids(event_id) -> list[NudgeItem]`:
  - Query: top 3 items by bid count (active bids only)
  - Single nudge: key=`items_most_bids`; `affected_count` = bid count of top item
  - Action URL: `/events/{event_id}/auction-dashboard`
  - rank = 5; `notifies_on_appear = False`
  - `metadata`: `top_items: [{item_id, item_name, bid_count}]` (top 3)

- [ ] T013 [P] Implement `NudgeService._compute_closing_soon_watchers(event_id, closing_soon_minutes: int) -> list[NudgeItem]`:
  - `closing_soon_minutes` sourced from `event.nudge_closing_soon_minutes` (default 20)
  - Query: items closing within `closing_soon_minutes` that have watchers but no bids
  - One nudge per qualifying item: key=`closing_soon:{item_id}`
  - rank = 1; `notifies_on_appear = True`
  - `metadata`: `item_name`, `minutes_remaining` (floored int), `watcher_count`

- [ ] T014 Implement `NudgeService._compute_outbid_still_watching(event_id) -> list[NudgeItem]`:
  - Query: users who are outbid on an item and have a watch list entry for same item
  - One nudge per item with ≥2 outbid watchers: key=`outbid_watching:{item_id}`
  - priority = `medium`
  - Action URL: `/events/{event_id}/notifications?audience=outbid_watchers&item_id={item_id}`
  - `metadata`: `item_name`, `outbid_watcher_count`

- [ ] T015 [P] Implement `NudgeService._compute_non_participating_attendees(event_id) -> list[NudgeItem]`:
  - Query: registered guests who have check-in records but zero bids, quick-entry donations, or revenue generator entries
  - Key=`non_participating`; `affected_count` = user count
  - Action URL: `/events/{event_id}/donor-dashboard?filter=non_participating`
  - base rank = 2; adjust to rank 3 if count < 5; `notifies_on_appear = True` only if final rank ≤ 2 (i.e., don't notify when count < 5)

- [ ] T016 Implement `NudgeService._compute_revenue_generator_participation(event_id) -> list[NudgeItem]`:
  - Query: active revenue generators for event; JOIN with entries; compute participation rate vs registered attendee count
  - One nudge per RG with participation < 20%: key=`rg_participation:{rg_id}`
  - rank = 3; `notifies_on_appear = False` (rank 3 does not trigger notifications)
  - Action URL: `/events/{event_id}/revenue-generators`
  - `metadata`: `rg_name`, `participation_pct`, `entry_count`, `attendee_count`

- [ ] T017 Implement `NudgeService._compute_revenue_generators_not_started(event_id) -> list[NudgeItem]`:
  - Query: active revenue generators with zero entries total
  - Single nudge: key=`rg_not_started`; `affected_count` = count of unstarted RGs
  - rank = 2; `notifies_on_appear = True`
  - Action URL: `/events/{event_id}/revenue-generators`

- [ ] T018 [P] Implement `NudgeService._compute_goal_progress(event_id) -> list[NudgeItem]`:
  - Query: `events.fundraising_goal`; if None → return []
  - Sum all revenue sources (reuse pattern from `EventDashboardService._get_source_actuals`)
  - Compute `pct = raised / goal * 100`
  - Always emit `goal_progress` nudge (rank 5, `is_dismissible=False`, `notifies_on_appear=False`)
  - For each threshold in `[75, 85, 90, 95, 100]`: if `pct >= threshold`, emit a `goal_milestone_approaching` nudge with key=`goal_milestone_{threshold}` (rank 2, `is_dismissible=True`, `notifies_on_appear=True`)
    - Description: "🎯 You've reached {threshold}% of your ${goal} goal! Keep pushing!"
    - The notification log deduplication in the Celery task ensures each milestone fires exactly once
  - Returns a list: 1 `goal_progress` nudge + 0–5 milestone nudges depending on current progress

- [ ] T019 Implement `NudgeService._compute_pareto_donors(event_id) -> NudgeItem | None`:
  - Query: total revenue per user; sort descending; find how many users account for 75%+ of revenue
  - Only show nudge if top segment is < 30% of total attendees (meaningful Pareto signal)
  - Key=`pareto_donors`; rank=4; `notifies_on_appear=False`
  - Action URL: `/events/{event_id}/donor-dashboard?sort=total_desc`
  - `metadata`: `top_donor_count`, `revenue_pct`, `total_donors`

- [ ] T020 Implement `NudgeService._compute_paddle_raise_momentum(event_id) -> NudgeItem | None`:
  - Query: paddle raise contributions by level (reuse existing paddle raise query patterns from `AuctioneerService`)
  - Show nudge when active paddle raise is in progress and there are recent contributions (within last 10 min)
  - Key=`paddle_raise_momentum`; rank=2; `notifies_on_appear=True`; `is_dismissible=True`
  - `metadata`: `current_level_cents`, `contributor_count`

- [ ] T021 [P] Implement `NudgeService.get_nudges(event_id, user_id, include_dismissed) -> NudgesResponse`:
  - Gather dismissed keys (T009)
  - Run all `_compute_*` methods concurrently using `asyncio.gather`
  - Flatten results into a list of `NudgeItem`
  - Filter out items whose `nudge_key` is in dismissed set (unless `include_dismissed=True`)
  - Mark `is_dismissed=True` on filtered-but-included items
  - Sort: rank ascending → affected_count desc → pin `goal_progress` last
  - Return `NudgesResponse` with counts and `computed_at=datetime.now(UTC)`

- [ ] T022 [P] Implement `NudgeService.dismiss_nudge(event_id, user_id, nudge_key, action) -> DismissNudgeResponse`:
  - `dismissed` → `expires_at = now + 30min`
  - `actioned` → `expires_at = now + 24h` (treat as session-level with hardcap)
  - Upsert `EventNudgeDismissal` using `INSERT ... ON CONFLICT DO UPDATE SET action=..., expires_at=...`
  - Return `DismissNudgeResponse`

---

## Phase 3: API Polish & Testing

**Prerequisite**: Phase 2 complete (NudgeService fully implemented).

- [ ] T023 Add input validation: `nudge_key` path parameter — max 200 chars, URL-decode before service call
- [ ] T024 Add 422 guard: if `nudge_key.startswith("goal_progress")` and `action` in dismiss endpoint → return 422 with message "Goal progress nudge is not dismissible"
- [ ] T025 Write `backend/app/tests/unit/services/test_nudge_service.py`:
  - Unit tests for each `_compute_*` method using mock DB sessions
  - Test `get_nudges` with dismissal filtering and rank sort order
  - Test `dismiss_nudge` TTL logic
  - Test rank context-adjustments (e.g., `watchers_no_bid` bumped to rank 1 when closing in < 30min)
- [ ] T026 Write `backend/app/tests/integration/test_nudge_api.py`:
  - `GET /nudges` returns correct nudge types given seeded data
  - `POST /{key}/dismiss` suppresses nudge on subsequent `GET`
  - `POST /goal_progress/dismiss` returns 422
  - `DELETE /dismissals` clears all; nudges reappear
- [ ] T027 Run backend CI: `cd backend && poetry run ruff check . && poetry run ruff format --check . && poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests' && poetry run pytest -v --tb=short`

---

## Phase 4: Async Background Scan & In-App Notifications

**Prerequisite**: Phase 2 complete (NudgeService computation ready). Celery already configured (`celery_app.py` exists).

- [ ] T028 [P] Create `backend/app/tasks/nudge_tasks.py` with `nudge_scan_task`:
  ```python
  @celery_app.task(name="app.tasks.nudge_tasks.nudge_scan_task")
  def nudge_scan_task(event_id: str) -> dict:
      """Compute nudges for one active event and fire notifications for newly-appearing rank 1 or 2 nudges."""
  ```
  - Task body (run via `asyncio.run`):
    1. Open `AsyncSessionLocal()` DB session
    2. Call `NudgeService.compute_all_nudges(event_id)` — a new public method that returns all `NudgeItem`s without dismissal filtering (used by both this task and `get_nudges`)
    3. Extract the set of `nudge_key`s with `notifies_on_appear=True` from results
    4. Query `event_nudge_notification_logs` for existing keys for this event
    5. New keys = `notifying_keys - already_logged_keys`
    6. Resolved keys = `already_logged_keys - notifying_keys` (nudge resolved → delete log row)
    7. For each new key:
       a. Insert `EventNudgeNotificationLog` row
       b. Find all NPO Admin and Auctioneer users for the event (join `npo_members` / `auctioneer_event_settings`)
       c. Call `NotificationService.create_notification(...)` for each target user with:
          - `notification_type = NotificationTypeEnum.ADMIN_BID_PLACED` (reuse existing or add `NUDGE_ALERT` type — see T028b)
          - `title = f"⚡ Revenue Nudge: {nudge.title}"`
          - `body = nudge.description`
          - `data = {"event_id": event_id, "nudge_key": nudge_key, "action": "open_nudges_panel"}`
          - `priority = NotificationPriorityEnum.HIGH` if rank == 1 else `NotificationPriorityEnum.NORMAL`
    8. For each resolved key: delete `EventNudgeNotificationLog` row (so the notification fires again if condition reoccurs)
    9. Commit; return `{"new_nudges": len(new_keys), "resolved": len(resolved_keys), "event_id": event_id}`

- [ ] T028b Add `NUDGE_ALERT = "nudge_alert"` to `NotificationTypeEnum` in `backend/app/models/notification.py` (and extend the PostgreSQL enum via a new migration or inline in the nudge migration)

- [ ] T029 [P] Register `nudge_scan_task` in Celery Beat schedule in `backend/app/celery_app.py`:
  - Schedule: `every 5 minutes`
  - The beat task should fan out: query all events with `EventStatus.ACTIVE` (only) and call `nudge_scan_task.delay(str(event.id))` for each
  - Create a separate `fan_out_nudge_scans_task` that iterates active events and enqueues per-event tasks

- [ ] T030 Add `NudgeService.compute_all_nudges(event_id) -> list[NudgeItem]` method:
  - Runs all `_compute_*` concurrently (same as `get_nudges` but without dismissal filtering or user scoping)
  - Used by both the API (then filtered) and the Celery task (raw results)

- [ ] T031 Write `backend/app/tests/unit/tasks/test_nudge_tasks.py`:
  - Test that new nudge keys trigger `NotificationService.create_notification` for each target user
  - Test that resolved keys delete the log row
  - Test deduplication: running the task twice with same nudge state creates only one log row and one notification batch

---

## Phase 5: Frontend — NudgesPanel (Full)

**Prerequisite**: Phase 3 (API endpoints working).

- [ ] T032 Create `frontend/fundrbolt-admin/src/features/nudges/types.ts`:
  - TypeScript types from `contracts/api-contracts.md`: `NudgeType`, `NudgeItem`, `NudgesResponse`, `DismissNudgeRequest`, `DismissNudgeResponse`

- [ ] T033 Create `frontend/fundrbolt-admin/src/features/nudges/api.ts`:
  - `nudgesApi.list(eventId, includeDismissed?)` → GET
  - `nudgesApi.dismiss(eventId, nudgeKey, action)` → POST (URL-encode nudge_key)
  - `nudgesApi.clearAll(eventId)` → DELETE

- [ ] T034 Create `frontend/fundrbolt-admin/src/features/nudges/useNudges.ts`:
  - TanStack Query hook: `useNudges(eventId: string)`
  - `refetchInterval: 60_000` (auto-refresh every 60s)
  - `staleTime: 30_000`
  - Optimistic dismissal: `useMutation` for dismiss, instantly removes card from list
  - Expose: `nudges`, `activeCount`, `isLoading`, `dismiss`, `clearAll`, `refresh`
- [ ] T035 [P] Create `frontend/fundrbolt-admin/src/features/nudges/NudgeCard.tsx`:
  - Props: `nudge: NudgeItem`, `onDismiss: () => void`, `onAction: () => void`
  - Rank colors (left border + badge background): rank 1=red, rank 2=amber, rank 3=blue, rank 4/5=slate
  - Show rank badge (number 1–5) in top-right corner of card
  - Title + description + affected_count badge
  - Action button (if `action_url`) → navigates using `useNavigate` from TanStack Router
  - Dismiss button (×) — only shown if `is_dismissible`
  - Done (✓) button → calls `onAction` (marks actioned)
  - **Swipe gesture** (desktop + mobile): drag left → dismiss (red bg), drag right → actioned (green bg); snap back if not dragged far enough (threshold: 80px)
  - Check if `framer-motion` is available (`grep -r '"framer-motion"' frontend/fundrbolt-admin/package.json`); use it for drag animation or fall back to CSS transform + transitionend

- [ ] T036 [P] Create `frontend/fundrbolt-admin/src/features/nudges/NudgesPanel.tsx`:
  - Props: `eventId: string`
  - Uses `useNudges(eventId)`
  - Header: "Revenue Nudges" + `activeCount` badge + refresh button (↻) + "Reset all" link
  - Loading state: skeleton cards
  - Error state: "Could not load nudges — click to retry"
  - Empty state: "No active nudges — your event is running smoothly 🎉" (green check icon)
  - Shows top 5 nudges (sorted by rank ascending); "Show {N} more" button expands to full list
  - `goal_progress` nudge (rank 5) pinned to bottom of visible section (always shown, no dismiss button)
  - Collapsed/expanded state stored in local component state (not persisted)

- [ ] T037 Create `frontend/fundrbolt-admin/src/features/nudges/index.ts` barrel export

---

## Phase 6: Frontend — NudgesCompact (Auctioneer)

**Prerequisite**: Phase 5 (NudgesPanel done, types/api/hook reused).

- [ ] T038 [P] Create `frontend/fundrbolt-admin/src/features/nudges/NudgesCompact.tsx`:
  - Props: `eventId: string`
  - Uses same `useNudges(eventId)` hook
  - Default state: compact card showing count badge + pulsing dot if `activeCount > 0`
  - If `activeCount === 0`: shows "Event running smoothly 🎉" in green
  - Shows lowest rank number present (e.g., "⚡ Rank 1 alert") in the collapsed badge
  - "View Nudges" button → expands inline to show full `NudgesPanel`
  - Expanded state toggled with chevron; panel rendered inline (not a modal/drawer)

---

## Phase 7: Integration

**Prerequisite**: Phases 5 and 6 complete.

- [ ] T039 [P] Modify `frontend/fundrbolt-admin/src/features/event-dashboard/EventDashboardPage.tsx`:
  - Import `NudgesPanel` from `@/features/nudges`
  - Add `<NudgesPanel eventId={eventId} />` at the top of the main content area, above `SummaryCards` and charts
  - Wrap in a `Suspense`-like boundary so nudge load failure doesn't break the rest of the dashboard

- [ ] T040 [P] Modify `frontend/fundrbolt-admin/src/features/auctioneer/pages/AuctioneerDashboardPage.tsx`:
  - Import `NudgesCompact` from `@/features/nudges`
  - Add `<NudgesCompact eventId={eventId} />` near top of page, below the page header
  - `eventId` sourced from TanStack Router `useParams` (same pattern as other auctioneer page components)

- [ ] T041 Run frontend CI:
  - `cd frontend/fundrbolt-admin && pnpm lint`
  - `cd frontend/fundrbolt-admin && pnpm format:check`
  - `cd frontend/fundrbolt-admin && pnpm build`
  - Fix any TypeScript errors or lint issues

- [ ] T042 Manual verification (Playwright or browser): open the Event Dashboard in development, confirm:
  - NudgesPanel renders without breaking the dashboard
  - Mock/seed data shows at least one nudge type with correct rank badge color
  - Dismiss button removes a card
  - Refresh button reloads the list
  - Empty state displays correctly when no nudges are active
  - Rank 1 card shows red left border and "1" badge
