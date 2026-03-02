# Implementation Plan: Import Auction Bids

**Branch**: `023-import-auction-bids` | **Date**: 2026-02-07 | **Spec**: [.specify/specs/023-import-auction-bids/spec.md](.specify/specs/023-import-auction-bids/spec.md)
**Input**: Feature specification from `/specs/023-import-auction-bids/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Deliver an admin PWA dashboard for auction bids and a two-step import flow (preflight + confirm) that supports JSON, CSV, and Excel files. Preflight validates donor email, item code/number, bid rules, timestamps, and duplicates; confirmation creates bids atomically and records import summaries.

## Technical Context

**Language/Version**: Python 3.11+, TypeScript 5.x
**Primary Dependencies**: FastAPI 0.120+, SQLAlchemy 2.0+, Pydantic 2.0+, React 18, Vite, TanStack Router, Zustand, Radix UI
**Storage**: PostgreSQL (auction bids, import batches), Redis (rate limiting/session)
**Testing**: pytest (backend), frontend unit tests (existing framework), API contract tests where applicable
**Target Platform**: Linux backend + web PWA (admin)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: Preflight validation of 1,000 rows <2 minutes; confirm import of 1,000 rows <3 minutes; dashboard summary loads <3 seconds for 10,000 bids
**Constraints**: Two-step preflight/confirm; block confirmation on any invalid rows; accept bid timestamps as-is; reject exact duplicate rows
**Scale/Scope**: Up to 10,000 bids per import file; events with up to 10,000 bids

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Donor-Driven Engagement**: PASS — admin tooling improves data integrity for donors without adding donor friction.
- **Real-Time Reliability**: PASS — import flow is offline to real-time bidding; no impact to live bid latency.
- **Production-Grade Quality**: PASS — validation, atomic confirm, and audit summaries are required.
- **Solo Developer Efficiency**: PASS — reuse existing import patterns and UI components.
- **Data Security and Privacy**: PASS — donor email used for matching; no new exposure beyond existing roles.
- **Minimalist Development (YAGNI)**: PASS — only specified import formats and dashboard views.

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
backend/
├── app/
│   ├── api/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   └── tests/
└── alembic/

frontend/
└── fundrbolt-admin/
  └── src/
    ├── components/
    ├── pages/
    ├── routes/
    └── services/
```

**Structure Decision**: Web application with backend and admin PWA; all changes land in existing [backend](backend) and [frontend/fundrbolt-admin](frontend/fundrbolt-admin) trees.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
