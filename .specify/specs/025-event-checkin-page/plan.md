# Implementation Plan: Event check-in page

**Branch**: `025-event-checkin-page` | **Date**: February 7, 2026 | **Spec**: [.specify/specs/025-event-checkin-page/spec.md](.specify/specs/025-event-checkin-page/spec.md)
**Input**: Feature specification from `/specs/025-event-checkin-page/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Deliver an admin PWA event check-in page with guest search, individual check-in/out with audit logging, on-site updates (donor info, bidder/table, dinner selection), ticket registration and transfers, and a dashboard showing totals plus a searchable list of checked-in guests. Implement supporting backend endpoints and data model updates with audit records and uniqueness enforcement.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI 0.120+, SQLAlchemy 2.0+, Pydantic 2.0+, React 18, Vite, TanStack Router, Zustand, Radix UI
**Storage**: PostgreSQL (registrations, check-ins, audit logs), Redis (sessions)
**Testing**: pytest (backend), Vitest + React Testing Library (frontend), Playwright (E2E)
**Target Platform**: Web (admin PWA) + Linux server backend
**Project Type**: Web application (frontend + backend)
**Performance Goals**: Search results in ≤3 seconds for 95% of queries; dashboard updates within 1 minute; staff check-in flow ≤2 minutes for 95% of check-ins.
**Constraints**: GDPR-aligned data handling, audit logging for check-in/out and transfers, bidder/table uniqueness within event, reversible check-ins require reason.
**Scale/Scope**: 100+ concurrent tablets per event; 50–500+ attendees per event.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Donor-Driven Engagement | Pass | Check-in flow minimizes attendee friction. |
| Real-Time Reliability | Pass | Dashboard updates within 1 minute; no real-time bidding impact. |
| Production-Grade Quality | Pass | Audit logging and uniqueness constraints included. |
| Solo Developer Efficiency | Pass | Reuse existing stack and patterns. |
| Data Security and Privacy | Pass | Admin-only access; audit logs; no new PII exposure. |
| Minimalist Development (YAGNI) | Pass | Only specified check-in capabilities included. |

Re-check after Phase 1 design: Pass.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```
# Web application (frontend + backend)
backend/
├── app/
│   ├── api/
│   ├── models/
│   ├── schemas/
│   └── services/
└── tests/

frontend/
└── fundrbolt-admin/
  ├── src/
  │   ├── components/
  │   ├── pages/
  │   ├── routes/
  │   ├── services/
  │   └── stores/
  └── tests/
```

**Structure Decision**: Web application with backend in [backend/app](backend/app) and admin PWA in [frontend/fundrbolt-admin/src](frontend/fundrbolt-admin/src).

## Complexity Tracking

No constitution violations requiring justification.

## Phase 0: Outline & Research

**Output**: [.specify/specs/025-event-checkin-page/research.md](.specify/specs/025-event-checkin-page/research.md)

Key decisions captured in research:
- Check-in undo requires reason and audit log.
- Check-in unit is per guest/ticket.
- Dashboard includes totals plus searchable list.
- Ticket transfers require no additional verification.
- Bidder/table numbers are unique within event.

## Phase 1: Design & Contracts

**Data model**: [.specify/specs/025-event-checkin-page/data-model.md](.specify/specs/025-event-checkin-page/data-model.md)

**API contracts**: [.specify/specs/025-event-checkin-page/contracts/checkin-api.yaml](.specify/specs/025-event-checkin-page/contracts/checkin-api.yaml)

**Quickstart**: [.specify/specs/025-event-checkin-page/quickstart.md](.specify/specs/025-event-checkin-page/quickstart.md)

## Phase 2: Implementation Plan

1. **Backend**: Add endpoints for search, check-in/out, donor updates, seating updates, dinner selection updates, registration creation, ticket transfer, and dashboard data.
2. **Data model**: Add/extend check-in records and transfer audit logs; enforce uniqueness constraints.
3. **Frontend**: Add admin PWA check-in page with search, guest detail panel, actions, and dashboard view.
4. **Validation & errors**: Enforce required check-out reason, prevent duplicate check-ins, and show conflict messages.
5. **Testing**: Add backend tests for check-in flows and uniqueness; frontend tests for search and check-in actions.
