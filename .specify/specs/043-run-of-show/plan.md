# Implementation Plan: Run-of-Show Management

**Branch**: `043-run-of-show` | **Date**: 2026-05-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/043-run-of-show/spec.md`

## Summary

Admins build a timed schedule (run-of-show) for each event via the Admin PWA. Items carry a wall-clock `scheduled_time`, donor-visibility and auctioneer-visibility flags, and an optional Celery-scheduled notification. Templates (per-NPO + a seeded system-default "3-Hour Gala") let coordinators pre-populate schedules from minute-offset blueprints. Donors see a collapsed timeline card on the event home page; auctioneers see a full RoS card plus a persistent countdown in the header; the Event Dashboard shows a summary card and countdown. Notifications are delivered via the existing feature-035 infrastructure, with a new `ScheduledRunOfShowNotification` entity driving Celery `apply_async(eta=...)` scheduling.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)

**Primary Dependencies**:
- Backend: FastAPI 0.120+, SQLAlchemy 2.0+, Pydantic 2.0+, Alembic, Celery + Redis
- Admin PWA: React 19, Vite, TanStack Router, TanStack React Query 5, Zustand, Radix UI, Tailwind CSS 4
- Donor PWA: React 19, Vite, TanStack Router, TanStack React Query 5, Radix UI, Tailwind CSS 4

**Storage**: Azure Database for PostgreSQL — 4 new tables: `run_of_show_items`, `run_of_show_templates`, `run_of_show_template_items`, `scheduled_run_of_show_notifications`; Azure Cache for Redis (Celery broker — already in use)

**Testing**: `cd backend && poetry run pytest` (contract + integration tests mirroring `app/tests/contract/test_checklist_api.py` + `app/tests/integration/test_checklist_service.py` patterns)

**Target Platform**: Linux server (backend API), PWA (Admin + Donor web browsers, optimised for tablet + mobile)

**Project Type**: Web application (monorepo — backend + 2 frontend PWAs)

**Performance Goals**:
- Donor timeline card loads ≤1s after tap (SC-003)
- Auctioneer countdown refreshes ≥1×/min without full reload (SC-004; 30s polling)
- Notifications delivered within 60s of scheduled time (SC-005)
- State changes reflected across all views within 30s via polling (SC-006)

**Constraints**:
- No WebSocket/real-time — polling at 30s intervals per spec SC-006 + constitution YAGNI
- Template application blocked if `event.start_time` is NULL (FR-009)
- Replacing existing RoS items via template requires frontend confirmation prompt (FR-009)
- Notifications fire at scheduled time even if item manually completed early unless explicitly cancelled (Assumption 6)
- Donor notifications only reach checked-in donors — recipient filter at delivery time by `notification_service` (FR-019)
- System default template is seeded via Alembic; `npo_id=NULL`, `is_system_default=True`, immutable (cannot be edited globally)

**Scale/Scope**: Per-event, ≤50 items typical; ~100 concurrent events; moderate notification volume (≤14 per event from default template)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| YAGNI — no WebSocket for countdowns | ✅ PASS | Polling (30s) explicitly in spec SC-006 |
| YAGNI — no auto-sort by time | ✅ PASS | Manual `display_order` preserved; scheduled_time only used for countdown calc |
| Donor-Driven Engagement — timeline card | ✅ PASS | Card hidden when no donor-visible items (FR-011); collapsed by default (FR-010) |
| Security — notifications only to checked-in donors | ✅ PASS | Recipient filter applied at delivery time by existing notification_service |
| Data model simplicity | ✅ PASS | `is_complete` boolean (not 3-state enum) — simpler than checklist |
| GDPR — no PII in Celery args | ✅ PASS | message_body stored in DB, Celery task receives only notification_id |
| Multi-tenancy isolation | ✅ PASS | `run_of_show_items.event_id` → event → NPO boundary |
| No 4th project | ✅ PASS | All code in existing backend / admin PWA / donor PWA |
| Type safety | ✅ PASS | mypy strict on backend; TypeScript strict on frontend |

## Project Structure

### Documentation (this feature)

```
.specify/specs/043-run-of-show/
├── plan.md                          # This file
├── research.md                      # Phase 0 — resolved unknowns
├── data-model.md                    # Phase 1 — entity definitions + ERD
├── quickstart.md                    # Phase 1 — dev workflow
├── contracts/                       # Phase 1 — OpenAPI YAML files
│   ├── admin-run-of-show.yaml
│   ├── admin-ros-templates.yaml
│   ├── donor-run-of-show.yaml
│   └── auctioneer-run-of-show.yaml
└── tasks.md                         # Phase 2 output (not created here)
```

### Source Code (repository root)

```
backend/
├── alembic/versions/
│   └── ros_001_add_run_of_show_tables.py           # NEW — 4 tables + seed default template
├── app/
│   ├── models/
│   │   └── run_of_show.py                          # NEW — 4 SQLAlchemy models
│   ├── schemas/
│   │   └── run_of_show.py                          # NEW — Pydantic request/response schemas
│   ├── services/
│   │   ├── run_of_show_service.py                  # NEW — CRUD, template, completion logic
│   │   └── run_of_show_notification_service.py     # NEW — Celery schedule/cancel logic
│   ├── api/v1/
│   │   ├── admin_run_of_show.py                    # NEW — admin event RoS + template endpoints
│   │   ├── donor_run_of_show.py                    # NEW — donor public endpoint
│   │   └── auctioneer_run_of_show.py               # NEW — auctioneer endpoint
│   ├── tasks/
│   │   └── run_of_show_tasks.py                    # NEW — send_ros_notification_task (Celery)
│   └── tests/
│       ├── contract/
│       │   └── test_run_of_show_api.py             # NEW — contract tests
│       └── integration/
│           └── test_run_of_show_service.py         # NEW — integration tests

frontend/fundrbolt-admin/src/
├── routes/_authenticated/events/$eventId/
│   └── run-of-show.tsx                             # NEW — TanStack Router route
├── features/events/sections/
│   └── EventRunOfShowPage.tsx                      # NEW — main RoS editor page
├── features/events/components/
│   ├── RunOfShowItem.tsx                           # NEW — inline-editable item row
│   ├── SortableRunOfShowItem.tsx                   # NEW — DnD sortable wrapper
│   ├── RunOfShowItemForm.tsx                       # NEW — inline add/edit form
│   ├── RunOfShowNotificationForm.tsx               # NEW — notification attachment panel
│   └── RunOfShowProgressBar.tsx                   # NEW — completion progress indicator
├── features/auctioneer/
│   ├── components/
│   │   ├── RunOfShowCard.tsx                       # NEW — full RoS card for auctioneer dashboard
│   │   └── RosCountdownBadge.tsx                  # NEW — header countdown widget (clickable)
│   └── pages/
│       └── AuctioneerDashboardPage.tsx             # MODIFY — add RunOfShowCard
├── features/event-dashboard/components/
│   ├── RunOfShowSummaryCard.tsx                    # NEW — summary card with all items
│   └── RosNextItemCountdownCard.tsx               # NEW — "time until next item" card
├── services/
│   └── runOfShowService.ts                         # NEW — API client functions
├── types/
│   └── run-of-show.ts                              # NEW — TypeScript types
└── stores/
    └── runOfShowStore.ts                           # NEW — Zustand (template selection state)

frontend/donor-pwa/src/
├── services/
│   └── runOfShowService.ts                         # NEW — donor API client
├── types/
│   └── run-of-show.ts                              # NEW — donor-facing types
└── components/event-home/
    └── RunOfShowTimelineCard.tsx                   # NEW — collapsed timeline card
    # EventHomePage.tsx                             # MODIFY — add RunOfShowTimelineCard to Home tab
```

**Structure Decision**: Option 2 (Web application). All new backend code follows the existing `checklist` pattern (models → schemas → service → API router → tests). Admin PWA new components live under `features/events/` mirroring `EventChecklistPage`/`ChecklistPanel`. Header countdown integrated into the auctioneer layout top-nav area. Donor card added to Home tab inside existing `EventHomePage.tsx`.

## Complexity Tracking

*No constitution violations requiring justification.*
