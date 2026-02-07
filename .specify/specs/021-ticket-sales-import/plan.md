# Implementation Plan: Ticket Sales Import

**Branch**: `021-ticket-sales-import` | **Date**: 2026-02-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/021-ticket-sales-import/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement bulk ticket sales import in the admin tickets page with a required preflight step, supporting JSON, CSV, and Excel inputs. Preflight validates required fields, ticket type existence, duplicates, and row limits (5,000), produces error/warning summaries, and requires explicit confirmation to import. Import records are created for valid rows, with warnings for rows skipped due to existing `external_sale_id` values scoped to the selected event.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Python 3.11 (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0, Pydantic 2.0, React 18, Vite, Zustand, Radix UI
**Storage**: PostgreSQL (ticket sales, import batches, audit), Azure Blob Storage (optional staging for uploads)
**Testing**: pytest (backend), Vitest/React Testing Library (frontend)
**Target Platform**: Linux server backend, web PWA admin UI (modern browsers)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: Preflight completes within 60 seconds for up to 5,000 rows
**Constraints**: Preflight required before import; admin-only access; GDPR/PII handling; max 5,000 rows per file
**Scale/Scope**: Admin tickets page import flow; two backend endpoints (preflight + import)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ Donor-Driven Engagement: Admin-only workflow; no donor UX impact.
- ✅ Real-Time Reliability: Not a real-time bidding feature.
- ✅ Production-Grade Quality: Validation, auditability, and clear error reporting required.
- ✅ Solo Developer Efficiency: Reuse existing bulk import UX pattern.
- ✅ Data Security and Privacy: PII handled via secure upload, no plaintext logs.
- ✅ Minimalist Development (YAGNI): Only requested import formats and flow.

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
└── tests/

frontend/
└── fundrbolt-admin/
  └── src/
    ├── components/
    ├── pages/
    └── services/
```

**Structure Decision**: Web application with FastAPI backend in `backend/app` and admin PWA in `frontend/fundrbolt-admin`.

## Complexity Tracking

No constitution violations.
