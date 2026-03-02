# Implementation Plan: Admin User Import

**Branch**: `027-user-import` | **Date**: 2026-02-16 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/027-user-import/spec.md`

## Summary

Deliver an admin user import flow on the Admin PWA users page with JSON/CSV support, preflight validation, and confirmation. Implement backend import endpoints and services to validate rows, enforce NPO-scoped roles, skip existing members, add memberships for existing users in other NPOs, and send welcome/reset emails for new users without exposing temporary passwords.

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0, Pydantic 2.0, React 18, Vite, TanStack Router, Zustand, Radix UI
**Storage**: PostgreSQL (user accounts, memberships, import audit), Redis (sessions)
**Testing**: pytest, ruff, mypy (backend); pnpm lint/format/build (frontend)
**Target Platform**: Linux server (API), modern browsers (Admin PWA)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: Preflight completes within 60 seconds for up to 5,000 rows
**Constraints**: Do not expose temporary passwords; enforce NPO-scoped roles; GDPR-safe handling of user data
**Scale/Scope**: 5,000 rows per import, admin-only usage, NPO-scoped import

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Donor-driven engagement: Pass (admin workflow only; no donor UX impact)
- Real-time reliability: Pass (batch import, no real-time constraints)
- Production-grade quality: Pass (audited import flow, error reporting)
- Data security and privacy: Pass (no password exposure, email reset flow)
- YAGNI principle: Pass (only specified import flow)
- Immutable constraints: Pass (no plaintext passwords, versioned API)

Re-check after Phase 1 design: Pass

## Project Structure

### Documentation (this feature)

```
specs/027-user-import/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── admin_user_import.py
│   ├── schemas/
│   │   └── user_import.py
│   ├── services/
│   │   └── user_import_service.py
│   ├── models/
│   │   └── (import batch models or audit hooks)
│   └── tasks/
│       └── (email dispatch if async)
└── app/tests/
    └── (import service and API tests)

frontend/
└── fundrbolt-admin/
    └── src/
        └── features/
            └── users/
                ├── api/
                └── components/
```

**Structure Decision**: Use the existing backend API/services/schemas layout and the Admin PWA users feature folder for UI and API client additions.

## Complexity Tracking

No constitution violations requiring justification.
