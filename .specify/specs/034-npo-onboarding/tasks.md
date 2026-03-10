# Tasks: NPO Onboarding Wizard (034)

**Input**: Design documents from `.specify/specs/034-npo-onboarding/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Total tasks**: 52 | **Test tasks**: 0 (none requested in spec)

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- File paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register new API router and add configuration entries for new dependencies. These changes unblock everything else.

- [ ] T001 Register `/api/v1/public/onboarding` router in `backend/app/main.py` (import and include the new public onboarding router)
- [ ] T002 [P] Add `TURNSTILE_SECRET_KEY: str` and `ADMIN_NOTIFICATION_EMAIL: str` to `backend/app/core/config.py` Settings model
- [ ] T003 [P] Add `VITE_TURNSTILE_SITE_KEY` to frontend type declarations in `frontend/fundrbolt-admin/src/vite-env.d.ts` and update `frontend/fundrbolt-admin/.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, core models, shared utilities, and shared UI components that MUST be complete before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Write Alembic migration for `onboarding_sessions` table and `onboardingsessiontype` enum in `backend/alembic/versions/XXXX_add_onboarding_sessions_table.py` (SQL from data-model.md Migration 1)
- [ ] T005 Write Alembic migration to add `under_revision` to `NPOStatus` and `reopened` to `ApplicationStatus` in `backend/alembic/versions/XXXX_add_npo_application_reopened_status.py` (SQL from data-model.md Migration 2)
- [ ] T006 [P] Create `OnboardingSession` SQLAlchemy model in `backend/app/models/onboarding_session.py` (columns: id, token, session_type, current_step, completed_steps, form_data, user_id FK, expires_at, created_at, updated_at)
- [ ] T007 [P] Add `UNDER_REVISION = "under_revision"` to `NPOStatus` enum in `backend/app/models/npo.py`
- [ ] T008 [P] Add `REOPENED = "reopened"` to `ApplicationStatus` enum in `backend/app/models/npo_application.py`
- [ ] T009 [P] Create Pydantic schemas in `backend/app/schemas/onboarding.py`: `CreateSessionRequest`, `SessionResponse`, `UpdateStepRequest`, `SubmitNpoRequest`, `SubmitNpoResponse`, `ErrorResponse`
- [ ] T010 [P] Implement Cloudflare Turnstile verification in `backend/app/services/captcha_service.py`: async `verify_turnstile_token(token: str, remote_ip: str) -> bool` using `httpx` to call `https://challenges.cloudflare.com/turnstile/v0/siteverify`
- [ ] T011 [P] Create shared wizard UI primitives in `frontend/fundrbolt-admin/src/features/shared/wizard/`: `WizardLayout.tsx` (step container with back/next buttons), `WizardProgressBar.tsx` (step dots/bar), `index.ts`

**Checkpoint**: Migrations applied, models defined, CAPTCHA service ready, and wizard UI shell exists — user story implementation can now begin.

---

## Phase 3: User Story 1 — New Visitor Registers an NPO (Priority: P1) 🎯 MVP

**Goal**: A person with no account can visit a public URL, create an account with email verification, fill in NPO details and an optional first event, submit their application, and see a confirmation screen. The admin team receives an email notification.

**Independent Test**: Open a private browser window → navigate to `/register/npo` → complete all 5 steps (account → verify email → NPO profile → first event → confirmation) → confirm NPO application appears in admin queue → confirm admin notification email received (see quickstart.md §Testing).

### Backend

- [ ] T012 Implement `OnboardingService` in `backend/app/services/onboarding_service.py`: `create_session()`, `get_session_by_token()`, `update_step()`, `submit_npo_onboarding()` (creates `NPO`, `NPOApplication`, optional `Event`, sets `user_id` on session, enforces 24h expiry and at-most-one-active-session-per-user rule)
- [ ] T013 [P] Implement `POST /api/v1/public/onboarding/sessions` in `backend/app/api/v1/public/onboarding.py` with `@rate_limit(max_requests=20, window_seconds=3600)` — creates session, returns opaque token in `Set-Cookie` header and JSON body
- [ ] T014 [P] Implement `GET /api/v1/public/onboarding/sessions/{token}` in `backend/app/api/v1/public/onboarding.py` — returns current_step, completed_steps, non-sensitive form_data; 404 on expired/missing
- [ ] T015 Implement `PATCH /api/v1/public/onboarding/sessions/{token}/steps/{step_name}` in `backend/app/api/v1/public/onboarding.py` — saves step form_data (merged), advances current_step, marks step completed; rejects passwords in form_data
- [ ] T016 Implement `POST /api/v1/public/onboarding/submit` in `backend/app/api/v1/public/onboarding.py` with `@rate_limit(max_requests=5, window_seconds=3600)`: verify Turnstile token via `CaptchaService`, validate session has user_id and completed required steps, call `OnboardingService.submit_npo_onboarding()`, send admin notification email
- [ ] T017 Add `send_npo_application_admin_notification()` method to `backend/app/services/email_service.py` — professionally formatted email to `settings.ADMIN_NOTIFICATION_EMAIL` with applicant name, email, NPO name, EIN, and direct admin review link (FR-016/017/018)

### Frontend

- [ ] T018 [P] Create `NpoOnboardingWizard.tsx` in `frontend/fundrbolt-admin/src/features/npo-onboarding/NpoOnboardingWizard.tsx` — session-aware step container: on mount, create or restore session via token cookie; renders `WizardProgressBar` and active step component; handles back/next navigation
- [ ] T019 [P] Create `StepAccount.tsx` in `frontend/fundrbolt-admin/src/features/auth/sign-up-wizard/StepAccount.tsx` — collects first name, last name, email, password; renders `TurnstileWidget`; on submit calls auth register endpoint; detects duplicate email and prompts sign-in (FR-028 handled here for NPO flow)
- [ ] T020 [P] Create `StepVerifyEmail.tsx` in `frontend/fundrbolt-admin/src/features/auth/sign-up-wizard/StepVerifyEmail.tsx` — polling or event-based check for email verification state; resend button (calls existing `/api/v1/auth/verify-email/resend`); blocks Next until verified (FR-013/014/015)
- [ ] T021 [P] Create `StepNpoProfile.tsx` in `frontend/fundrbolt-admin/src/features/npo-onboarding/StepNpoProfile.tsx` — form fields: NPO name (required), EIN (required, format hint), website URL (required), primary phone (required), mission/description (optional, clearly labelled); saves via `PATCH .../steps/npo_profile`
- [ ] T022 [P] Create `StepFirstEvent.tsx` in `frontend/fundrbolt-admin/src/features/npo-onboarding/StepFirstEvent.tsx` — form: event name, date, type; prominent "Skip for now" button; explains event can be added later; saves via `PATCH .../steps/first_event` (FR-009)
- [ ] T023 [P] Create `StepConfirmation.tsx` in `frontend/fundrbolt-admin/src/features/npo-onboarding/StepConfirmation.tsx` — confirmation screen: submitted NPO name, plain-language explanation of review process, 3–5 business day timeline, what to expect next (FR-006/010)
- [ ] T024 Create `register-npo` route in `frontend/fundrbolt-admin/src/routes/(auth)/register-npo/index.tsx` — renders `NpoOnboardingWizard`; no auth guard (public URL)
- [ ] T025 [P] Create Zustand onboarding session store in `frontend/fundrbolt-admin/src/stores/onboardingSessionStore.ts` — state: `sessionToken`, `currentStep`, `completedSteps`, `sessionType`; actions: `initSession()`, `advanceStep()`, `restoreSession()`
- [ ] T026 [P] Add API client functions in `frontend/fundrbolt-admin/src/lib/api/onboarding.ts`: `createOnboardingSession()`, `getOnboardingSession()`, `updateOnboardingStep()`, `submitNpoOnboarding()`
- [ ] T027 [P] Create `TurnstileWidget.tsx` in `frontend/fundrbolt-admin/src/features/shared/TurnstileWidget.tsx` — invisible Cloudflare Turnstile widget using `@marsidev/react-turnstile`; exposes `onToken` callback; uses `VITE_TURNSTILE_SITE_KEY`
- [ ] T028 Create `index.ts` barrel exports for `npo-onboarding` and `sign-up-wizard` feature directories
- [ ] T029 Wire all NPO wizard steps into `NpoOnboardingWizard.tsx` step map; verify full end-to-end flow renders correctly (account → verify → npo_profile → first_event → confirmation) and session token is persisted between steps

**Checkpoint**: A user with no account can complete the full NPO registration wizard end-to-end. Admin notification email is delivered on submit.

---

## Phase 4: User Story 2 — Existing User Applies to Add an NPO (Priority: P2)

**Goal**: A logged-in user accessing `/register/npo` skips account creation and email verification, starting directly at the NPO profile step. Their second (or subsequent) NPO registration is independent from any existing NPO.

**Independent Test**: Log in as an existing verified user → navigate to `/register/npo` → confirm wizard opens at NPO profile step (no account or verify steps shown) → complete and submit → confirm a new NPO application appears in the admin queue without affecting the user's existing NPO.

### Backend

- [ ] T030 In `POST /api/v1/public/onboarding/sessions`, detect authenticated user from `Authorization: Bearer` header (optional auth): if present and valid, set `user_id` on the new session and set `current_step = 'npo_profile'`; return session with auth-aware initial step in `backend/app/api/v1/public/onboarding.py`
- [ ] T031 In `OnboardingService.create_session()`, enforce at-most-one-active-session-per-`user_id`-per-`session_type` check: if session exists, return existing session token rather than creating a duplicate in `backend/app/services/onboarding_service.py`

### Frontend

- [ ] T032 In `NpoOnboardingWizard.tsx`, read auth state from existing auth store on mount; if user is authenticated, request session with auth token (sets backend to start at `npo_profile`); hide StepAccount and StepVerifyEmail from progress bar and step map in `frontend/fundrbolt-admin/src/features/npo-onboarding/NpoOnboardingWizard.tsx`
- [ ] T033 Add "Register a New NPO" action link in the authenticated admin sidebar or NPO management section so logged-in users can easily discover the flow in `frontend/fundrbolt-admin/src/` (exact nav file per existing codebase structure)

**Checkpoint**: Logged-in users reach NPO profile immediately. No account duplication occurs. Both US1 and US2 paths are independently testable.

---

## Phase 5: User Story 3 — New Visitor Creates a User Account Only (Priority: P3)

**Goal**: A visitor can register a FundrBolt account (without NPO registration) via a clean multi-step sign-up flow accessible from a public URL. The existing single-page sign-up form is replaced by the wizard.

**Independent Test**: Open private browser → navigate to `/sign-up` → complete steps (name/email → password → verify email → dashboard) → confirm account is active and welcome email received. Test duplicate email detection and resend-verification prompt on sign-in with unverified account.

### Backend

- [ ] T034 Apply `@rate_limit(max_requests=20, window_seconds=3600)` to `POST /api/v1/auth/register` in `backend/app/api/v1/auth.py` (FR-025a — check if already present; add if missing)
- [ ] T035 Add Turnstile token field to the register request schema and verify via `CaptchaService` in the register endpoint in `backend/app/api/v1/auth.py` and `backend/app/schemas/auth.py` (FR-025b)
- [ ] T036 Add `send_welcome_email()` method to `backend/app/services/email_service.py` — triggered after email verification is confirmed; professionally formatted with user's first name (FR-030)

### Frontend

- [ ] T037 [P] Create `SignUpWizard.tsx` in `frontend/fundrbolt-admin/src/features/auth/sign-up-wizard/SignUpWizard.tsx` — multi-step container for standalone sign-up: step 1 (name + email), step 2 (password creation), step 3 (verify email), step 4 (redirect to dashboard); reuses `StepAccount.tsx`, `StepVerifyEmail.tsx` from Phase 3
- [ ] T038 Refactor `frontend/fundrbolt-admin/src/routes/(auth)/sign-up.tsx` to render `<SignUpWizard />` instead of the current single-page form; keep route path unchanged so existing links still work
- [ ] T039 In `StepAccount.tsx`, handle the `409 Conflict` (email already registered) response from the register endpoint by rendering a friendly inline message with "Sign in" and "Reset password" links instead of a generic error toast (FR-028)
- [ ] T040 In `frontend/fundrbolt-admin/src/routes/(auth)/sign-in.tsx`, detect the server's `email_not_verified` error code and show a resend-verification prompt (button + friendly copy) rather than an access-denied error message (FR-029)

**Checkpoint**: New users can sign up via the clean wizard. Duplicate email and unverified sign-in edge cases show friendly, helpful UI. US1, US2, and US3 all work independently.

---

## Phase 6: User Story 4 — Admin Reviews and Approves/Rejects/Reopens (Priority: P4)

**Goal**: Admins can see pending NPO applications, approve or reject them, and reopen rejected applications. Each action triggers a professionally formatted email to the applicant. Applications pending > 5 business days are visually flagged.

**Independent Test**: As SuperAdmin, find a pending NPO application → approve it → confirm applicant receives approval email and gains NPO Admin role. Then test rejection with reason → confirm rejection email with reason. Then reopen the rejected application → confirm reopened email. Confirm overdue flag appears after 5 business days on a pending application.

### Backend

- [ ] T041 [P] Implement `POST /api/v1/npos/{npo_id}/applications/{application_id}/reopen` in `backend/app/api/v1/npos.py`: SuperAdmin only; transitions NPO to `UNDER_REVISION`, application to `REOPENED`; appends `review_notes` entry with action, actor, timestamp, and reason; sends reopen email; writes audit log entry (FR-021a, contracts/npo-application-admin-api.yaml)
- [ ] T042 [P] Implement `GET /api/v1/npos/{npo_id}/applications/{application_id}` in `backend/app/api/v1/npos.py` returning full application detail including `review_notes` revision history array (contracts/npo-application-admin-api.yaml)
- [ ] T043 Add `send_npo_application_reopened_email()` method to `backend/app/services/email_service.py` — notifies applicant their application has been reopened for revision; includes admin's reason and a link to resubmit (FR-021a, FR-023, FR-030)
- [ ] T044 Verify approval and rejection emails exist in `backend/app/services/email_service.py`; if missing or not professionally formatted, update/add `send_npo_application_approved_email()` and `send_npo_application_rejected_email()` to match brand standards (FR-023, FR-030)

### Frontend

- [ ] T045 [P] Add Reopen button and confirmation modal to the rejected NPO application detail view in `frontend/fundrbolt-admin/src/` (locate existing NPO admin pages; add modal with reason text field); calls `POST .../applications/{id}/reopen`
- [ ] T046 [P] Add revision history section to the NPO application detail view showing the `review_notes` timeline (submission, rejection reason, reopen notes, resubmission); calls `GET .../applications/{id}`
- [ ] T047 Add overdue visual flag to pending NPO application cards/rows in the admin review queue: calculate business days since `submitted_at`, show orange/red badge when > 5 business days (FR-024)
- [ ] T048 Add API client functions to `frontend/fundrbolt-admin/src/lib/api/npos.ts`: `reopenNpoApplication(npoId, applicationId, reason)`, `getNpoApplication(npoId, applicationId)`

**Checkpoint**: Full admin review loop is complete. Admins can approve, reject, and reopen applications. Applicants receive professionally formatted emails for every decision. All 4 user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, resilience, and cleanup work that spans multiple stories.

- [ ] T049 [P] Email template consistency audit: verify all 6 email types (verification, welcome, NPO admin notification, approval, rejection, reopen) use the same `_create_email_html_template()` header/footer and FundrBolt brand colours in `backend/app/services/email_service.py` (FR-030)
- [ ] T050 [P] Add expired session cleanup: implement a periodic task or background job in `backend/app/tasks/` that deletes `onboarding_sessions` where `expires_at < now()`; wire into app startup or a scheduled call
- [ ] T051 Add NPO name similarity warning in `StepNpoProfile.tsx`: on blur of the NPO name field, call existing NPO search endpoint; if a close match is found, show an inline warning prompting the user to verify their name is intentional (edge case from spec)
- [ ] T052 Run quickstart.md end-to-end validation: follow all test scenarios in `.specify/specs/034-npo-onboarding/quickstart.md` (happy path, resume flow, reopen flow) and confirm all pass; fix any gaps found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately  
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — No dependencies on US2/US3/US4  
- **US2 (Phase 4)**: Depends on Phase 2 — Builds on US1 wizard infrastructure (T018 must be complete)
- **US3 (Phase 5)**: Depends on Phase 2 — Reuses `StepAccount.tsx` and `StepVerifyEmail.tsx` from US1 (T019, T020 must be complete)
- **US4 (Phase 6)**: Depends on Phase 2 — Requires enum additions (T007/T008) and migration (T005) from Phase 2
- **Polish (Phase 7)**: Depends on all 4 user story phases

### User Story Independence

| Story | Can start after | Blocked by | Can run in parallel with |
|-------|----------------|------------|--------------------------|
| US1 (P1) | Phase 2 done | Nothing | US4 backend tasks |
| US2 (P2) | Phase 2 done + T018 done | US1 frontend | US3, US4 |
| US3 (P3) | Phase 2 done + T019/T020 done | US1 StepAccount/VerifyEmail | US4 |
| US4 (P4) | Phase 2 done | Nothing | US1, US3 |

### Within Each User Story

- Backend services (T012, T017) before endpoints (T013–T016)
- Frontend store/API client (T025/T026) before wizard containers (T018)
- Step components (T019–T023) before wizard integration (T029)

---

## Parallel Opportunities

### Phase 2 (run all together after Phase 1)
```
T006 OnboardingSession model
T007 NPOStatus enum update        } all in parallel
T008 ApplicationStatus enum update
T009 Pydantic schemas
T010 CaptchaService
T011 WizardLayout/ProgressBar
```
T004 and T005 (migrations) should run sequentially (T004 → T005) to maintain a clean migration dependency chain.

### Phase 3 (US1) — Backend and Frontend in parallel
```
Backend stream:           Frontend stream:
T012 OnboardingService    T018 NpoOnboardingWizard
T013 POST /sessions    →  T019 StepAccount
T014 GET /sessions        T020 StepVerifyEmail
T015 PATCH /steps         T021 StepNpoProfile
T016 POST /submit         T022 StepFirstEvent
T017 admin email          T023 StepConfirmation
                          T025 Zustand store     } parallel
                          T026 API client        }
                          T027 TurnstileWidget   }
T029 End-to-end integration (requires both streams complete)
```

### Phase 6 (US4) — backend tasks T041, T042, T043, T044 and frontend T045, T046, T048 can all run in parallel

---

## Implementation Strategy

**MVP = Phase 1 + Phase 2 + Phase 3 (US1 only)**

After completing US1, a new NPO can be registered end-to-end via the wizard. This is the highest-value increment and can be shipped independently. US2, US3, and US4 each add a complete, independently testable capability on top of the MVP.

**Suggested delivery order**:
1. Phase 1 + 2 (foundation) — single session
2. Phase 3 (US1) — 2–3 sessions; ships as MVP
3. Phase 6 (US4) can run in parallel with Phase 4/5 as it is backend-heavy and largely independent
4. Phase 4 (US2) + Phase 5 (US3) — one session each
5. Phase 7 (Polish) — final session before PR
