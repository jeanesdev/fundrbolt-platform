# Tasks: NPO Onboarding Wizard

**Input**: Design documents from `/specs/034-npo-onboarding/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Exact file paths are listed in every description

---

## Phase 1: Setup

**Purpose**: Environment configuration and wiring that must exist before any implementation begins.

- [ ] T001 Add `TURNSTILE_SECRET_KEY` and `ADMIN_NOTIFICATION_EMAIL` to `backend/.env.example`
- [ ] T002 [P] Add `VITE_TURNSTILE_SITE_KEY` to `frontend/fundrbolt-admin/.env.example`
- [ ] T003 Register public onboarding router (`/api/v1/public/onboarding`) in `backend/app/main.py`

**Checkpoint**: Environment variables documented; router mount point registered.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and core model/schema infrastructure that ALL user stories depend on. No user story work can begin until this phase is complete.

**⚠️ CRITICAL**: Complete this phase before starting any user story phase.

- [ ] T004 Write Alembic migration `add_onboarding_sessions_table` (create `onboarding_sessions` table + `onboardingsessiontype` enum + indexes) in `backend/alembic/versions/xxxx_add_onboarding_sessions_table.py`
- [ ] T005 Create `OnboardingSession` SQLAlchemy model (`id`, `token`, `session_type`, `current_step`, `completed_steps`, `form_data`, `user_id` FK, `expires_at`, `created_at`, `updated_at`) in `backend/app/models/onboarding_session.py`
- [ ] T006 [P] Create Pydantic schemas (`CreateSessionRequest`, `UpdateStepRequest`, `SubmitOnboardingRequest`, `SessionResponse`, `SubmitOnboardingResponse`, `ErrorResponse`) in `backend/app/schemas/onboarding.py`
- [ ] T007 Run `alembic upgrade head` to apply new migration and confirm table exists

**Checkpoint**: `onboarding_sessions` table is live; `OnboardingSession` model and schemas are importable. User story implementation can now begin.

---

## Phase 3: User Story 1 — New Visitor Registers an NPO (Priority: P1) 🎯 MVP

**Goal**: A person with no FundrBolt account can start at a public URL, create their account, verify their email, fill in NPO details, optionally create a first event, and submit their application — arriving at a confirmation screen. The admin team receives an email notification.

**Independent Test**: A tester with no account opens `http://localhost:5173/register/npo` in a private window, completes all wizard steps including email verification, and reaches a confirmation screen that states the typical review timeline is 3–5 business days. The backend `audit_logs` table has a new submitted entry; the admin notification email is sent within 2 minutes.

### Backend — Service & Logic

- [ ] T008 Create `OnboardingService` with `create_session()`, `get_session()`, `update_step()`, and `expire_stale_sessions()` methods in `backend/app/services/onboarding_service.py`
- [ ] T009 Add `verify_turnstile_token(token: str) -> bool` helper to `OnboardingService` (calls Cloudflare Turnstile verify API) in `backend/app/services/onboarding_service.py`
- [ ] T010 Add `submit_npo_onboarding()` method to `OnboardingService` — validates session completeness, creates NPO record (status `PENDING_APPROVAL`), creates `NPOApplication` record, optionally creates first `Event`, dispatches admin notification email in `backend/app/services/onboarding_service.py`
- [ ] T011 Add near-match NPO name duplicate warning check to `OnboardingService.submit_npo_onboarding()` (returns warning flag, not a hard error) in `backend/app/services/onboarding_service.py`

### Backend — API Endpoints

- [ ] T012 Implement `POST /api/v1/public/onboarding/sessions` with `@rate_limit(max_requests=20, window_seconds=3600)` in `backend/app/api/v1/public/onboarding.py`
- [ ] T013 [P] Implement `GET /api/v1/public/onboarding/sessions/{token}` (returns session state; 404 if expired) in `backend/app/api/v1/public/onboarding.py`
- [ ] T014 [P] Implement `PATCH /api/v1/public/onboarding/sessions/{token}/steps/{step_name}` (merge step data, advance `current_step`, update `completed_steps`) in `backend/app/api/v1/public/onboarding.py`
- [ ] T015 Implement `POST /api/v1/public/onboarding/submit` with `@rate_limit(max_requests=5, window_seconds=3600)`, Turnstile verification, CAPTCHA-rejection friendy error, and `OnboardingService.submit_npo_onboarding()` dispatch in `backend/app/api/v1/public/onboarding.py`

### Backend — Email

- [ ] T016 Add `send_npo_application_submitted_admin_notification()` to `EmailService` (professionally formatted, includes applicant name/email, NPO name, description, direct admin link per FR-016/017) in `backend/app/services/email_service.py`

### Frontend — Shared Components

- [ ] T017 Create onboarding API client functions (`createSession`, `getSession`, `updateStep`, `submitOnboarding`) using existing axios/fetch patterns in `frontend/fundrbolt-admin/src/lib/api/onboarding.ts`
- [ ] T018 [P] Create `TurnstileWidget` component (wraps Cloudflare Turnstile invisible widget, exposes `onVerify` callback) in `frontend/fundrbolt-admin/src/features/npo-onboarding/TurnstileWidget.tsx`
- [ ] T019 Create `SignUpWizard` reusable step container with persistent step progress bar component in `frontend/fundrbolt-admin/src/features/auth/sign-up-wizard/SignUpWizard.tsx`
- [ ] T020 [P] Create `StepAccount` component — collects first name, last name, email, password; triggers account creation; handles "email already exists" with friendly sign-in prompt (FR-028) in `frontend/fundrbolt-admin/src/features/auth/sign-up-wizard/StepAccount.tsx`
- [ ] T021 [P] Create `StepVerifyEmail` component — verification waiting screen with resend link; polls or listens for verification completion; blocks Next until verified (FR-013/014) in `frontend/fundrbolt-admin/src/features/auth/sign-up-wizard/StepVerifyEmail.tsx`
- [ ] T022 Create barrel export file in `frontend/fundrbolt-admin/src/features/auth/sign-up-wizard/index.ts`

### Frontend — NPO Onboarding Wizard

- [ ] T023 [P] Create `StepNpoProfile` component — required fields: NPO name, EIN, website URL, phone; optional: mission/description; shows duplicate-name warning when applicable (FR-000) in `frontend/fundrbolt-admin/src/features/npo-onboarding/StepNpoProfile.tsx`
- [ ] T024 [P] Create `StepFirstEvent` component — basic event fields (name, date, type) with clearly labelled "Skip for now" action (FR-009) in `frontend/fundrbolt-admin/src/features/npo-onboarding/StepFirstEvent.tsx`
- [ ] T025 [P] Create `StepConfirmation` component — explains NPO is under review, states 3–5 business day timeline, describes next steps (FR-006/010) in `frontend/fundrbolt-admin/src/features/npo-onboarding/StepConfirmation.tsx`
- [ ] T026 Create `NpoOnboardingWizard` container — session lifecycle (create on load, restore state on reload via cookie token), step orchestration (account → verify → npo_profile → first_event → confirmation), back-navigation, session expiry messaging in `frontend/fundrbolt-admin/src/features/npo-onboarding/NpoOnboardingWizard.tsx`
- [ ] T027 Create public route `register-npo` (TanStack Router) that renders `NpoOnboardingWizard` in `frontend/fundrbolt-admin/src/routes/(auth)/register-npo/index.tsx`
- [ ] T028 Create barrel export file in `frontend/fundrbolt-admin/src/features/npo-onboarding/index.ts`

**Checkpoint**: A new visitor can navigate to `/register/npo`, complete the full wizard end-to-end including email verification, and receive a submission confirmation. Admin notification email is dispatched. US1 is fully functional and independently testable.

---

## Phase 4: User Story 2 — Existing User Applies to Add an NPO (Priority: P2)

**Goal**: A logged-in FundrBolt user can start the NPO onboarding flow and skip directly to the NPO profile step because they are already authenticated with a verified email.

**Independent Test**: A tester logged in to an existing account opens `/register/npo`, sees the wizard open at the NPO profile step (account and email steps are absent from the progress bar), completes NPO details and optional first event, submits, and receives the confirmation screen.

- [ ] T029 Update `POST /api/v1/public/onboarding/sessions` to accept an optional `Authorization: Bearer` header; if valid JWT provided, set `user_id` on the new session and set `current_step = 'npo_profile'` in `backend/app/api/v1/public/onboarding.py`
- [ ] T030 Update `OnboardingService.create_session()` to accept optional `user_id: UUID | None`; when set, skip to `npo_profile` step and mark `account` and `verify_email` as pre-completed in `backend/app/services/onboarding_service.py`
- [ ] T031 Update `NpoOnboardingWizard` to detect auth state on mount; if logged-in, pass auth token to `createSession` call so wizard opens at NPO profile step, hiding account and verify steps from progress bar in `frontend/fundrbolt-admin/src/features/npo-onboarding/NpoOnboardingWizard.tsx`

**Checkpoint**: Logged-in users skip account/verify steps; submitted NPO is a new entity separate from any existing NPO. US2 independently testable.

---

## Phase 5: User Story 3 — New Visitor Creates a User Account Only (Priority: P3)

**Goal**: A person who wants a FundrBolt account without registering an NPO can follow a clean, friendly multi-step sign-up flow at a public URL. They receive a welcome email on verification.

**Independent Test**: A tester opens `/register` (or `/sign-up`), completes account creation and email verification in simple steps, and arrives at the admin dashboard. They receive a professionally formatted welcome email. The existing flat sign-up page is replaced by the refactored wizard.

- [ ] T032 Add `send_welcome_email()` to `EmailService` (professionally formatted, sent after email verification for new accounts per FR-030) in `backend/app/services/email_service.py`
- [ ] T033 Trigger `send_welcome_email()` in the existing email verification handler after a user's email is confirmed in `backend/app/api/v1/auth.py`
- [ ] T034 Update `handleUnverifiedSignIn` logic (or auth error response handler) to return a resend-verification prompt rather than a generic access-denied error for unverified users attempting to sign in (FR-029) in `frontend/fundrbolt-admin/src/routes/(auth)/sign-in.tsx`
- [ ] T035 Refactor `sign-up.tsx` to compose `SignUpWizard`, `StepAccount`, and `StepVerifyEmail` (replacing the existing single-page form; reuses components from T020/T021) in `frontend/fundrbolt-admin/src/routes/(auth)/sign-up.tsx`
- [ ] T036 Add `user_signup` session type path to `OnboardingService` if not already covered — ensure `POST /sessions` with `session_type=user_signup` works without NPO steps in `backend/app/services/onboarding_service.py`

**Checkpoint**: A new visitor can sign up via a multi-step flow at the standalone sign-up URL, verify their email, receive a welcome email, and reach the dashboard. US3 independently testable alongside US1 and US2.

---

## Phase 6: User Story 4 — Admin Reviews and Approves/Rejects an NPO Application (Priority: P4)

**Goal**: A super admin can view pending NPO applications in a dedicated review queue, approve or reject them, re-open rejected applications for applicant revision, and see overdue applications visually flagged. All actions trigger professionally formatted applicant emails.

**Independent Test**: A tester acting as super-admin can: (a) find a pending NPO application in the admin queue, (b) approve it and confirm the applicant receives an approval email and gains NPO Admin role, (c) reject another with a reason and confirm rejection email, (d) re-open the rejected one and confirm the applicant receives a re-opened email. An application older than 5 business days shows an overdue indicator.

### Backend — Schema & Model Changes

- [ ] T037 Write Alembic migration `add_npo_application_reopened_status` — `ALTER TYPE npostatus ADD VALUE IF NOT EXISTS 'under_revision'` and `ALTER TYPE applicationstatus ADD VALUE IF NOT EXISTS 'reopened'` in `backend/alembic/versions/xxxx_add_npo_application_reopened_status.py`
- [ ] T038 [P] Add `UNDER_REVISION = "under_revision"` to `NPOStatus` enum in `backend/app/models/npo.py`
- [ ] T039 [P] Add `REOPENED = "reopened"` to `ApplicationStatus` enum in `backend/app/models/npo_application.py`
- [ ] T040 Run `alembic upgrade head` and confirm enum values exist in the database

### Backend — Service & Endpoints

- [ ] T041 Add `reopen_application()` method to the NPO service layer — validates current status is `REJECTED`, sets NPO status to `UNDER_REVISION`, sets application status to `REOPENED`, appends reopen action to `review_notes`, dispatches "reopened" email in `backend/app/services/npo_service.py`
- [ ] T042 Add `is_overdue` calculated property to NPO application response schema (`pending_since > 5 business days`) in `backend/app/schemas/npo_application.py`
- [ ] T043 Implement `POST /api/v1/npos/{npo_id}/applications/{application_id}/reopen` endpoint (SuperAdmin only, per contract `npo-application-admin-api.yaml`) in `backend/app/api/v1/npos.py`
- [ ] T044 Add `send_npo_application_reopened_email()` to `EmailService` (professionally formatted; informs applicant the application has been re-opened for revision per FR-021a) in `backend/app/services/email_service.py`

### Frontend — Admin Review Queue

- [ ] T045 Add "Reopen" action button to rejected NPO application row/detail view (enabled only for `REJECTED` status; dispatches reopen endpoint; shows confirmation dialog with reason input) in `frontend/fundrbolt-admin/src/features/npos/` (locate and update relevant NPO detail/list component)
- [ ] T046 Add overdue visual badge/indicator to NPO applications pending > 5 business days in the admin NPO list/review queue UI in `frontend/fundrbolt-admin/src/features/npos/` (locate and update relevant component)

**Checkpoint**: Full admin review workflow is functional. Super admins can approve, reject, and re-open applications. All applicant emails send correctly. Overdue applications are flagged. All 4 user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Tests, cleanup, and validation across all stories.

- [ ] T047 [P] Write integration tests for onboarding API (session create, step patch, submit, rate limits, expired session 404, CAPTCHA rejection, duplicate email) in `backend/app/tests/test_onboarding_api.py`
- [ ] T048 [P] Write unit tests for `OnboardingService` (state machine transitions, Turnstile helper, session expiry logic, near-duplicate NPO name check) in `backend/app/tests/test_onboarding_service.py`
- [ ] T049 Audit all 6 new/modified email templates for consistent FundrBolt branding, no placeholder text, and working links (FR-030): welcome, verification, NPO submission confirmation, admin notification, approval, rejection, re-opened in `backend/app/services/email_service.py`
- [ ] T050 [P] Add periodic session cleanup task (delete or mark expired `onboarding_sessions` older than 48 hours) in `backend/app/tasks/` or as an Alembic-scheduled SQL job
- [ ] T051 [P] Run backend CI checks: `cd backend && poetry run ruff check . && poetry run ruff format --check . && poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests' && poetry run pytest -v --tb=short`
- [ ] T052 [P] Run frontend CI checks: `cd frontend/fundrbolt-admin && pnpm lint && pnpm format:check && pnpm build`
- [ ] T053 Validate `quickstart.md` end-to-end on local dev — follow all test flows in `specs/034-npo-onboarding/quickstart.md` and confirm they work as documented

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user story phases**
- **US1 (Phase 3)**: Depends on Phase 2 — primary MVP increment
- **US2 (Phase 4)**: Depends on Phase 2; reuses components from US1 (T019–T028 must be complete)
- **US3 (Phase 5)**: Depends on Phase 2; reuses sign-up-wizard components from US1 (T019–T022 must be complete)
- **US4 (Phase 6)**: Depends on Phase 2; partially independent of US1–US3 (admin side); email additions depend on US1 email infrastructure (T016)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|-----------|-------------------|
| US1 (P1) | Phase 2 complete | US4 backend changes |
| US2 (P2) | Phase 2 + US1 frontend components (T019–T028) | US3, US4 |
| US3 (P3) | Phase 2 + US1 sign-up-wizard components (T019–T022) | US4 |
| US4 (P4) | Phase 2 + US1 email infrastructure (T016) | US2, US3 |

### Within Each User Story

- Backend service methods before API endpoints
- API endpoints before frontend API client
- Shared components (SignUpWizard, StepAccount, StepVerifyEmail) before wizard containers
- Wizard container before route registration

---

## Parallel Opportunities

### Phase 3 (US1) — launch these together after T010 is done
```
T013 GET session endpoint
T014 PATCH step endpoint
T018 TurnstileWidget component
T020 StepAccount component
T021 StepVerifyEmail component
T023 StepNpoProfile component
T024 StepFirstEvent component
T025 StepConfirmation component
```

### Phase 6 (US4) — launch these together
```
T038 NPOStatus enum addition
T039 ApplicationStatus enum addition
```

### Phase 7 (Polish) — launch these together after all stories complete
```
T047 Integration tests
T048 Unit tests
T050 Session cleanup task
T051 Backend CI checks
T052 Frontend CI checks
```

---

## Implementation Strategy

### MVP: User Story 1 Only (Phases 1–3)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T007) — **critical blocker**
3. Complete Phase 3: User Story 1 (T008–T028)
4. **STOP and VALIDATE**: Follow the US1 independent test — new visitor can register an NPO end-to-end
5. Deploy/demo if ready

### Incremental Delivery

| Step | Delivers |
|------|---------|
| Phases 1–3 | MVP: New visitor full NPO onboarding (**US1**) |
| + Phase 4 | Existing users can add an NPO skipping account steps (**US2**) |
| + Phase 5 | Clean multi-step user sign-up standalone flow (**US3**) |
| + Phase 6 | Admin review queue with approve / reject / reopen / overdue (**US4**) |
| + Phase 7 | Tests, email audit, session cleanup, CI green |

### Parallel Team Strategy (if staffed)

Once Phase 2 is complete:
- **Dev A**: US1 backend (T008–T016)
- **Dev B**: US1 frontend shared components (T017–T022)
- **Dev C**: US4 backend enum + service changes (T037–T044)

US1 frontend wizard components (T023–T028) begin after Dev B completes T019–T022.

---

## Summary

| Metric | Count |
|--------|-------|
| Total tasks | 53 |
| Phase 1 (Setup) | 3 |
| Phase 2 (Foundational) | 4 |
| Phase 3 (US1 — MVP) | 21 |
| Phase 4 (US2) | 3 |
| Phase 5 (US3) | 5 |
| Phase 6 (US4) | 10 |
| Phase 7 (Polish) | 7 |
| Parallelizable [P] tasks | 25 |
| MVP task count (Phases 1–3) | 28 |
