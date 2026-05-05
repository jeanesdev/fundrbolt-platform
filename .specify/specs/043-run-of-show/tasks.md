# Tasks: Run-of-Show Management (043)

**Branch**: `043-run-of-show` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

**Total tasks**: 76

## Phase 1 — Setup (Foundation)

- [ ] T001 [P1] [US1] Create Alembic migration `ros_001_add_run_of_show_tables.py`: create ENUMs `ros_notification_recipient_type_enum` and `ros_notification_delivery_status_enum` — file: `backend/alembic/versions/ros_001_add_run_of_show_tables.py`
- [ ] T002 [P1] [US1] Create table `run_of_show_templates` in migration (columns: id, npo_id, name, is_system_default, created_by, created_at, updated_at; UNIQUE(npo_id, name); CHECK(NOT is_system_default OR npo_id IS NULL)) — file: `backend/alembic/versions/ros_001_add_run_of_show_tables.py`
- [ ] T003 [P1] [US1] Create table `run_of_show_template_items` in migration (columns: id, template_id FK CASCADE, title, description, offset_minutes, donor_visible_default, auctioneer_visible_default, display_order; CHECK(offset_minutes >= 0)) — file: `backend/alembic/versions/ros_001_add_run_of_show_tables.py`
- [ ] T004 [P1] [US1] Create table `run_of_show_items` in migration (columns: id, event_id FK CASCADE, title, description, scheduled_time TIMESTAMPTZ, donor_visible, auctioneer_visible, is_complete, completed_at, display_order, created_by, created_at, updated_at; composite index on (event_id, scheduled_time)) — file: `backend/alembic/versions/ros_001_add_run_of_show_tables.py`
- [ ] T005 [P1] [US6] Create table `scheduled_run_of_show_notifications` in migration (columns: id, ros_item_id FK CASCADE UNIQUE, message_body, recipient_type ENUM, scheduled_at, delivery_status ENUM default 'pending', celery_task_id, delivered_at, failure_reason, created_at, updated_at) — file: `backend/alembic/versions/ros_001_add_run_of_show_tables.py`
- [ ] T006 [P1] [US2] Seed "3-Hour Gala" system default template in migration `upgrade()` with 14 items per FR-008 (npo_id=NULL, is_system_default=TRUE) — file: `backend/alembic/versions/ros_001_add_run_of_show_tables.py`
- [ ] T007 [P1] [US6] Register `run_of_show_tasks` in Celery task routing and autodiscovery in `celery_app.py` — file: `backend/app/celery_app.py`

## Phase 2 — Backend Foundation (Models, Schemas, Core Service)

- [ ] T008 [P1] [US1] Create SQLAlchemy models file with `RosRecipientTypeEnum`, `RosDeliveryStatusEnum`, `RunOfShowTemplate`, `RunOfShowTemplateItem`, `RunOfShowItem`, `ScheduledRunOfShowNotification` — file: `backend/app/models/run_of_show.py`
- [ ] T009 [P1] [US1] Register new models in `backend/app/models/__init__.py` (import all 4 classes so Alembic detects them)
- [ ] T010 [P1] [US1] Create Pydantic schemas: `RunOfShowItemCreate`, `RunOfShowItemUpdate`, `RunOfShowItemResponse`, `RunOfShowResponse`, `RunOfShowReorderRequest` — file: `backend/app/schemas/run_of_show.py`
- [ ] T011 [P1] [US2] Add Pydantic schemas: `RunOfShowTemplateResponse`, `RunOfShowTemplateDetailResponse`, `RunOfShowTemplateItemResponse`, `SaveAsTemplateRequest`, `ApplyTemplateRequest`, `ApplyTemplateResponse` — file: `backend/app/schemas/run_of_show.py`
- [ ] T012 [P1] [US6] Add Pydantic schemas: `RosNotificationCreate`, `RosNotificationResponse` — file: `backend/app/schemas/run_of_show.py`
- [ ] T013 [P1] [US1] Implement `RunOfShowService.get_event_ros()` → returns `RunOfShowResponse` with items sorted by `display_order` + computed `next_item` field (earliest uncompleted future item by `scheduled_time`) — file: `backend/app/services/run_of_show_service.py`
- [ ] T014 [P1] [US1] Implement `RunOfShowService.create_item()` — creates `RunOfShowItem`, auto-assigns `display_order = max_existing + 1` — file: `backend/app/services/run_of_show_service.py`
- [ ] T015 [P1] [US1] Implement `RunOfShowService.update_item()` — partial update, returns `RunOfShowItemResponse` — file: `backend/app/services/run_of_show_service.py`
- [ ] T016 [P1] [US1] Implement `RunOfShowService.delete_item()` — also cancels any pending notification via `RunOfShowNotificationService.cancel_notification()` before deleting — file: `backend/app/services/run_of_show_service.py`
- [ ] T017 [P1] [US1] Implement `RunOfShowService.reorder_items()` — bulk update `display_order` on provided items list — file: `backend/app/services/run_of_show_service.py`
- [ ] T018 [P1] [US1] Implement `RunOfShowService.mark_complete()` and `mark_incomplete()` — sets `is_complete` and `completed_at` — file: `backend/app/services/run_of_show_service.py`

## Phase 3 — US2: Templates

- [ ] T019 [P2] [US2] Implement `RunOfShowService.list_templates(npo_id)` — returns NPO templates + system default — file: `backend/app/services/run_of_show_service.py`
- [ ] T020 [P2] [US2] Implement `RunOfShowService.get_template_detail(template_id)` — loads template with items — file: `backend/app/services/run_of_show_service.py`
- [ ] T021 [P2] [US2] Implement `RunOfShowService.create_template(npo_id, name, created_by)` — creates empty template — file: `backend/app/services/run_of_show_service.py`
- [ ] T022 [P2] [US2] Implement `RunOfShowService.update_template(template_id, name)` — rename only; raises 403 if `is_system_default=True` — file: `backend/app/services/run_of_show_service.py`
- [ ] T023 [P2] [US2] Implement `RunOfShowService.delete_template(template_id)` — raises 403 if `is_system_default=True` — file: `backend/app/services/run_of_show_service.py`
- [ ] T024 [P2] [US2] Implement `RunOfShowService.add_template_item()`, `update_template_item()`, `delete_template_item()` — raises 403 if system default — file: `backend/app/services/run_of_show_service.py`
- [ ] T025 [P2] [US2] Implement `RunOfShowService.reorder_template_items(template_id, items)` — bulk display_order update; raises 403 if system default — file: `backend/app/services/run_of_show_service.py`
- [ ] T026 [P2] [US2] Implement `RunOfShowService.save_as_template(event_id, npo_id, name, created_by)` — copies current event items to new template; computes `offset_minutes = round((item.scheduled_time - event.start_time).total_seconds() / 60)` (mirrors checklist pattern); raises 400 if `event.start_time` is NULL; raises 409 if template name already exists — file: `backend/app/services/run_of_show_service.py`
- [ ] T027 [P2] [US2] Implement `RunOfShowService.apply_template(event_id, template_id, confirm_replace)` — validates event has `start_time`; raises 400 if not; raises 409 if existing items + `confirm_replace=False`; deletes existing items + cancels their notifications; creates new items from template offsets — file: `backend/app/services/run_of_show_service.py`

## Phase 4 — US6: Notifications

- [ ] T028 [P6] [US6] Create Celery task `send_ros_notification_task(notification_id: str)` with `max_retries=2, default_retry_delay=60`; fetches `ScheduledRunOfShowNotification` from DB; dispatches to `NotificationService` based on `recipient_type`; updates `delivery_status` to `delivered` or `failed` — file: `backend/app/tasks/run_of_show_tasks.py`
- [ ] T029 [P6] [US6] Implement `RunOfShowNotificationService.schedule_notification(ros_item_id, message_body, recipient_type)` — creates `ScheduledRunOfShowNotification` row, calls `send_ros_notification_task.apply_async(args=[str(notification_id)], eta=scheduled_time)`, stores returned `task_id` — file: `backend/app/services/run_of_show_notification_service.py`
- [ ] T030 [P6] [US6] Implement `RunOfShowNotificationService.cancel_notification(notification_id)` — calls `celery_app.control.revoke(task_id)`, sets `delivery_status="cancelled"` — file: `backend/app/services/run_of_show_notification_service.py`
- [ ] T031 [P6] [US6] Implement `RunOfShowNotificationService.cancel_all_pending_for_event(event_id)` — fetches all `pending` notifications for event's items, cancels each — file: `backend/app/services/run_of_show_notification_service.py`
- [ ] T032 [P6] [US6] Hook `cancel_all_pending_for_event` into event status-change handler: when event transitions to `cancelled` or `archived`, call this method — file: `backend/app/api/v1/admin_events.py` or `backend/app/services/event_service.py`

## Phase 5 — API Routers

- [ ] T033 [P1] [US1] Create admin RoS router: `GET /admin/events/{event_id}/run-of-show`, `POST /admin/events/{event_id}/run-of-show` — file: `backend/app/api/v1/admin_run_of_show.py`
- [ ] T034 [P1] [US1] Add admin endpoints: `PATCH /admin/events/{event_id}/run-of-show/{item_id}`, `DELETE /admin/events/{event_id}/run-of-show/{item_id}` — file: `backend/app/api/v1/admin_run_of_show.py`
- [ ] T035 [P1] [US1] Add admin endpoints: `POST /admin/events/{event_id}/run-of-show/reorder`, `POST /admin/events/{event_id}/run-of-show/complete/{item_id}`, `POST /admin/events/{event_id}/run-of-show/incomplete/{item_id}` — file: `backend/app/api/v1/admin_run_of_show.py`
- [ ] T036 [P2] [US2] Add template endpoints: `GET /admin/events/{event_id}/run-of-show/templates`, `POST /admin/events/{event_id}/run-of-show/save-as-template`, `POST /admin/events/{event_id}/run-of-show/apply-template` — file: `backend/app/api/v1/admin_run_of_show.py`
- [ ] T037 [P2] [US2] Create NPO template management router: full CRUD + reorder under `/admin/npos/{npo_id}/run-of-show-templates` and `…/{template_id}/items` — file: `backend/app/api/v1/admin_run_of_show.py`
- [ ] T038 [P6] [US6] Add notification endpoints: `GET /admin/events/{event_id}/run-of-show/notification/{item_id}`, `POST`, `DELETE` — file: `backend/app/api/v1/admin_run_of_show.py`
- [ ] T039 [P3] [US3] Create donor RoS router: `GET /events/{event_id}/run-of-show` — returns only `donor_visible=True` items — file: `backend/app/api/v1/donor_run_of_show.py`
- [ ] T040 [P4] [US4] Create auctioneer RoS router: `GET /auctioneer/events/{event_id}/run-of-show` (all `auctioneer_visible` items), `POST /complete/{item_id}`, `POST /incomplete/{item_id}` — file: `backend/app/api/v1/auctioneer_run_of_show.py`
- [ ] T041 [P1] [US1] Register all 3 new routers in `backend/app/main.py` (include `admin_run_of_show.router`, `donor_run_of_show.router`, `auctioneer_run_of_show.router`)

## Phase 6 — Backend Tests

- [ ] T042 [P1] [US1] Contract tests: `GET /admin/events/{event_id}/run-of-show` (empty, with items, unauthenticated, forbidden) — file: `backend/app/tests/contract/test_run_of_show_api.py`
- [ ] T043 [P1] [US1] Contract tests: `POST`, `PATCH`, `DELETE` item endpoints + visibility toggles — file: `backend/app/tests/contract/test_run_of_show_api.py`
- [ ] T044 [P1] [US1] Contract tests: reorder, mark complete/incomplete; also assert `DELETE /admin/npos/{npo_id}/run-of-show-templates/{system_default_id}` → 403 and `PATCH` rename of system default → 403 — file: `backend/app/tests/contract/test_run_of_show_api.py`
- [ ] T045 [P2] [US2] Contract tests: save-as-template, apply-template (success, no start_time 400, confirm required 409), list templates — file: `backend/app/tests/contract/test_run_of_show_api.py`
- [ ] T046 [P3] [US3] Contract tests: `GET /events/{event_id}/run-of-show` (donor-visible filtering, empty returns `[]` not 404) — file: `backend/app/tests/contract/test_run_of_show_api.py`
- [ ] T047 [P4] [US4] Contract tests: auctioneer endpoints (all auctioneer_visible items, complete/incomplete) — file: `backend/app/tests/contract/test_run_of_show_api.py`
- [ ] T048 [P6] [US6] Contract tests: notification CRUD endpoints (create, get, delete; past-time 400; cancel revokes Celery) — file: `backend/app/tests/contract/test_run_of_show_api.py`
- [ ] T049 [P1] [US1] Integration test: `next_item` calculation (earliest uncompleted future item; returns null when all complete/past) — file: `backend/app/tests/integration/test_run_of_show_service.py`
- [ ] T050 [P2] [US2] Integration test: apply_template with/without existing items; event.start_time offset calculation for all 14 default template items — file: `backend/app/tests/integration/test_run_of_show_service.py`
- [ ] T051 [P6] [US6] Integration test: event cancellation/archival cancels all pending notifications — file: `backend/app/tests/integration/test_run_of_show_service.py`

## Phase 7 — Admin PWA (US1: Editor)

- [ ] T052 [P1] [US1] Create TypeScript types `RunOfShowItem`, `RunOfShowResponse`, `RunOfShowTemplate`, `RosNotification` — file: `frontend/fundrbolt-admin/src/types/run-of-show.ts`
- [ ] T053 [P1] [US1] Create `runOfShowService.ts` with API functions: `getRunOfShow`, `createItem`, `updateItem`, `deleteItem`, `reorderItems`, `markComplete`, `markIncomplete`, `listTemplates`, `saveAsTemplate`, `applyTemplate`, `getNotification`, `createNotification`, `deleteNotification` — file: `frontend/fundrbolt-admin/src/services/runOfShowService.ts`
- [ ] T054 [P1] [US1] Create `RunOfShowItem.tsx` — inline-editable row with: title (input), scheduled_time (datetime picker), donor_visible toggle, auctioneer_visible toggle, complete checkbox, bell icon if notification attached — file: `frontend/fundrbolt-admin/src/features/events/components/RunOfShowItem.tsx`
- [ ] T055 [P1] [US1] Create `SortableRunOfShowItem.tsx` — DnD sortable wrapper around `RunOfShowItem` (mirrors `SortableChecklistItem.tsx`) — file: `frontend/fundrbolt-admin/src/features/events/components/SortableRunOfShowItem.tsx`
- [ ] T056 [P1] [US1] Create `RunOfShowItemForm.tsx` — inline add form for new items (title, time, visibility defaults per FR-003) — file: `frontend/fundrbolt-admin/src/features/events/components/RunOfShowItemForm.tsx`
- [ ] T057 [P1] [US1] Create `EventRunOfShowPage.tsx` — main page with item list (React Query, 30s refetch), add item form, "Save as Template" button, "Apply Template" button with confirmation dialog — file: `frontend/fundrbolt-admin/src/features/events/sections/EventRunOfShowPage.tsx`
- [ ] T058 [P1] [US1] Create TanStack Router route file that renders `EventRunOfShowPage` — file: `frontend/fundrbolt-admin/src/routes/_authenticated/events/$eventId/run-of-show.tsx`
- [ ] T059 [P1] [US1] Add "Run of Show" tab to the event workspace sidebar nav (alongside existing Checklist tab) — file: `frontend/fundrbolt-admin/src/components/layout/data/sidebar-data.ts` or equivalent event nav config
- [ ] T060 [P2] [US2] Create `runOfShowStore.ts` — Zustand store for template selection modal state — file: `frontend/fundrbolt-admin/src/stores/runOfShowStore.ts`
- [ ] T061 [P6] [US6] Create `RunOfShowNotificationForm.tsx` — expandable panel on item row for composing notification (message, recipient_type selector, save/cancel/delete) — file: `frontend/fundrbolt-admin/src/features/events/components/RunOfShowNotificationForm.tsx`

## Phase 8 — Admin PWA (US4 + US5: Auctioneer + Event Dashboard)

- [ ] T062 [P4] [US4] Create `RunOfShowCard.tsx` — card component for auctioneer dashboard: lists all auctioneer_visible items, complete toggles, refetches every 30s — file: `frontend/fundrbolt-admin/src/features/auctioneer/components/RunOfShowCard.tsx`
- [ ] T063 [P4] [US4] Create `RosCountdownBadge.tsx` — sticky header badge showing "Next: {title} in HH:MM:SS"; ticks via `setInterval(1000)`; clicking navigates/scrolls to `RunOfShowCard`; shows "Program Complete" when `next_item` is null; rendered in both `AuctioneerDashboardPage` and `LiveAuctionTab` so it persists across auctioneer pages (FR-014) — file: `frontend/fundrbolt-admin/src/features/auctioneer/components/RosCountdownBadge.tsx`
- [ ] T064 [P4] [US4] Add `RunOfShowCard` and `RosCountdownBadge` (sticky top) to `AuctioneerDashboardPage.tsx`; add `RosCountdownBadge` (sticky top) to `LiveAuctionTab` component — satisfies FR-014 "any page in auctioneer interface" — files: `frontend/fundrbolt-admin/src/features/auctioneer/pages/AuctioneerDashboardPage.tsx`, `frontend/fundrbolt-admin/src/features/auctioneer/LiveAuctionTab.tsx` (or equivalent)
- [ ] T065 [P5] [US5] Create `RunOfShowSummaryCard.tsx` — card listing all items with times + completion status for Event Dashboard — file: `frontend/fundrbolt-admin/src/features/event-dashboard/components/RunOfShowSummaryCard.tsx`
- [ ] T066 [P5] [US5] Create `RosNextItemCountdownCard.tsx` — countdown card for Event Dashboard, same logic as `RosCountdownBadge` but in card form — file: `frontend/fundrbolt-admin/src/features/event-dashboard/components/RosNextItemCountdownCard.tsx`
- [ ] T067 [P5] [US5] Add `RunOfShowSummaryCard` and `RosNextItemCountdownCard` to Event Dashboard page — file: `frontend/fundrbolt-admin/src/features/event-dashboard/pages/EventDashboardPage.tsx`

## Phase 9 — Donor PWA (US3)

- [ ] T068 [P3] [US3] Create TypeScript types for donor RoS — file: `frontend/donor-pwa/src/types/run-of-show.ts`
- [ ] T069 [P3] [US3] Create donor `runOfShowService.ts` with `getDonorRunOfShow(eventId)` — file: `frontend/donor-pwa/src/services/runOfShowService.ts`
- [ ] T070 [P3] [US3] Create `RunOfShowTimelineCard.tsx` — collapsed card (Radix Collapsible); hidden entirely when `items.length === 0`; shows preview in collapsed state; items visually distinct (dimmed/strikethrough) when `is_complete=true`; polls every 30s — file: `frontend/donor-pwa/src/components/event-home/RunOfShowTimelineCard.tsx`
- [ ] T071 [P3] [US3] Add `RunOfShowTimelineCard` to Home tab in `EventHomePage.tsx`; fetch with React Query `refetchInterval: 30000` — file: `frontend/donor-pwa/src/features/events/EventHomePage.tsx`

## Phase 10 — Polish & Cross-Cutting

- [ ] T076 [P1] [US1] Document and implement "event start_time changed after RoS built" behaviour: `PATCH /admin/events/{event_id}` does NOT cascade-update RoS `scheduled_time`s; add `event_start_time` field to `RunOfShowResponse` schema so the Admin PWA can display a staleness warning banner if any item's `scheduled_time` < `event.start_time` or if `event_start_time` changed since items were created — files: `backend/app/schemas/run_of_show.py` (add `event_start_time` to `RunOfShowResponse`), `frontend/fundrbolt-admin/src/features/events/sections/EventRunOfShowPage.tsx` (staleness banner)

- [ ] T072 [P1] [US1] Run all backend CI checks and fix any failures: `cd backend && poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests'`, `poetry run pytest -v --tb=short`
- [ ] T073 [P1] [US1] Run all admin PWA CI checks: `cd frontend/fundrbolt-admin && pnpm lint && pnpm format:check && pnpm build`
- [ ] T074 [P3] [US3] Run donor PWA CI checks: `cd frontend/donor-pwa && pnpm lint && pnpm build`
- [ ] T075 [P2] [US2] Verify "3-Hour Gala" seed data in migration: run `alembic upgrade head` on clean DB, query `run_of_show_template_items` — confirm 14 items with correct offsets and visibility defaults per FR-008

---

## User Story Coverage Matrix

| User Story | Tasks |
|-----------|-------|
| US1 — Admin creates & manages RoS | T001–T007, T008–T018, T033–T035, T041, T042–T044, T052–T059, T072–T073 |
| US2 — Templates | T006, T019–T027, T036–T037, T045, T060, T075 |
| US3 — Donor timeline | T039, T046, T068–T071, T074 |
| US4 — Auctioneer countdown | T040, T047, T062–T064 |
| US5 — Event Dashboard | T065–T067 |
| US6 — Notifications | T005, T007, T012, T028–T032, T038, T048, T051, T061 |

---

## Notes

- **T026** (save_as_template): `offset_minutes` is computed as `round((item.scheduled_time − event.start_time).total_seconds() / 60)` — raises 400 if `event.start_time` is NULL. Template items created via "Save as Template" preserve title, description, visibility defaults, and computed offset.
- **Celery always-eager**: In test environments, `celery_task_always_eager=True` means `apply_async` runs synchronously — no separate worker needed for tests.
- **mypy strict**: All new backend code must pass `mypy --strict`. Use `Mapped[...]` type annotations throughout.
