# Implementation Plan: Event Registration Import

**Branch**: `022-import-registration-add` | **Date**: 2026-02-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/022-import-registration-add/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a bulk import flow for event registrations in the admin PWA with a required preflight validation step and a confirm step that creates records. Support JSON, CSV, and Excel inputs, provide example formats, enforce 5,000-row limits, and follow the existing auction items import UX pattern.

## Technical Context

**Language/Version**: Python 3.11+, TypeScript 5.x
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0, Pydantic 2.0, React 18, Vite, TanStack Router, Zustand
**Storage**: PostgreSQL (registrations), Azure Blob Storage (if staging uploads), Redis (rate limiting)
**Testing**: pytest (backend), Vitest/Testing Library (frontend)
**Target Platform**: Linux server + modern browsers (admin PWA)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: Preflight completes within 60 seconds for files up to 5,000 rows
**Constraints**: Maximum 5,000 rows per import; preflight must block import on required-field errors
**Scale/Scope**: Admin-facing bulk import for single-event batches

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Donor-driven engagement: PASS (admin-only workflow, no donor UX impact)
- Real-time reliability: PASS (no real-time bidding or WebSocket impact)
- Production-grade quality: PASS (preflight + batch audit requirements defined)
- Solo developer efficiency: PASS (reuse existing import patterns)
- Data security & privacy: PASS (admin access only, no new data exposure)
- Minimalist development (YAGNI): PASS (scoped to import flow and preflight)

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
│   └── services/
└── app/tests/

frontend/
└── fundrbolt-admin/
  └── src/
    ├── components/
    ├── pages/
    └── services/
```

**Structure Decision**: Web application with FastAPI backend and React admin PWA frontend, using existing backend/app and frontend/fundrbolt-admin/src structure.

## Complexity Tracking

*No constitution violations detected.*
