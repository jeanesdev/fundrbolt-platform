# Implementation Plan: Social Login for Donor and Admin PWAs

**Branch**: `[030-social-login-i]` | **Date**: 2026-03-03 | **Spec**: [/home/jjeanes/dev/fundrbolt-platform/.specify/specs/030-social-login-i/spec.md](/home/jjeanes/dev/fundrbolt-platform/.specify/specs/030-social-login-i/spec.md)
**Input**: Feature specification from `/specs/030-social-login-i/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add social sign-in to both donor and admin PWAs as an alternative to email login, with launch support for Apple, Google, Facebook, and Microsoft. The design emphasizes secure account linking (one-time email confirmation for first-time linking), verified-email enforcement, donor-only auto-provisioning, and admin step-up verification while preserving existing RBAC and auditability in current backend/frontend architecture.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x + React 18/19 PWAs (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0, Pydantic 2.0, existing auth/session stack (OAuth2/JWT), React, TanStack Router, Zustand
**Storage**: PostgreSQL 15 (users, social identity links, audit events), Redis 7 (session/token flows)
**Testing**: pytest (unit/integration/contract), frontend lint/build and targeted auth-flow tests
**Target Platform**: Linux-hosted backend APIs and browser-based donor/admin PWAs
**Project Type**: Web application monorepo (backend + multiple frontend PWAs)
**Performance Goals**: Median social sign-in completion <=60 seconds; >=85% first-attempt social sign-in success rate
**Constraints**: Admin social sign-in requires step-up verification; verified email required before account access; no provider-management UI in this feature; no persistence of provider secrets; social-auth data retention/deletion must align with GDPR obligations
**Scale/Scope**: Launch support for Apple/Google/Facebook/Microsoft; login-only scope for donor and admin PWAs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Gate Review

- **Donor-Driven Engagement**: PASS — Social sign-in reduces donor login friction while preserving fallback email login.
- **Real-Time Reliability**: PASS — Auth flow adds no bidding/real-time channel regressions; login latency target is explicit.
- **Production-Grade Quality**: PASS — Plan includes contract, data model, quickstart validation, and explicit error/failure handling.
- **Solo Developer Efficiency**: PASS — Reuses existing auth/RBAC/audit foundations and limits scope to login-only behavior.
- **Data Security and Privacy**: PASS — Verified-email gating, explicit account-link confirmation, admin step-up, audit logging, data minimization, retention/deletion alignment, and log redaction are required.
- **Minimalist Development (YAGNI)**: PASS — Provider-management UI/actions are explicitly out-of-scope for this feature.

### Post-Phase 1 Gate Review

- **Gate status after design artifacts**: PASS
- Design artifacts keep feature surface minimal and testable, avoid speculative account-management expansion, preserve tenant/role boundaries, and include explicit PII handling controls.

## Project Structure

### Documentation (this feature)

```
specs/030-social-login-i/
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
│   ├── core/
│   ├── middleware/
│   ├── models/
│   ├── schemas/
│   └── services/
└── app/tests/
    ├── contract/
    ├── integration/
    └── unit/

frontend/
├── donor-pwa/
│   └── src/
│       ├── routes/
│       ├── components/
│       ├── stores/
│       ├── services/
│       └── lib/
└── fundrbolt-admin/
    └── src/
        ├── routes/
        ├── components/
        ├── features/
        └── lib/

frontend/shared/
└── src/
  ├── types/
  └── utils/
```

**Structure Decision**: Use the existing monorepo web structure. Implement social auth backend changes in `backend/app` with tests in `backend/app/tests`, login UI/session updates in both `frontend/donor-pwa/src` and `frontend/fundrbolt-admin/src`, and shared types/utilities in `frontend/shared/src`.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
