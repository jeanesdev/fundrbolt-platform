# Research: NPO Onboarding Wizard (034)

**Date**: 2026-03-10
**Branch**: `034-npo-onboarding`

---

## 1. Existing Infrastructure Audit

### Finding: User registration is a single flat POST — no wizard exists

- `POST /api/v1/auth/register` accepts one `UserCreate` payload with all fields at once.
- Frontend `sign-up.tsx` renders a single Zod form with ~12 fields including optional address fields.
- **Implication**: The multi-step wizard is net-new frontend work; backend registration endpoint can be reused as-is. No backend changes required for Step 1 of the wizard.

### Finding: NPO state machine already partially implements the required flow

The `NPO` model already has `NPOStatus` (DRAFT, PENDING_APPROVAL, APPROVED, SUSPENDED, REJECTED) and the `NPOApplication` model exists with `ApplicationStatus` (SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED).

- The submit flow (`POST /npos/{id}/submit`) already triggers two emails (applicant confirmation + admin notification) via `ApplicationService.submit_application()`.
- **Implication**: Most backend wiring for NPO creation already exists. New work is limited to the reopen workflow, the wizard session table, and the public-facing submit endpoint.

### Finding: No wizard session or draft-session concept exists anywhere in the backend

`grep` for `wizard`, `onboard`, `draft_session`, `WizardSession` returns zero results. The NPO `DRAFT` status serves as a persistent draft but has no expiry or step-tracking.

- **Implication**: The `onboarding_sessions` table is fully new infrastructure.

### Finding: Email service uses inline HTML templates, no file-based templates

`_create_email_html_template()` in `email_service.py` builds inline HTML. All send methods call this builder. Methods for `send_application_submitted_email`, `send_application_approved_email`, `send_application_rejected_email`, and `send_admin_application_notification_email` already exist.

Missing:
- `send_welcome_email` (post-email-verification)
- `send_npo_application_reopened_email` (applicant) — for the new reopen flow

- **Implication**: Add two new methods to `EmailService` using the existing builder pattern.

### Finding: Rate limiting uses `@rate_limit(max_requests, window_seconds)` with Redis

Pre-configured: `@api_rate_limit()` (100/60s) and `@strict_rate_limit()` (2/3600s). Custom values via `@rate_limit(max_requests=N, window_seconds=W)`.

- **Implication**: New public endpoints should use a custom limit (e.g., 10 registrations per hour per IP for sign-up, 5 NPO submissions per hour per IP).

---

## 2. CAPTCHA Decision

**Decision**: Use **Cloudflare Turnstile** (invisible/non-interactive mode) for bot detection on the sign-up and NPO submission forms.

**Rationale**:
- Privacy-friendly: no tracking cookies by default (GDPR-safe out of the box).
- No visible CAPTCHA challenge shown to real users — matches the spec requirement for invisible, non-interactive detection.
- Free tier covers all anticipated volume.
- Simpler server-side verification than reCAPTCHA v3 (binary pass/fail; no score thresholds to calibrate).
- Well-documented JavaScript widget with React integration.

**Alternatives considered**:
- **reCAPTCHA v3**: Score-based — requires tuning thresholds and ongoing monitoring; privacy concerns with Google tracking.
- **hCaptcha**: Privacy-friendly but presents visible challenges on suspected bots, which could harm UX.
- **No CAPTCHA**: Rate limiting alone is insufficient against distributed bots with rotating IPs.

**Integration pattern**:
1. Frontend embeds the Turnstile invisible widget (`<Turnstile sitekey={...} onSuccess={setToken} />`).
2. On form submit, include the `turnstile_token` in the request body.
3. Backend CAPTCHA verifier (in `onboarding_service.py`) calls `https://challenges.cloudflare.com/turnstile/v0/siteverify` with the token and secret key before processing the request.
4. If verification fails, return `422 Unprocessable Entity` with a user-friendly message.

**Environment variables required**:
- `TURNSTILE_SITE_KEY` (frontend, public)
- `TURNSTILE_SECRET_KEY` (backend, secret — stored in Azure Key Vault)

---

## 3. Wizard Session Storage Decision

**Decision**: Server-side session stored in PostgreSQL `onboarding_sessions` table. Browser holds only an opaque `onboarding_token` (UUID) in an HTTP-only cookie.

**Rationale** (confirmed in clarification Q4):
- No PII (name, email, NPO details) resides in browser-side storage.
- Consistent with existing FundrBolt session pattern (auth tokens in Redis/DB, not localStorage).
- 24-hour expiry enforced at the database level via `expires_at` column.

**Session lifecycle**:
1. `POST /api/v1/public/onboarding/sessions` — creates a session row; returns `token` in response (frontend stores as cookie or in-memory Zustand state, sent as `X-Onboarding-Token` header on subsequent calls).
2. `PATCH /api/v1/public/onboarding/sessions/{token}/steps/{step_name}` — updates `form_data` JSONB and `current_step`.
3. On account creation (`POST /auth/register`) — backend links `user_id` to the session.
4. On NPO submit — backend reads session data, creates NPO + application + optional event.
5. Session auto-expires after 24 hours (`expires_at` set at creation; background cleanup or lazy expiry).

---

## 4. NPO Application Reopen State Machine

**Decision**: Add `REOPENED` to `ApplicationStatus` and `UNDER_REVISION` to `NPOStatus`.

**State transition additions**:
```
NPOApplication:  REJECTED → REOPENED (admin action)
NPOApplication:  REOPENED → SUBMITTED (applicant resubmission)
NPO:             REJECTED → UNDER_REVISION (admin reopen action)
NPO:             UNDER_REVISION → PENDING_APPROVAL (applicant resubmission)
```

**Revision history**: The existing `review_notes` JSONB field on `NPOApplication` already stores an array of `{timestamp, reviewer, action, notes}` objects. Append entries for:
- Admin reopen: `{action: "reopened", reviewer: admin_user_id, timestamp, notes: reason}`
- Applicant resubmit: `{action: "resubmitted", reviewer: applicant_user_id, timestamp}`

**Rationale**: Reusing `review_notes` avoids a new table. The field is already JSONB and designed for exactly this audit trail purpose.

---

## 5. Wizard Step Breakdown

### User Sign-Up Only (`session_type = "user_signup"`)

| Step | Name | Fields |
|------|------|--------|
| 1 | `account` | first_name, last_name, email, password, [CAPTCHA token] |
| 2 | `verify_email` | (waiting screen — no fields) |
| 3 | (complete) | Redirect to Admin PWA dashboard |

### NPO Onboarding (`session_type = "npo_onboarding"`)

| Step | Name | Fields |
|------|------|--------|
| 1 | `account` | first_name, last_name, email, password, [CAPTCHA token] *(skipped if authenticated)* |
| 2 | `verify_email` | (waiting screen) *(skipped if authenticated)* |
| 3 | `npo_profile` | npo_name (required), ein (required), website_url (required), phone (required), mission_description (optional) |
| 4 | `first_event` | event_name, event_date, event_type *(optional — skippable)* |
| 5 | `confirmation` | (read-only summary + submit) |

---

## 6. Email Template Decisions

All new emails use the existing `_create_email_html_template()` builder — no new template system introduced.

| Email | Trigger | Recipient |
|-------|---------|-----------|
| **Welcome** | Email address verified | New user |
| **NPO application reopened** | Admin clicks "Reopen" | Applicant |

The welcome email should include: greeting by first name, confirmation that their account is active, a CTA button to "Go to Dashboard", and a footer with support contact.

The reopened email should include: notification that their application for `{npo_name}` has been reopened for revision, any message from the admin (from the reopen notes), a CTA to "Update Your Application", and the 3–5 business day review timeline reminder.

---

## 7. Rate Limit Values for New Public Endpoints

| Endpoint | Limit | Rationale |
|----------|-------|-----------|
| `POST /public/onboarding/sessions` | 20 req/hour/IP | Session creation is cheap; low-volume |
| `POST /auth/register` (existing) | Keep 100/min (existing `@api_rate_limit`) | Already rate-limited |
| `POST /public/onboarding/submit` | 5 req/hour/IP | NPO submission is high-value; tight limit |

The CAPTCHA provides primary bot protection; rate limits are a secondary backstop.
