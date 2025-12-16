# Implementation Plan: Seating Assignment & Bidder Number Management

**Branch**: `012-seating-assignment` | **Date**: 2025-12-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `.specify/specs/012-seating-assignment/spec.md`

## Summary

This feature enables event administrators to manage table seating assignments and bidder numbers for event attendees through the Admin PWA, while providing donors visibility into their seating arrangements via the Donor PWA. The system automatically assigns unique three-digit bidder numbers (100-999) to each guest upon registration and allows manual reassignment with automatic conflict resolution. Administrators can configure event seating capacity (number of tables and guests per table), assign guests to tables via drag-and-drop interface or manual selection, and use smart auto-assignment to distribute unassigned guests while keeping registration parties together. Donors can view their table number, bidder number, and tablemates with profile images on the event homepage.

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript 5.x (Frontend)
**Primary Dependencies**: FastAPI 0.120, SQLAlchemy 2.0, Pydantic 2.0, Alembic (Backend); React 18, Vite, TanStack Router, Zustand, Radix UI (Frontend)
**Storage**: Azure Database for PostgreSQL (existing event_registrations, registration_guests tables; new fields: table_number, bidder_number, table_count, max_guests_per_table)
**Testing**: pytest with pytest-asyncio (backend), Vitest (frontend)
**Target Platform**: Azure App Service (backend), Azure Static Web Apps (frontend)
**Project Type**: Web application (backend API + frontend PWA)
**Performance Goals**: Drag-and-drop table reassignment <500ms, bidder number assignment <100ms, page load <1.5s
**Constraints**: Event-scoped bidder number uniqueness (100-999), real-time validation of table capacity, maintain party associations during assignments
**Scale/Scope**: Support 100+ concurrent admins managing seating, 900 max bidder numbers per event, 50 tables with 6-12 guests each (typical event: 200-600 guests)

## Constitution Check

**Status**: ✅ PASSED

### Core Principles Alignment

- ✅ **Donor-Driven Engagement**: Seating information displayed prominently on donor event homepage with tablemate visibility enhances social engagement
- ✅ **Real-Time Reliability**: Drag-and-drop operations target <500ms response time (within constitution's <500ms requirement)
- ✅ **Production-Grade Quality**: Full test coverage planned, type safety with Pydantic/TypeScript, proper error handling
- ✅ **Solo Developer Efficiency**: Leverages existing registration/guest models, reuses admin/donor PWA infrastructure
- ✅ **Data Security**: No new PII fields, uses existing user data with proper access controls
- ✅ **Minimalist Development (YAGNI)**: Implements only specified requirements, no extra features or anticipatory optimizations

### Technology Stack Compliance

- ✅ **Backend**: FastAPI + SQLAlchemy 2.0 + Pydantic 2.0 (matches constitution)
- ✅ **Frontend**: React + Vite + TypeScript + Zustand (matches constitution)
- ✅ **Database**: Azure PostgreSQL with Alembic migrations (matches constitution)
- ✅ **Storage**: Uses existing database tables, extends event_registrations and registration_guests

### Code Quality Standards

- ✅ **Type Safety**: Python type hints + mypy, TypeScript strict mode
- ✅ **Testing**: Unit tests (80%+ coverage target), integration tests for assignment flows
- ✅ **Code Style**: Black, Ruff, ESLint + Prettier (existing tooling)
- ✅ **Commit Messages**: Will follow Conventional Commits (feat/fix/refactor)

### Security & Compliance

- ✅ **Authorization**: RBAC enforcement (only NPO Admins/Staff can manage assignments)
- ✅ **Audit Logging**: Bidder number reassignments tracked in audit logs
- ✅ **Data Protection**: No new sensitive data, uses existing user/registration records

### Performance Targets

- ✅ **API Latency**: <300ms p95 (constitution requirement)
- ✅ **Drag-Drop Operations**: <500ms (specification requirement, within constitution's real-time reliability standard)
- ✅ **Database Queries**: Indexed on event_id, registration_id, table_number for fast lookups

### No Constitution Violations

All requirements align with constitution principles. No complexity justification needed.

## Project Structure

### Documentation (this feature)

```text
specs/012-seating-assignment/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (Phase 0-1 output)
├── research.md          # Phase 0 output (technical decisions)
├── data-model.md        # Phase 1 output (database schema)
├── quickstart.md        # Phase 1 output (setup instructions)
├── contracts/           # Phase 1 output (API contracts)
│   ├── openapi-seating.yaml
│   ├── openapi-bidder-numbers.yaml
│   └── README.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── models/
│   │   ├── event.py                    # [EXTEND] Add table_count, max_guests_per_table
│   │   ├── event_registration.py       # [EXTEND] Add check_in_time field (already exists)
│   │   └── registration_guest.py       # [EXTEND] Add bidder_number, table_number fields
│   ├── schemas/
│   │   ├── event.py                    # [EXTEND] Add seating config schemas
│   │   ├── event_registration.py       # [EXTEND] Add table assignment schemas
│   │   ├── registration_guest.py       # [EXTEND] Add bidder/seating schemas
│   │   └── seating.py                  # [NEW] Seating assignment request/response schemas
│   ├── services/
│   │   ├── bidder_number_service.py    # [NEW] Bidder number assignment/management
│   │   ├── seating_service.py          # [NEW] Table assignment logic
│   │   └── auto_assign_service.py      # [NEW] Smart auto-assignment algorithm
│   ├── api/
│   │   └── v1/
│   │       ├── admin/
│   │       │   ├── seating.py          # [NEW] Admin seating management endpoints
│   │       │   └── events.py           # [EXTEND] Add seating config endpoints
│   │       └── donor/
│   │           └── events.py           # [EXTEND] Add seating info endpoint
│   └── tests/
│       ├── unit/
│       │   ├── test_bidder_number_service.py  # [NEW]
│       │   ├── test_seating_service.py        # [NEW]
│       │   └── test_auto_assign_service.py    # [NEW]
│       ├── integration/
│       │   ├── test_seating_assignment.py     # [NEW]
│       │   └── test_bidder_number_flow.py     # [NEW]
│       └── contract/
│           └── test_seating_api.py            # [NEW]
└── alembic/
    └── versions/
        └── 013_add_seating_and_bidder_fields.py  # [NEW] Migration

frontend/
├── augeo-admin/
│   └── src/
│       ├── components/
│       │   └── seating/
│       │       ├── SeatingTab.tsx              # [NEW] Main seating interface
│       │       ├── TableCard.tsx               # [NEW] Individual table display
│       │       ├── GuestCard.tsx               # [NEW] Draggable guest card
│       │       ├── UnassignedSection.tsx       # [NEW] Unassigned guests list
│       │       ├── TableAssignmentModal.tsx    # [NEW] Manual assignment dialog
│       │       ├── BidderNumberEdit.tsx        # [NEW] Bidder number editor
│       │       └── AutoAssignButton.tsx        # [NEW] Auto-assign trigger
│       ├── routes/
│       │   └── events/
│       │       └── $eventId/
│       │           ├── seating.tsx             # [NEW] Seating tab route
│       │           └── edit.tsx                # [EXTEND] Add table config fields
│       ├── services/
│       │   ├── seating.service.ts              # [NEW] Seating API calls
│       │   └── bidder-number.service.ts        # [NEW] Bidder number API calls
│       └── stores/
│           └── seating.store.ts                # [NEW] Zustand seating state
└── donor-pwa/
    └── src/
        ├── components/
        │   └── event/
        │       ├── MySeatingSection.tsx        # [NEW] Collapsible seating info
        │       ├── TablemateCard.tsx           # [NEW] Tablemate display
        │       └── BidderNumberBadge.tsx       # [NEW] Bidder number display
        ├── routes/
        │   └── events/
        │       └── $eventId/
        │           └── index.tsx                # [EXTEND] Add seating section
        └── services/
            └── event.service.ts                 # [EXTEND] Add seating data fetch
```

**Structure Decision**: Web application structure (Option 2) with existing backend/frontend separation. This feature extends existing models and adds new seating management components to both Admin PWA and Donor PWA. No new microservices or projects needed—follows constitution's modular monolith approach.

## Complexity Tracking

**Status**: No constitution violations to justify.

This feature requires no complexity exceptions. All implementation follows established patterns:

- Extends existing database models (no new tables, only new columns)
- Reuses existing admin/donor PWA infrastructure
- Follows standard CRUD service pattern for seating/bidder management
- Uses existing authorization and audit logging mechanisms

---

## Phase 0: Research

**Status**: ✅ COMPLETE

**Research Document**: [research.md](./research.md)

### Key Technical Decisions

1. **Database Schema**: Extend existing tables (no new tables)
   - Events table: Add `table_count`, `max_guests_per_table`
   - RegistrationGuest table: Add `bidder_number`, `table_number`, `bidder_number_assigned_at`

2. **Bidder Number Assignment**: Sequential with gap filling
   - Algorithm finds first available number in 100-999 range
   - Reuses numbers from cancellations
   - Database trigger enforces event-scoped uniqueness

3. **Conflict Resolution**: Automatic reassignment
   - When admin assigns duplicate bidder number, previous holder gets new unused number
   - Audit log captures full reassignment history
   - In-app notification alerts affected user

4. **Table Assignment**: Nullable integer field on registration_guests
   - NULL = unassigned
   - Service layer validates against table_count and max_guests_per_table

5. **Auto-Assign Algorithm**: Party-aware sequential fill
   - Keeps registration parties together at same table
   - Fills tables sequentially to capacity before moving to next
   - Handles parties too large for single table (error case)

6. **Drag-Drop Performance**: Optimistic UI + background API call
   - Instant visual feedback (<50ms)
   - Background validation within 500ms target
   - Rollback on failure with error notification

7. **Donor Display**: Server-side aggregation
   - Single API call returns seating info + tablemates
   - Collapsible section for progressive disclosure
   - **Bidder number only visible after check-in** (security measure)

8. **Notifications**: In-app only (no email)
   - Bidder number reassignments shown on next donor PWA login
   - Dismissible banner with old and new numbers

9. **Authorization**: Reuse existing RBAC
   - Admin endpoints: NPO Admin or NPO Staff roles
   - Donor endpoints: Registered attendee check

10. **Testing**: Pyramid approach with service layer focus
    - Unit tests for services (80%+ coverage)
    - Integration tests for critical flows
    - Contract tests for API endpoints
    - E2E tests for drag-and-drop

---

## Phase 1: Design

**Status**: ✅ COMPLETE

### Data Model

**Document**: [data-model.md](./data-model.md)

#### Schema Changes

**Events Table Extensions**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `table_count` | INTEGER | NULL, CHECK > 0 | Total number of tables |
| `max_guests_per_table` | INTEGER | NULL, CHECK > 0 | Max capacity per table |

**RegistrationGuest Table Extensions**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `bidder_number` | INTEGER | NULL, CHECK 100-999 | Three-digit bidder number |
| `table_number` | INTEGER | NULL, CHECK > 0 | Assigned table number |
| `bidder_number_assigned_at` | TIMESTAMP WITH TIME ZONE | NULL | Assignment timestamp |

**Database Migrations**:

1. `013_add_seating_configuration.py` - Add seating config to events table
2. `014_add_seating_and_bidder_fields.py` - Add bidder/table fields to registration_guests
3. `015_bidder_number_uniqueness_trigger.py` - Add trigger for event-scoped uniqueness

**Indexes**:

- `idx_registration_guests_bidder_number` on `(registration_id, bidder_number)`
- `idx_registration_guests_table_number` on `table_number`

### API Contracts

**Documents**: [contracts/](./contracts/)

#### Admin Seating Management API

**File**: `admin-seating-api.yaml`

**Endpoints**:

- `PATCH /admin/events/{event_id}/seating/config` - Configure event seating
- `GET /admin/events/{event_id}/seating/guests` - List guests with seating status (paginated, filterable)
- `PATCH /admin/events/{event_id}/guests/{guest_id}/table` - Assign guest to table
- `DELETE /admin/events/{event_id}/guests/{guest_id}/table` - Remove guest from table
- `POST /admin/events/{event_id}/seating/auto-assign` - Auto-assign unassigned guests
- `POST /admin/events/{event_id}/seating/bulk-assign` - Bulk assign guests
- `PATCH /admin/events/{event_id}/guests/{guest_id}/bidder-number` - Assign/change bidder number
- `GET /admin/events/{event_id}/seating/bidder-numbers/available` - Get available bidder numbers
- `GET /admin/events/{event_id}/seating/tables/{table_number}/occupancy` - Get table occupancy

**Authorization**: Requires NPO Admin or NPO Staff role

#### Donor Seating View API

**File**: `donor-seating-api.yaml`

**Endpoints**:

- `GET /donor/events/{event_id}/my-seating` - Get my seating info with tablemates

**Authorization**: Requires registered attendee for the event

### Developer Setup

**Document**: [quickstart.md](./quickstart.md)

**Estimated Setup Time**: 30 minutes

**Setup Steps**:

1. **Database**: Run Alembic migrations (`alembic upgrade head`)
2. **Seed Data**: Run `seed_seating_data.py` for sample event with 10 tables, 30 guests
3. **Backend**: Start FastAPI server (`make dev-backend`)
4. **Frontend**: Start Admin PWA and Donor PWA dev servers
5. **Test**: Run backend tests (`make test-backend`) and frontend tests (`make test-frontend`)

---

## Phase 2: Implementation Tasks
