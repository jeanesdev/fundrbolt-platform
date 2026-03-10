# Quickstart: NPO Onboarding Wizard (034)

**Date**: 2026-03-10
**Branch**: `034-npo-onboarding`

A guide for getting this feature running locally for development and testing.

---

## Prerequisites

Standard FundrBolt dev setup must be in place:

```bash
# From repo root
make docker-up           # Start PostgreSQL + Redis
make install-backend     # Install Python deps via Poetry
make install-frontend    # Install frontend deps via pnpm
```

---

## New Environment Variables

Add the following to your local `.env` (backend) and `.env.local` (frontend):

### Backend (`backend/.env`)
```env
# Cloudflare Turnstile (bot detection)
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA   # Test secret key (always passes)

# Admin notification email (NPO application submissions)
ADMIN_NOTIFICATION_EMAIL=admin@fundrbolt.com
```

### Frontend (`frontend/fundrbolt-admin/.env.local`)
```env
# Cloudflare Turnstile site key (use test key for always-passes behavior)
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

> **Test keys**: Cloudflare provides dedicated test keys that always pass verification without making real network calls. Use these in development. See [Cloudflare Turnstile docs](https://developers.cloudflare.com/turnstile/reference/testing/).

---

## Database Migrations

Two new migrations must be run after pulling this branch:

```bash
make migrate
# or
cd backend && poetry run alembic upgrade head
```

**What they do**:
1. `add_onboarding_sessions_table` — creates the `onboarding_sessions` table and `onboardingsessiontype` enum
2. `add_npo_application_reopened_status` — adds `under_revision` to `NPOStatus` and `reopened` to `ApplicationStatus`

**To roll back**:
```bash
cd backend && poetry run alembic downgrade -2
```
> Note: The enum value additions in migration 2 are forward-only in PostgreSQL. Rolling back will drop the new table but cannot remove enum values without recreating the types (acceptable in dev; document in production runbook).

---

## Running the Feature Locally

```bash
# Terminal 1: Backend
make dev-backend

# Terminal 2: Frontend Admin PWA
make dev-frontend
```

The Admin PWA will be available at `http://localhost:5173`.

**Public wizard URLs** (no login required):
- `http://localhost:5173/register` — user sign-up wizard (refactored from existing sign-up page)
- `http://localhost:5173/register/npo` — NPO onboarding wizard

**Admin review queue** (requires SuperAdmin login):
- `http://localhost:5173/npos` — lists pending NPO applications; approve/reject/reopen actions

---

## Testing the NPO Onboarding Wizard End-to-End

### Happy path: new visitor registers an NPO

1. Open `http://localhost:5173/register/npo` in a private browser window.
2. **Step 1 (Account)**: Enter name, email (use a real mailbox or MailHog), password. Click Next.
3. **Step 2 (Verify Email)**: Open the verification email and click the link (or use the verification token logged in backend dev output). Return to the wizard.
4. **Step 3 (NPO Profile)**: Fill in NPO name, EIN (e.g., `12-3456789`), website URL, phone. Click Next.
5. **Step 4 (First Event)**: Fill event details or click "Skip for now".
6. **Step 5 (Confirmation)**: Review and click Submit.
7. Check admin notification email (sent to `ADMIN_NOTIFICATION_EMAIL`).

### Happy path: admin approves NPO

1. Log in as a SuperAdmin account.
2. Navigate to `/npos` → find the pending application.
3. Click Approve. Confirm the approval email is sent to the applicant.

### Reopen flow

1. Reject the NPO application with a reason.
2. Confirm rejection email received by applicant.
3. Click "Reopen" on the rejected application. Enter a reason.
4. Confirm reopened email received by applicant.
5. Log out. Log back in as the applicant.
6. Navigate to the NPO application — should show revision mode.
7. Update and resubmit. Confirm re-enters pending queue.

### Resume wizard after 24h expiry

1. Complete Steps 1–2 of the NPO wizard.
2. In the database, manually set `expires_at = now() - interval '1 hour'` on the session.
3. Return to the wizard URL. Confirm the user sees a "session expired" message with an option to start over.

---

## Email Testing

In development, emails are typically sent to the configured transactional email service or logged to stdout. To capture emails locally:

```bash
# Using MailHog (if docker-compose includes it)
open http://localhost:8025
```

Or check backend logs — the `EmailService` logs the email payload at DEBUG level when `ENVIRONMENT=development`.

---

## Running Tests

```bash
# Backend — all onboarding tests
cd backend && poetry run pytest app/tests/test_onboarding_api.py app/tests/test_onboarding_service.py -v

# Backend — full suite
make test-backend

# Frontend — unit tests
cd frontend/fundrbolt-admin && pnpm test
```

---

## Key Backend Files

| File | Purpose |
|------|---------|
| `backend/app/api/v1/public/onboarding.py` | Public wizard session + submit endpoints |
| `backend/app/models/onboarding_session.py` | OnboardingSession SQLAlchemy model |
| `backend/app/services/onboarding_service.py` | Wizard state machine + CAPTCHA verification |
| `backend/app/schemas/onboarding.py` | Pydantic request/response models |
| `backend/app/api/v1/npos.py` | Modified — adds reopen application endpoint |
| `backend/app/services/email_service.py` | Modified — adds welcome + reopened emails |

## Key Frontend Files

| File | Purpose |
|------|---------|
| `src/routes/(auth)/sign-up.tsx` | Refactored sign-up wizard |
| `src/routes/(auth)/register-npo/index.tsx` | NPO onboarding wizard route |
| `src/features/auth/sign-up-wizard/SignUpWizard.tsx` | Step container + progress bar |
| `src/features/npo-onboarding/NpoOnboardingWizard.tsx` | Full NPO wizard container |
| `src/features/npo-onboarding/StepNpoProfile.tsx` | NPO details form (core required fields) |
