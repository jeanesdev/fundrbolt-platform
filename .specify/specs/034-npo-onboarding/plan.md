# Implementation Plan: NPO Onboarding Wizard

**Branch**: `034-npo-onboarding` | **Date**: 2026-03-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/034-npo-onboarding/spec.md`

## Summary

Replace the existing single-page user sign-up form and single-page NPO creation form with friendly, multi-step wizard flows accessible from public URLs. The backend gains a server-side `onboarding_sessions` table for 24-hour state persistence, invisible CAPTCHA verification on public submission forms, a new NPO application reopen workflow, and two new system emails (welcome + application reopened). The frontend Admin PWA gains two new public wizard routes and refactored auth pages.

## Technical Context

**Language/Version**: Python 3.11 (backend) · TypeScript 5.9 / React 19 (frontend Admin PWA)
**Primary Dependencies**: FastAPI 0.120, SQLAlchemy 2.0, Pydantic 2.0, Alembic (backend); React 19, Vite 7, TanStack Router, Zustand, Radix UI, Tailwind 4 (frontend)
**Storage**: Azure Database for PostgreSQL (new `onboarding_sessions` table; `npo_applications` enum updated; `npos` enum updated) · Azure Cache for Redis (rate-limit keys)
**Testing**: pytest + factory_boy (backend) · Vitest (frontend)
**Target Platform**: Linux / Azure App Service (backend) · Browser PWA — Admin PWA pre-auth public routes (frontend)
**Project Type**: Web application (backend API + frontend PWA)
**Performance Goals**: Wizard step saves p95 < 300ms · Email delivery within 2 minutes of trigger
**Constraints**: No PII in browser-side storage · CAPTCHA token verified server-side · Wizard sessions expire after 24 hours inactivity
**Scale/Scope**: Low-volume flow (new NPO registrations are infrequent) — no caching layer needed for wizard sessions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| No secrets hardcoded | ✅ Pass | CAPTCHA secret key in Azure Key Vault / env var |
| All API routes versioned `/api/v1/` | ✅ Pass | New endpoints under `/api/v1/public/onboarding/` |
| Alembic migration for every schema change | ✅ Pass | Two new migrations planned (sessions table + enum additions) |
| mypy strict on all new Python | ✅ Pass | Required by CI; all new files must pass |
| No plaintext passwords in DB or logs | ✅ Pass | Wizard session stores no passwords; auth handled by existing service |
| Rate limiting on public endpoints | ✅ Pass | `@rate_limit()` applied to register and NPO submit paths |
| YAGNI — build only what spec requires | ✅ Pass | No analytics, no A/B testing, no extra wizard steps added |
| Audit logging for admin actions | ✅ Pass | Approve / reject / reopen writes to `audit_logs` |
| GDPR — PII not in browser storage | ✅ Pass | Server-side sessions confirmed in clarification Q4 |
| New emails use existing template builder | ✅ Pass | Extend `EmailService._create_email_html_template()` |

## Project Structure

### Documentation (this feature)

```
specs/034-npo-onboarding/
├── plan.md                              ← this file
├── research.md                          ← Phase 0 decisions + rationale
├── data-model.md                        ← Phase 1 entities, fields, migrations
├── quickstart.md                        ← Phase 1 local dev setup
├── contracts/
│   ├── onboarding-session-api.yaml      ← wizard session endpoints
│   └── npo-application-admin-api.yaml  ← reopen endpoint
└── tasks.md                             ← Phase 2 (created by /speckit.tasks)
```

### Source Code (repository root)

```
backend/
├── app/
│   ├── api/v1/
│   │   ├── public/
│   │   │   └── onboarding.py          ← NEW: wizard session CRUD + NPO submit
│   │   └── npos.py                    ← MODIFIED: add reopen application endpoint
│   ├── models/
│   │   ├── onboarding_session.py      ← NEW: OnboardingSession SQLAlchemy model
│   │   ├── npo.py                     ← MODIFIED: add UNDER_REVISION to NPOStatus
│   │   └── npo_application.py         ← MODIFIED: add REOPENED to ApplicationStatus
│   ├── schemas/
│   │   └── onboarding.py              ← NEW: Pydantic request/response schemas
│   └── services/
│       ├── onboarding_service.py      ← NEW: wizard state machine + CAPTCHA verify
│       └── email_service.py           ← MODIFIED: add welcome + reopened emails
├── alembic/versions/
│   ├── XXXX_add_onboarding_sessions_table.py
│   └── XXXX_add_npo_application_reopened_status.py
└── app/tests/
    ├── test_onboarding_api.py          ← NEW
    └── test_onboarding_service.py      ← NEW

frontend/fundrbolt-admin/src/
├── routes/(auth)/
│   ├── sign-up.tsx                    ← MODIFIED: refactor to multi-step wizard
│   └── register-npo/
│       └── index.tsx                  ← NEW: NPO onboarding wizard public route
└── features/
    ├── auth/sign-up-wizard/
    │   ├── SignUpWizard.tsx            ← NEW: step container + progress bar
    │   ├── StepAccount.tsx            ← NEW: name + email + password
    │   ├── StepVerifyEmail.tsx        ← NEW: verification waiting + resend
    │   └── index.ts
    └── npo-onboarding/
        ├── NpoOnboardingWizard.tsx    ← NEW: full wizard container
        ├── StepNpoProfile.tsx         ← NEW: NPO details form
        ├── StepFirstEvent.tsx         ← NEW: optional first event form
        ├── StepConfirmation.tsx       ← NEW: submission confirmation screen
        └── index.ts
```

**Structure Decision**: Web application layout. Backend changes are isolated to new files plus minimal modifications to `npos.py`, `npo.py`, `npo_application.py`, and `email_service.py`. Frontend changes are in the Admin PWA only — the donor PWA is untouched. The NPO onboarding wizard lives under `frontend/fundrbolt-admin` as pre-auth public routes, consistent with how `sign-up.tsx` and `sign-in.tsx` work today.

## Complexity Tracking

*No constitution violations — no justification table required.*
