# Tasks: Social Login for Donor and Admin PWAs

**Input**: Design documents from `/home/jjeanes/dev/fundrbolt-platform/.specify/specs/030-social-login-i/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are included because this is a security/privacy-sensitive authentication feature with explicit contract and validation scenarios.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared auth/social configuration and frontend plumbing used by all stories.

- [ ] T001 Add social provider and callback environment settings to /home/jjeanes/dev/fundrbolt-platform/backend/.env.example
- [ ] T002 [P] Add social auth provider settings and validation to /home/jjeanes/dev/fundrbolt-platform/backend/app/core/config.py
- [ ] T003 [P] Add shared social auth request/response types to /home/jjeanes/dev/fundrbolt-platform/frontend/shared/src/types/auth.ts
- [ ] T004 [P] Add donor social auth API client helpers to /home/jjeanes/dev/fundrbolt-platform/frontend/donor-pwa/src/lib/api-client.ts
- [ ] T005 [P] Add admin social auth API client helpers to /home/jjeanes/dev/fundrbolt-platform/frontend/fundrbolt-admin/src/lib/api-client.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend domain and API scaffolding required before any user story implementation.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T006 Create social auth entities migration in /home/jjeanes/dev/fundrbolt-platform/backend/alembic/versions/030_social_auth_entities.py
- [ ] T007 [P] Create social identity link model in /home/jjeanes/dev/fundrbolt-platform/backend/app/models/social_identity_link.py
- [ ] T008 [P] Create social auth attempt model in /home/jjeanes/dev/fundrbolt-platform/backend/app/models/social_auth_attempt.py
- [ ] T009 [P] Create social auth challenge models in /home/jjeanes/dev/fundrbolt-platform/backend/app/models/social_auth_challenge.py
- [ ] T010 Register new social auth models in /home/jjeanes/dev/fundrbolt-platform/backend/app/models/__init__.py
- [ ] T011 Add social auth schemas (provider/start/callback/pending/success) to /home/jjeanes/dev/fundrbolt-platform/backend/app/schemas/auth.py
- [ ] T012 Implement base social auth service scaffolding in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/social_auth_service.py
- [ ] T013 Wire social auth endpoint skeletons in /home/jjeanes/dev/fundrbolt-platform/backend/app/api/v1/auth.py

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Sign in with a social account (Priority: P1) 🎯 MVP

**Goal**: Donor and admin users can sign in with Apple, Google, Facebook, or Microsoft as an alternative to email login.

**Independent Test**: From each sign-in page, authenticate with a supported provider and verify donor/admin routing behavior with email login still available.

### Tests for User Story 1

- [ ] T014 [P] [US1] Add contract test for GET /auth/social/providers in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/contract/test_social_auth_providers.py
- [ ] T015 [P] [US1] Add contract test for POST /auth/social/{provider}/start in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/contract/test_social_auth_start.py
- [ ] T016 [P] [US1] Add contract test for POST /auth/social/{provider}/callback success/pending branches in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/contract/test_social_auth_callback.py
- [ ] T017 [P] [US1] Add integration test for donor/admin social sign-in baseline flow in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/integration/test_social_auth_flow.py
- [ ] T018 [P] [US1] Add contract regression test confirming email/password login remains available in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/contract/test_auth_login.py
- [ ] T019 [P] [US1] Add integration regression test for email login alongside social login in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/integration/test_auth_flow.py

### Implementation for User Story 1

- [ ] T020 [US1] Implement provider listing and enablement checks in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/social_auth_service.py
- [ ] T021 [US1] Implement social auth start/callback orchestration in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/social_auth_service.py
- [ ] T022 [US1] Implement provider, start, and callback endpoints in /home/jjeanes/dev/fundrbolt-platform/backend/app/api/v1/auth.py
- [ ] T023 [US1] Add donor social login UI actions to /home/jjeanes/dev/fundrbolt-platform/frontend/donor-pwa/src/routes/(auth)/sign-in.tsx
- [ ] T024 [US1] Add admin social login UI actions to /home/jjeanes/dev/fundrbolt-platform/frontend/fundrbolt-admin/src/routes/(auth)/sign-in.tsx
- [ ] T025 [P] [US1] Add donor auth store handling for social login lifecycle in /home/jjeanes/dev/fundrbolt-platform/frontend/donor-pwa/src/stores/auth-store.ts
- [ ] T026 [P] [US1] Add admin auth store handling for social login lifecycle in /home/jjeanes/dev/fundrbolt-platform/frontend/fundrbolt-admin/src/stores/auth-store.ts
- [ ] T027 [US1] Add donor sign-in page regression path for email login fallback in /home/jjeanes/dev/fundrbolt-platform/frontend/donor-pwa/src/routes/(auth)/sign-in.tsx
- [ ] T028 [US1] Add admin sign-in page regression path for email login fallback in /home/jjeanes/dev/fundrbolt-platform/frontend/fundrbolt-admin/src/routes/(auth)/sign-in.tsx

**Checkpoint**: US1 is independently functional and testable.

---

## Phase 4: User Story 2 - Link and reuse existing accounts (Priority: P2)

**Goal**: Existing accounts are safely linked/reused, donor auto-provisioning works, admin pre-provisioning is enforced, and verified email is required.

**Independent Test**: Validate link confirmation for existing unlinked account, donor auto-create for unmatched identities, admin deny for unmatched admin identities, and email verification gate behavior.

### Tests for User Story 2

- [ ] T029 [P] [US2] Add contract test for POST /auth/social/link-confirmation in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/contract/test_social_auth_link_confirmation.py
- [ ] T030 [P] [US2] Add contract test for POST /auth/social/email-verification in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/contract/test_social_auth_email_verification.py
- [ ] T031 [P] [US2] Add integration test for link confirmation and account mapping rules in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/integration/test_social_auth_linking.py
- [ ] T032 [P] [US2] Add integration test for donor auto-create and admin pre-provisioning denial in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/integration/test_social_auth_provisioning.py
- [ ] T033 [P] [US2] Add unit test for provider claim minimization/whitelisting in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/unit/test_social_auth_minimization.py

### Implementation for User Story 2

- [ ] T034 [US2] Implement first-time existing-account link confirmation workflow in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/social_auth_service.py
- [ ] T035 [US2] Implement verified-email gating and in-app email challenge workflow in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/social_auth_service.py
- [ ] T036 [US2] Implement donor auto-provisioning and admin pre-provisioning enforcement in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/social_auth_service.py
- [ ] T037 [US2] Implement link-confirmation and email-verification endpoints in /home/jjeanes/dev/fundrbolt-platform/backend/app/api/v1/auth.py
- [ ] T038 [US2] Add donor UI for pending link/email verification states in /home/jjeanes/dev/fundrbolt-platform/frontend/donor-pwa/src/routes/(auth)/sign-in.tsx
- [ ] T039 [US2] Add admin UI messaging for pre-provisioning denial and recovery path in /home/jjeanes/dev/fundrbolt-platform/frontend/fundrbolt-admin/src/routes/(auth)/sign-in.tsx
- [ ] T040 [US2] Update auth schemas for pending reasons and challenge payloads in /home/jjeanes/dev/fundrbolt-platform/backend/app/schemas/auth.py
- [ ] T041 [US2] Implement provider-claim minimization whitelist and persistence policy in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/social_auth_service.py

**Checkpoint**: US2 is independently functional and testable.

---

## Phase 5: User Story 3 - Handle failures clearly and safely (Priority: P3)

**Goal**: Users receive clear fallback paths on social auth errors while system enforces admin step-up and privacy-safe observability.

**Independent Test**: Cancel consent, trigger provider failure, fail admin step-up, and verify fallback messaging plus redacted audit/error logs.

### Tests for User Story 3

- [ ] T042 [P] [US3] Add contract test for POST /auth/social/admin-step-up in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/contract/test_social_auth_admin_step_up.py
- [ ] T043 [P] [US3] Add integration test for cancellation/provider-failure fallback behavior in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/integration/test_social_auth_failures.py
- [ ] T044 [P] [US3] Add unit test for social-auth log redaction policy in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/unit/test_social_auth_redaction.py

### Implementation for User Story 3

- [ ] T045 [US3] Implement admin step-up challenge lifecycle in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/social_auth_service.py
- [ ] T046 [US3] Implement admin step-up completion endpoint in /home/jjeanes/dev/fundrbolt-platform/backend/app/api/v1/auth.py
- [ ] T047 [US3] Implement social auth failure mapping and user-safe error responses in /home/jjeanes/dev/fundrbolt-platform/backend/app/api/v1/auth.py
- [ ] T048 [US3] Implement social auth audit events and masked metadata logging in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/audit_service.py
- [ ] T049 [US3] Add donor social auth error-state UX and retry options in /home/jjeanes/dev/fundrbolt-platform/frontend/donor-pwa/src/routes/(auth)/sign-in.tsx
- [ ] T050 [US3] Add admin social auth step-up and failure UX states in /home/jjeanes/dev/fundrbolt-platform/frontend/fundrbolt-admin/src/routes/(auth)/sign-in.tsx
- [ ] T051 [US3] Add reusable social auth error normalization helper in /home/jjeanes/dev/fundrbolt-platform/frontend/shared/src/utils/social-auth-errors.ts
- [ ] T052 [US3] Add in-flow social identity processing notice with legal links on donor sign-in in /home/jjeanes/dev/fundrbolt-platform/frontend/donor-pwa/src/routes/(auth)/sign-in.tsx
- [ ] T053 [US3] Add in-flow social identity processing notice with legal links on admin sign-in in /home/jjeanes/dev/fundrbolt-platform/frontend/fundrbolt-admin/src/routes/(auth)/sign-in.tsx

**Checkpoint**: US3 is independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, docs, privacy controls, and end-to-end validation across all stories.

- [ ] T054 [P] Add social auth contract documentation to /home/jjeanes/dev/fundrbolt-platform/backend/README.md
- [ ] T055 [P] Add social identity processing notice text to /home/jjeanes/dev/fundrbolt-platform/frontend/donor-pwa/src/routes/(auth)/privacy-policy.tsx
- [ ] T056 [P] Add social identity processing notice text to /home/jjeanes/dev/fundrbolt-platform/frontend/fundrbolt-admin/src/routes/(auth)/privacy-policy.tsx
- [ ] T057 Implement social-auth retention/deletion policy hooks in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/consent_service.py
- [ ] T058 Implement redaction guardrails for auth error logging in /home/jjeanes/dev/fundrbolt-platform/backend/app/core/logging.py
- [ ] T059 Sync final endpoint definitions and examples in /home/jjeanes/dev/fundrbolt-platform/.specify/specs/030-social-login-i/contracts/social-auth.openapi.yaml
- [ ] T060 Execute and record quickstart validation evidence in /home/jjeanes/dev/fundrbolt-platform/.specify/specs/030-social-login-i/quickstart.md
- [ ] T061 Implement social-auth success/failure/timing metrics instrumentation and reporting hooks in /home/jjeanes/dev/fundrbolt-platform/backend/app/services/social_auth_service.py
- [ ] T062 Define release validation queries for SC-001 to SC-005 in /home/jjeanes/dev/fundrbolt-platform/.specify/specs/030-social-login-i/quickstart.md
- [ ] T063 Add explicit out-of-scope guard test ensuring no provider management endpoints are added in /home/jjeanes/dev/fundrbolt-platform/backend/app/tests/contract/test_social_auth_scope_guard.py
- [ ] T064 Validate SC-001 through SC-005 thresholds and record release go/no-go decision in /home/jjeanes/dev/fundrbolt-platform/.specify/specs/030-social-login-i/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies; start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2 completion.
- **Phase 4 (US2)**: Depends on Phase 2 completion; integrates with US1 auth flow outputs.
- **Phase 5 (US3)**: Depends on Phase 2 completion; integrates with US1/US2 service behavior.
- **Phase 6 (Polish)**: Depends on completion of all selected user stories.

### User Story Dependency Graph

- **US1 (P1)**: Independent after foundational phase; delivers MVP social sign-in.
- **US2 (P2)**: Builds on social auth flow primitives from US1 for secure linking/provisioning.
- **US3 (P3)**: Builds on US1/US2 flow outcomes for failure handling, step-up, and privacy-safe observability.

Recommended completion order: **US1 → US2 → US3**.

### Within Each User Story

- Tests first (contract/integration/unit), confirm failing baseline.
- Backend service logic before endpoint finalization.
- Frontend UI/state integration after backend behavior is stable.
- Story checkpoint validation before proceeding.

---

## Parallel Execution Examples

### User Story 1

Run in parallel after T013:
- T014, T015, T016, T017
- T023 and T024

### User Story 2

Run in parallel after T037:
- T029, T030, T031, T032, T033
- T038 and T039

### User Story 3

Run in parallel after T047:
- T042, T043, T044
- T049 and T050

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate US1 independent test criteria.
4. Demo/deploy MVP social sign-in.

### Incremental Delivery

1. Deliver US1 (provider social sign-in in both PWAs).
2. Deliver US2 (safe linking, verified-email gate, provisioning boundaries).
3. Deliver US3 (clear failure UX, admin step-up enforcement, redaction-safe observability).
4. Complete Phase 6 privacy/compliance polish and quickstart validation.

### Parallel Team Strategy

1. Team completes Phase 1 and 2 together.
2. One stream handles backend service/contracts while another handles donor/admin sign-in UX.
3. Merge by story checkpoint boundaries to keep each increment independently testable.

---

## Notes

- `[P]` tasks are safe for parallel execution on different files.
- `[US1]`, `[US2]`, `[US3]` labels ensure story-level traceability.
- Avoid introducing provider-management settings in this feature (explicitly out of scope).
- Preserve data minimization, redaction, and retention/deletion controls throughout implementation.
