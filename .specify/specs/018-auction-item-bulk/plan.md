# Implementation Plan: Bulk Import Auction Items via Workbook + Images

**Branch**: `018-auction-item-bulk` | **Date**: January 26, 2026 | **Spec**: [.specify/specs/018-auction-item-bulk/spec.md](.specify/specs/018-auction-item-bulk/spec.md)
**Input**: Feature specification from `/specs/018-auction-item-bulk/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable event administrators to bulk import auction items by uploading a single ZIP that includes a workbook manifest and images, with a preflight validation step and a commit step that creates or updates items idempotently. The importer is event-scoped (event selected in the UI), enforces a 500-row cap, validates controlled categories (including “Other”), and returns a detailed import report with row-level outcomes.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0, Pydantic 2.0, React 18, Vite, TanStack Router, Zustand, Radix UI
**Storage**: PostgreSQL (auction items), Azure Blob Storage (images)
**Testing**: pytest (backend), existing frontend test setup
**Target Platform**: Linux server + modern browsers
**Project Type**: Web application (backend + admin frontend)
**Performance Goals**: Preflight 50 items < 1 minute; commit 50 items < 5 minutes
**Constraints**: ZIP-only import, 500-row cap, admin-only access, controlled categories (with “Other”), event selected in UI
**Scale/Scope**: Up to 500 rows per import; typical demo imports 30–50 items

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Donor-Driven Engagement: PASS (admin-only workflow; no donor impact).
- Real-Time Reliability: PASS (no real-time bidding changes).
- Production-Grade Quality: PASS (explicit validation, auditability, error reporting).
- Solo Developer Efficiency: PASS (reuses existing admin workflows, minimal new surface area).
- Data Security and Privacy: PASS (auth-gated import, safe ZIP handling requirements).
- Minimalist Development (YAGNI): PASS (ZIP-only, no AI generation in runtime, no extra options).

**Post-Design Recheck**: PASS (no new violations introduced in research or design artifacts).

## Project Structure

### Documentation (this feature)

```
.specify/specs/018-auction-item-bulk/
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

frontend/
├── fundrbolt-admin/
│   └── src/
│       ├── components/
│       ├── routes/
│       └── services/
```

**Structure Decision**: Web application structure using existing `backend/app` and `frontend/fundrbolt-admin/src` directories.

 