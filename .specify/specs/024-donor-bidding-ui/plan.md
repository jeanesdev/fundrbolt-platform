# Implementation Plan: Donor Bidding UI

**Branch**: `024-donor-bidding-ui` | **Date**: 2026-02-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/024-donor-bidding-ui/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Deliver donor PWA bidding UI for silent auction items (gallery bidding with vertical slider, confirmation slide, success notification), item detail browsing with image carousel and bid count, watch list prioritization with watcher counts, buy-now visibility rules, and admin controls for engagement insights and item promotions. Implement donor/admin endpoints and data models for bids, watch list, item views, promotions, and buy-now state, aligned with real-time reliability and GDPR constraints.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0, Pydantic 2.0; React 18, Vite, Zustand, TanStack Router, Radix UI, Tailwind
**Storage**: PostgreSQL (auction items, bids, watch list, item views, promotions), Redis (sessions/cache)
**Testing**: pytest (backend), Playwright (E2E), React Testing Library/Vitest (frontend)
**Target Platform**: Web (PWA) for donor and admin, Linux server for backend
**Project Type**: Web application (backend + multiple frontend PWAs)
**Performance Goals**: Bid updates visible within 500ms; WebSocket reconnect within 2 seconds; gallery interactions feel instantaneous
**Constraints**: GDPR compliance, audit logging for bids, secure auth for admin views, real-time reliability
**Scale/Scope**: 100+ concurrent bidders per event; 10+ events simultaneously (MVP)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Donor-Driven Engagement: PASS — prioritizes low-friction bidding and engagement cues.
- Real-Time Reliability: PASS — requires timely bid updates and confirmation flows.
- Production-Grade Quality: PASS — includes testable requirements, audit logging, and admin visibility.
- Data Security & Privacy: PASS — admin access scoped to event staff; GDPR assumptions retained.
- YAGNI: PASS — scope limited to specified donor/admin behaviors.

**Post-Design Re-check**: PASS — data model and contracts align with donor-first, real-time, and privacy constraints.

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
├── donor-pwa/
│   └── src/
├── fundrbolt-admin/
│   └── src/
└── shared/
```

**Structure Decision**: Web application with shared backend and two PWAs (donor and admin) under existing monorepo structure.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
