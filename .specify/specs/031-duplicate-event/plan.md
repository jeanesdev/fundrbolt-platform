# Implementation Plan: Duplicate Event

**Branch**: `031-duplicate-event` | **Date**: 2025-03-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/031-duplicate-event/spec.md`

## Summary

Add an event duplication feature that allows NPO Admins and Event Coordinators to clone an existing event (any status) into a new DRAFT event. The clone copies event details, food options, ticket packages, table configuration, sponsors, and optionally media/links/donation labels. Registrations, bids, seating assignments, and auction items are excluded. The backend exposes a single `POST /api/v1/events/{event_id}/duplicate` endpoint; the frontend adds a "Duplicate" button to both the event list and event edit pages with a confirmation dialog containing optional inclusion toggles.

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript 5.x (Frontend)
**Primary Dependencies**: FastAPI 0.120+, SQLAlchemy 2.0+, Pydantic 2.0+, Alembic (Backend); React 18, Vite, TanStack Router, Zustand, Radix UI (Frontend)
**Storage**: Azure Database for PostgreSQL (existing tables: events, food_options, ticket_packages, event_tables, sponsors, event_media, event_links, donation_labels); Azure Blob Storage (media file deep-copy)
**Testing**: pytest (backend), vitest (frontend)
**Target Platform**: Web (Admin PWA)
**Project Type**: Web application (backend + frontend monorepo)
**Performance Goals**: Duplication completes in under 5 seconds (synchronous operation)
**Constraints**: Max 50MB total media per event limits blob copy time; synchronous with loading spinner
**Scale/Scope**: Single event duplicated at a time; no batch duplication needed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| YAGNI: Build only what's specified | ✅ Pass | Feature matches spec exactly; no unspecified extras |
| No new languages/frameworks | ✅ Pass | Uses existing Python/FastAPI + React/TypeScript stack |
| API backward compatibility | ✅ Pass | New endpoint only; no changes to existing endpoints |
| Security: AuthN/AuthZ | ✅ Pass | Reuses existing `get_current_active_user` + `PermissionService.can_view_event` pattern |
| Data protection | ✅ Pass | No new PII; cloned data inherits existing protections |
| Testing requirements | ✅ Pass | Unit + integration tests planned for service and endpoint |
| Audit logging | ✅ Pass | Duplication action will be logged (source + new event IDs) |
| Database migrations | ✅ Pass | No schema changes needed; feature works with existing tables |
| Type safety | ✅ Pass | Pydantic schemas for request/response; mypy strict |

**Post-Phase 1 re-check**: All gates still pass. No schema migrations required. The design adds one new endpoint, one new service method, and UI components following existing patterns.

## Project Structure

### Documentation (this feature)

```
specs/031-duplicate-event/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── duplicate-event-api.yaml
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```
backend/
├── app/
│   ├── api/v1/
│   │   └── events.py               # Add POST /{event_id}/duplicate endpoint
│   ├── schemas/
│   │   └── event.py                 # Add DuplicateEventRequest schema
│   ├── services/
│   │   ├── event_service.py         # Add duplicate_event() method
│   │   └── media_service.py         # Add copy_blob() method for media deep-copy
│   └── tests/
│       ├── test_event_duplicate.py  # Unit tests for duplication service
│       └── test_event_duplicate_api.py  # Contract/integration tests

frontend/fundrbolt-admin/
├── src/
│   ├── features/events/
│   │   ├── EventListPage.tsx        # Add "Duplicate" button to event cards
│   │   ├── EventEditPage.tsx        # Add "Duplicate Event" action button
│   │   └── components/
│   │       └── DuplicateEventDialog.tsx # NEW: Confirmation dialog with options
│   ├── services/
│   │   └── event-service.ts         # Add duplicateEvent() API call
│   ├── stores/
│   │   └── event-store.ts           # Add duplicateEvent action
│   └── types/
│       └── event.ts                 # Add DuplicateEventRequest type
```

**Structure Decision**: Web application structure using existing `/backend` + `/frontend/fundrbolt-admin` layout. No new directories or projects needed — all changes fit within existing modules.

## Complexity Tracking

No constitution violations to justify — all gates pass cleanly.
