# Implementation Plan: 049 Event Revenue Nudges

**Branch**: `049-event-revenue-nudges` | **Date**: 2026-06-09 | **Spec**: `specs/049-event-revenue-nudges/spec.md`

## Summary

Add a "Revenue Nudges" panel to the Event Dashboard and Auctioneer Dashboard that surfaces real-time, actionable intelligence to staff and auctioneers during live events. Nudges are computed on demand from existing event data — no new data sources required. Dismissals are persisted server-side in a new `event_nudge_dismissals` table. The frontend panel is swipeable (drag-to-dismiss), auto-refreshes every 60 seconds, and links to relevant admin pages for follow-through actions.

**Core technical approach:**
- 2 new DB tables: `event_nudge_dismissals` (server-side dismissal TTL tracking), `event_nudge_notification_logs` (deduplication for async notifications)
- New service: `NudgeService` — pure query layer, no DB writes except dismissals and notification log
- New Celery task: `nudge_scan_task` — runs every 5 minutes for each active event; computes nudges and fires in-app notifications for newly appearing rank 1 and 2 nudges
- New API router: `admin_event_nudges.py` at `/admin/events/{event_id}/nudges`
- New frontend feature: `features/nudges/` with `NudgesPanel`, `NudgesCompact`, `NudgeCard`
- Integrate into `EventDashboardPage` (full panel) and `AuctioneerDashboardPage` (compact badge)

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5.9 (frontend)
**Primary Dependencies**: FastAPI 0.120, SQLAlchemy 2.0, Pydantic 2.0, Alembic (backend); React 19, Vite 7, TanStack Query 5, Zustand, Radix UI, Tailwind CSS 4 (frontend)
**Storage**: Azure Database for PostgreSQL (1 new table: `event_nudge_dismissals`)
**Testing**: pytest + pytest-asyncio (backend), pnpm build/lint (frontend)
**Target Platform**: Admin PWA (desktop + mobile)
**Performance Goals**: Nudge computation <500ms; dismissal write <100ms
**Constraints**: All nudge queries must use existing tables only (no new analytics tables); nudge computation must not block page render (loaded asynchronously after dashboard)
**Scale/Scope**: Per-event; ~10-30 nudges per event max

## Constitution Check

✅ **YAGNI**: No nudge config UI (future), no AI generation, no push on new nudge
✅ **Minimal schema**: 1 table only; all computation is read-only from existing data
✅ **Tenant isolation**: All queries scoped to event → npo_id; no cross-tenant leakage
✅ **Non-blocking**: Nudge panel loads async after dashboard shell renders
✅ **Graceful degradation**: Panel shows empty state if nudge service query times out

## Project Structure

### Documentation (this feature)

```
specs/049-event-revenue-nudges/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 data model
├── contracts/
│   └── api-contracts.md # Phase 1 API contracts
└── tasks.md             # Phase 2 task list
```

### Source Code

```
backend/
├── app/
│   ├── models/
│   │   └── event_nudge_dismissal.py           # NEW
│   ├── schemas/
│   │   └── nudge.py                           # NEW
│   ├── services/
│   │   └── nudge_service.py                   # NEW
│   └── api/v1/
│       └── admin_event_nudges.py              # NEW
└── alembic/versions/
    └── nudge_001_add_event_nudge_dismissals.py  # NEW

frontend/fundrbolt-admin/src/
├── features/
│   └── nudges/
│       ├── index.ts                           # NEW (barrel)
│       ├── types.ts                           # NEW
│       ├── api.ts                             # NEW
│       ├── useNudges.ts                       # NEW (TanStack Query hook)
│       ├── NudgesPanel.tsx                    # NEW (full panel)
│       ├── NudgesCompact.tsx                  # NEW (compact badge)
│       └── NudgeCard.tsx                      # NEW (swipeable card)
├── features/event-dashboard/
│   └── EventDashboardPage.tsx                 # MODIFY — add <NudgesPanel>
└── features/auctioneer/pages/
    └── AuctioneerDashboardPage.tsx            # MODIFY — add <NudgesCompact>
```

## Nudge Priority Ordering

Within the `NudgeService`, nudges are sorted by:
1. Priority: `critical` (0) → `high` (1) → `medium` (2) → `info` (3)
2. Within same priority: `affected_count` descending (more people = more urgent)
3. `goal_progress` nudge is always pinned to last position (it's informational, never critical)

## Nudge TTL Policy

| Action | `expires_at` value | Effect |
|---|---|---|
| `dismissed` | `NOW() + 30 minutes` | Reappears after 30min if still relevant |
| `actioned` | `NULL` | Suppressed until explicit reset or 24h hardcap (`NOW() + 24 hours`) |

## Phase Breakdown

### Phase 1: Data Layer (2 tables, models, migration, schemas, router stub)
Prerequisite for everything else.

### Phase 2: NudgeService — Computation Engine
Pure query layer. Implements all 13 nudge types as individual `async def _compute_*` methods. Assigns `rank` (1–5) with context-based adjustments. No DB writes.

### Phase 3: API Endpoints
3 endpoints: GET nudges, POST dismiss, DELETE dismissals.

### Phase 4: Async Celery Task — Background Scan + Notifications
`nudge_scan_task` runs every 5 minutes per active event. Computes nudges, compares against notification log, fires in-app notifications for newly appearing rank 1 and 2 nudges. Cleans up stale notification log rows when nudges resolve.

### Phase 5: Frontend NudgesPanel
Full swipeable panel with rank colors/badges (1=red, 2=amber, 3=blue, 4/5=slate), action links, expand/collapse, auto-refresh.

### Phase 6: Frontend NudgesCompact
Compact badge for Auctioneer Dashboard with count and expand drawer.

### Phase 7: Integration
Slot `NudgesPanel` into `EventDashboardPage` and `NudgesCompact` into `AuctioneerDashboardPage`.
