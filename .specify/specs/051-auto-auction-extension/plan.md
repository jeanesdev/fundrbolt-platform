# Implementation Plan: Silent Auction Anti-Sniping Auto-Extension

**Branch**: `051-auto-auction-extension` | **Date**: 2026-06-25 | **Spec**: `/home/jjeanes/dev/fundrbolt-platform/.specify/specs/051-auto-auction-extension/spec.md`
**Input**: Feature specification from `/home/jjeanes/dev/fundrbolt-platform/.specify/specs/051-auto-auction-extension/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add event-level anti-sniping for silent auction bidding. When a valid bid is accepted within a configured trigger window, the item's closing time extends by a configured duration without exceeding a configured maximum total extension from original close time. Admins manage an event-level toggle and timing values in the admin PWA silent auction area. Existing events without policy are backfilled from system defaults at first evaluation.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x + React 19 (admin frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0, Pydantic 2.0, Alembic, React, TanStack Query/Router, Zustand
**Storage**: PostgreSQL 15 (event policy + item timing), Redis unchanged
**Testing**: pytest (backend contract/integration/unit), frontend lint/build checks, targeted UI tests for admin policy controls
**Target Platform**: Linux containers (Azure App Service/Container Apps), web PWA admin clients
**Project Type**: Web application (backend + frontend monorepo)
**Performance Goals**: Preserve bid processing and realtime update expectations; extension calculation adds no observable latency to bid accept flow
**Constraints**: Use server bid acceptance time only; event-level scope; bounds enforcement (1-10 minutes duration, 0-60 minutes max extension)
**Scale/Scope**: Existing auction flow for multi-event platform; applies to all silent items per event policy

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Donor-Driven Engagement: PASS. Anti-sniping directly improves bidder fairness and trust.
- Real-Time Reliability: PASS. No new async dependency; extension is in bid acceptance path and bounded.
- Production-Grade Quality: PASS with required tests and migration-backed persistence.
- Solo Developer Efficiency: PASS. Minimal, event-scoped change; no speculative feature additions.
- Data Security and Privacy: PASS. No new sensitive data classes.
- Minimalist Development (YAGNI): PASS. Only specified toggle, durations, cap, and rollout defaults.

## Project Structure

### Documentation (this feature)

```
specs/051-auto-auction-extension/
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
│   ├── api/v1/
│   ├── models/
│   ├── schemas/
│   └── services/
├── alembic/versions/
└── tests/

frontend/
└── fundrbolt-admin/
    └── src/
        ├── features/events/auction-items/
        ├── services/
        └── stores/
```

**Structure Decision**: Use the existing web application split. Backend introduces event-level policy persistence and bid-time extension orchestration. Frontend adds event-level controls to silent auction admin UI and API service wiring.

## Phase 0: Research & Decisions

- Produce `research.md` documenting:
  - event-level policy scope and default inheritance
  - server acceptance time as authoritative extension trigger timestamp
  - immediate application semantics for policy changes (prospective only)
  - migration strategy for existing events with missing policy

## Phase 1: Design & Contracts

- Produce `data-model.md` with entities and validation/state rules.
- Produce `contracts/anti_sniping_extension.openapi.yaml` for admin settings and extension-aware bid behavior surfaces.
- Produce `quickstart.md` for local validation flow.
- Run `.specify/scripts/bash/update-agent-context.sh copilot` and keep manual additions intact.

## Post-Design Constitution Re-Check

- Realtime reliability remains within existing architecture constraints: PASS.
- YAGNI maintained by avoiding per-item overrides and unrelated auction settings: PASS.
- Security/privacy unchanged, no new protected categories: PASS.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
