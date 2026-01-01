# Implementation Plan: Table Details Management

**Branch**: `014-table-details-management` | **Date**: 2026-01-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-table-details-management/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add customizable table management to the existing seating system, allowing event coordinators to set individual table capacities (1-20 seats), assign table names (up to 50 characters), and designate table captains from assigned guests. Donors view their table details (number, name, captain) on their home page once the event starts, with updates polling every 10 seconds. The admin UI prevents over-capacity assignments with disabled buttons showing capacity tooltips.

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript 5.x (Frontend)
**Primary Dependencies**: FastAPI 0.120, SQLAlchemy 2.0, Pydantic 2.0, Alembic (Backend); React 18, Vite, TanStack Router, Zustand, Radix UI (Frontend)
**Storage**: Azure Database for PostgreSQL (existing tables: events, registration_guests; new table: event_tables)
**Testing**: pytest (backend), Vitest (frontend)
**Target Platform**: Linux server (backend), Web PWA (frontend - admin and donor)
**Project Type**: Web application (monorepo with backend + 2 frontend PWAs)
**Performance Goals**: Table updates visible within 10 seconds, admin operations complete in <30 seconds, 100% capacity violation prevention
**Constraints**: <300ms API latency p95, 10-second polling interval for donor views, 30-second update window SLA
**Scale/Scope**: Extends Feature 012 (Seating Assignments); affects 3 database models, 2 new API endpoints, admin seating page, donor home page

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ PASSED - No Violations

- **Single Responsibility**: Feature focused solely on table customization (capacity, name, captain) within existing seating system
- **Technology Consistency**: Uses existing stack (Python/TypeScript, PostgreSQL, React PWAs)
- **YAGNI Compliance**: Implements only specified requirements (no table ordering, no auto-assignment, no table templates)
- **Minimal Complexity**: Adds 1 new table (event_tables), extends 1 existing table (registration_guests), minimal API surface
- **Test Coverage**: Standard 80%+ requirement for new code
- **Security**: Row-level security via event_id isolation (existing pattern), no new auth requirements
- **Data Protection**: No PII in new fields (table names are event metadata)

## Project Structure

### Documentation (this feature)

```
specs/014-table-details-management/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
└── tasks.md             # Phase 2 output (NOT created by this command)
```

### Source Code (repository root)

```
backend/
├── alembic/versions/
│   └── [new]_add_table_customization.py    # Database migration
├── app/
│   ├── models/
│   │   ├── event_table.py                  # NEW: EventTable model
│   │   ├── registration_guest.py           # MODIFIED: Add is_table_captain field
│   │   └── event.py                        # READ-ONLY: Reference max_guests_per_table
│   ├── schemas/
│   │   ├── event_table.py                  # NEW: Pydantic schemas
│   │   └── registration_guest.py           # MODIFIED: Add captain fields
│   ├── api/v1/endpoints/
│   │   ├── admin/
│   │   │   └── seating.py                  # MODIFIED: Add table customization endpoints
│   │   └── donor/
│   │       └── events.py                   # MODIFIED: Add table info to event details
│   ├── services/
│   │   └── seating_service.py              # MODIFIED: Add table validation logic
│   └── tests/
│       ├── contract/
│       │   └── test_table_customization_contracts.py  # NEW
│       ├── integration/
│       │   └── test_table_customization_flows.py      # NEW
│       └── unit/
│           └── test_seating_service_validation.py     # MODIFIED

frontend/fundrbolt-admin/
├── src/
│   ├── components/admin/
│   │   ├── seating/
│   │   │   ├── TableDetailsPanel.tsx       # NEW: Edit capacity/name/captain
│   │   │   ├── TableCapacityTooltip.tsx    # NEW: Capacity warning tooltip
│   │   │   └── SeatingChartTable.tsx       # MODIFIED: Show capacity/name
│   │   └── types/
│   │       └── seating.ts                  # MODIFIED: Add table detail types
│   └── services/
│       └── api/seating.ts                  # MODIFIED: Add table endpoints
└── tests/
    └── components/seating/                 # NEW: Component tests

frontend/donor-pwa/
├── src/
│   ├── components/events/
│   │   ├── TableAssignmentCard.tsx         # NEW: Display table details
│   │   └── TableCaptainBadge.tsx           # NEW: Captain indicator
│   ├── routes/
│   │   └── events/$eventSlug/index.tsx     # MODIFIED: Add table info polling
│   └── services/
│       └── api/events.ts                   # MODIFIED: Fetch table details
└── tests/
    └── components/                         # NEW: Component tests
```

**Structure Decision**: Extends existing web application (monorepo with backend + 2 frontend PWAs). New `EventTable` model introduced to store per-table customizations. Existing `RegistrationGuest` model extended with `is_table_captain` boolean field. Admin seating page gains table details panel, donor home page gains table assignment card. No new projects or services needed.

## Complexity Tracking

*No violations to justify - Constitution Check passed without exceptions.*
