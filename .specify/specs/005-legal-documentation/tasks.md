# Tasks: Legal Documentation & Compliance

**Input**: Design documents from `.specify/specs/005-legal-documentation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-contracts.md, quickstart.md

**Tests**: Tests are NOT explicitly requested in the specification, so test tasks are EXCLUDED per instructions.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md: Web application with `backend/` and `frontend/fundrbolt-admin/` structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and database schema

- [ ] T001 Create database migration for legal compliance tables in backend/alembic/versions/[timestamp]_add_legal_compliance.py
- [ ] T002 [P] Create ENUM types (document_type, document_status, consent_method, consent_event_type) in migration
- [ ] T003 [P] Create legal_documents table with indexes in migration
- [ ] T004 [P] Create user_consents table with foreign keys in migration
- [ ] T005 [P] Create cookie_consents table with constraints in migration
- [ ] T006 [P] Create consent_audit_logs table with immutability trigger in migration
- [ ] T007 Run database migration: cd backend && poetry run alembic upgrade head
- [ ] T008 Create seed script for initial legal documents in backend/scripts/seed_legal_documents.py
- [ ] T009 Run seed script to create draft Terms of Service v1.0 and Privacy Policy v1.0

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core models, schemas, and services that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Backend Models

- [ ] T010 [P] Create LegalDocument model in backend/app/models/legal_document.py
- [ ] T011 [P] Create UserConsent model in backend/app/models/user_consent.py
- [ ] T012 [P] Create CookieConsent model in backend/app/models/cookie_consent.py
- [ ] T013 [P] Create ConsentAuditLog model in backend/app/models/consent_audit_log.py
- [ ] T014 Add model relationships (User.consents, etc.) in backend/app/models/user.py

### Backend Schemas (Pydantic)

- [ ] T015 [P] Create LegalDocument schemas in backend/app/schemas/legal_document.py (LegalDocumentCreate, LegalDocumentUpdate, LegalDocumentResponse)
- [ ] T016 [P] Create Consent schemas in backend/app/schemas/consent.py (ConsentAcceptRequest, ConsentStatusResponse, ConsentHistoryResponse)
- [ ] T017 [P] Create Cookie schemas in backend/app/schemas/cookie.py (CookieConsentCreate, CookieConsentUpdate, CookieConsentResponse)

### Backend Services

- [ ] T018 Create LegalService in backend/app/services/legal_service.py (create_document, publish_document, get_current_version, get_document_by_version)
- [ ] T019 Create ConsentService in backend/app/services/consent_service.py (accept_documents, get_consent_status, get_consent_history, create_audit_log)
- [ ] T020 Create CookieService in backend/app/services/cookie_service.py (set_consent, get_consent, update_consent, merge_anonymous_consent)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View and Accept Terms of Service (Priority: P1) 🎯 MVP

**Goal**: New users must review and accept Terms of Service during registration before account activation

**Independent Test**: Register a new account and verify TOS must be accepted before account activation. System logs timestamp, version, and user identifier.

### Backend Implementation for US1

- [ ] T021 [US1] Implement GET /api/v1/legal/documents/terms_of_service endpoint in backend/app/api/v1/legal.py
- [ ] T022 [US1] Implement POST /api/v1/consent/accept endpoint in backend/app/api/v1/consent.py (accept TOS during registration)
- [ ] T023 [US1] Implement GET /api/v1/consent/status endpoint in backend/app/api/v1/consent.py (check TOS acceptance status)
- [ ] T024 [US1] Add consent validation to registration endpoint in backend/app/api/v1/auth.py (require TOS acceptance)
- [ ] T025 [US1] Create ConsentCheckMiddleware in backend/app/middleware/consent_check.py (block access if TOS not accepted, return 409)
- [ ] T026 [US1] Register ConsentCheckMiddleware in backend/app/main.py with exempt routes

### Frontend Implementation for US1

- [ ] T027 [P] [US1] Create LegalDocument types in frontend/fundrbolt-admin/src/types/legal.ts
- [ ] T028 [P] [US1] Create Consent types in frontend/fundrbolt-admin/src/types/consent.ts
- [ ] T029 [P] [US1] Create legalService API client in frontend/fundrbolt-admin/src/services/legalService.ts (fetchDocument, fetchDocuments)
- [ ] T030 [P] [US1] Create consentService API client in frontend/fundrbolt-admin/src/services/consentService.ts (acceptConsent, getStatus, getHistory)
- [ ] T031 [US1] Create legalStore Zustand store in frontend/fundrbolt-admin/src/stores/legalStore.ts (documents state, loading state)
- [ ] T032 [P] [US1] Create useLegalDocuments hook in frontend/fundrbolt-admin/src/hooks/useLegalDocuments.ts
- [ ] T033 [P] [US1] Create useConsentCheck hook in frontend/fundrbolt-admin/src/hooks/useConsentCheck.ts
- [ ] T034 [US1] Create LegalDocumentViewer component in frontend/fundrbolt-admin/src/components/legal/LegalDocumentViewer.tsx (display markdown content, version, date)
- [ ] T035 [US1] Create TermsOfServiceModal component in frontend/fundrbolt-admin/src/components/legal/TermsOfServiceModal.tsx (modal with accept button)
- [ ] T036 [US1] Update Register.tsx to show TOS modal in frontend/fundrbolt-admin/src/pages/auth/Register.tsx (require acceptance before submit)
- [ ] T037 [US1] Add axios interceptor for 409 consent_required in frontend/fundrbolt-admin/src/services/api.ts (show consent modal on outdated)

**Checkpoint**: At this point, User Story 1 should be fully functional - new users must accept TOS during registration

---

## Phase 4: User Story 2 - View and Accept Privacy Policy (Priority: P1)

**Goal**: Users must review and accept Privacy Policy during registration with consent tracking and version management

**Independent Test**: Register a new account and verify Privacy Policy must be accepted alongside TOS. System logs consent timestamp, version, and scope.

### Backend Implementation for US2

- [ ] T038 [US2] Implement GET /api/v1/legal/documents/privacy_policy endpoint in backend/app/api/v1/legal.py
- [ ] T039 [US2] Update POST /api/v1/consent/accept to handle Privacy Policy in backend/app/api/v1/consent.py
- [ ] T040 [US2] Update ConsentCheckMiddleware to check Privacy Policy acceptance in backend/app/middleware/consent_check.py
- [ ] T041 [US2] Update registration endpoint to require Privacy Policy acceptance in backend/app/api/v1/auth.py

### Frontend Implementation for US2

- [ ] T042 [P] [US2] Create PrivacyPolicyModal component in frontend/fundrbolt-admin/src/components/legal/PrivacyPolicyModal.tsx
- [ ] T043 [US2] Update Register.tsx to show both TOS and Privacy Policy modals in frontend/fundrbolt-admin/src/pages/auth/Register.tsx
- [ ] T044 [US2] Update consent interceptor to handle both document types in frontend/fundrbolt-admin/src/services/api.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - new users accept TOS and Privacy Policy during registration

---

## Phase 5: User Story 3 - Cookie Consent Management (Priority: P1)

**Goal**: Display cookie consent popup on first visit with granular control (Essential, Analytics, Marketing) and enforce cookie blocking

**Independent Test**: Visit platform in new browser session and verify cookie consent popup appears before non-essential cookies are set. Preferences persist across sessions.

### Backend Implementation for US3

- [ ] T045 [US3] Implement GET /api/v1/cookies/consent endpoint in backend/app/api/v1/cookies.py (get consent for user or session)
- [ ] T046 [US3] Implement POST /api/v1/cookies/consent endpoint in backend/app/api/v1/cookies.py (set initial consent)
- [ ] T047 [US3] Implement PUT /api/v1/cookies/consent endpoint in backend/app/api/v1/cookies.py (update consent preferences)
- [ ] T048 [US3] Implement DELETE /api/v1/cookies/consent endpoint in backend/app/api/v1/cookies.py (revoke consent, default to reject)
- [ ] T049 [US3] Add Redis caching for cookie consent in backend/app/services/cookie_service.py (cache key: user:{user_id}:cookie_consent, TTL: 1 hour)
- [ ] T050 [US3] Add anonymous session handling in backend/app/services/cookie_service.py (accept X-Session-ID header)
- [ ] T051 [US3] Add consent merge on registration in backend/app/services/cookie_service.py (transfer anonymous consent to user_id)

### Frontend Implementation for US3

- [ ] T052 [P] [US3] Create Cookie types in frontend/fundrbolt-admin/src/types/cookie.ts
- [ ] T053 [P] [US3] Create cookieService API client in frontend/fundrbolt-admin/src/services/cookieService.ts (getConsent, setConsent, updateConsent, revokeConsent)
- [ ] T054 [US3] Create cookieStore Zustand store in frontend/fundrbolt-admin/src/stores/cookieStore.ts (consent state, session ID generation)
- [ ] T055 [P] [US3] Create useCookieConsent hook in frontend/fundrbolt-admin/src/hooks/useCookieConsent.ts
- [ ] T056 [P] [US3] Create cookieManager utility in frontend/fundrbolt-admin/src/utils/cookieManager.ts (localStorage operations, session ID generation)
- [ ] T057 [US3] Create CookieConsentBanner component in frontend/fundrbolt-admin/src/components/legal/CookieConsentBanner.tsx (modal with 3 categories, Accept All, Reject All, Customize)
- [ ] T058 [US3] Create CookiePreferences component in frontend/fundrbolt-admin/src/components/legal/CookiePreferences.tsx (settings page for changing preferences)
- [ ] T059 [US3] Add cookie consent banner to App root in frontend/fundrbolt-admin/src/App.tsx (show on first visit only)
- [ ] T060 [US3] Implement cookie blocking logic in frontend/fundrbolt-admin/src/utils/analytics.ts (only initialize GA if analytics_cookies=true)
- [ ] T061 [US3] Add consent check before loading marketing scripts in frontend/fundrbolt-admin/src/utils/marketing.ts

**Checkpoint**: Cookie consent popup works, preferences persist, and non-essential cookies are blocked without consent

---

## Phase 6: User Story 4 - Access Legal Documents Anytime (Priority: P2)

**Goal**: Users can view current and historical versions of legal documents from footer links without re-acceptance requirement

**Independent Test**: Log in as existing user, navigate to footer links, view Terms of Service and Privacy Policy with version history and effective dates

### Backend Implementation for US4

- [ ] T062 [US4] Implement GET /api/v1/legal/documents endpoint in backend/app/api/v1/legal.py (list all published documents)
- [ ] T063 [US4] Implement GET /api/v1/legal/documents/:type/version/:version endpoint in backend/app/api/v1/legal.py (get specific version)
- [ ] T064 [US4] Implement GET /api/v1/legal/documents/:type/versions endpoint in backend/app/api/v1/legal.py (list all versions of document type, admin only)
- [ ] T065 [US4] Add Redis caching for published documents in backend/app/services/legal_service.py (cache key: legal_doc:{type}:current, TTL: 1 hour)

### Frontend Implementation for US4

- [ ] T066 [P] [US4] Create TermsOfService page in frontend/fundrbolt-admin/src/pages/legal/TermsOfService.tsx (standalone page with full document)
- [ ] T067 [P] [US4] Create PrivacyPolicy page in frontend/fundrbolt-admin/src/pages/legal/PrivacyPolicy.tsx (standalone page with full document)
- [ ] T068 [US4] Create LegalFooter component in frontend/fundrbolt-admin/src/components/legal/LegalFooter.tsx (links to TOS and Privacy pages)
- [ ] T069 [US4] Update Footer component to include LegalFooter in frontend/fundrbolt-admin/src/components/layout/Footer.tsx
- [ ] T070 [US4] Add routes for /legal/terms and /legal/privacy in frontend/fundrbolt-admin/src/App.tsx

**Checkpoint**: Users can access legal documents from footer on all pages, view current versions without re-acceptance

---

## Phase 7: User Story 5 - View Consent History and Data Rights (Priority: P3)

**Goal**: Users can view consent history, request data export, request data deletion, and withdraw consent

**Independent Test**: Log in, navigate to privacy settings, view consent history showing all acceptances with dates/versions, request data export and deletion

### Backend Implementation for US5

- [ ] T071 [US5] Implement GET /api/v1/consent/history endpoint in backend/app/api/v1/consent.py (paginated consent history)
- [ ] T072 [US5] Implement POST /api/v1/consent/data-export endpoint in backend/app/api/v1/consent.py (enqueue async export job, return request_id)
- [ ] T073 [US5] Implement POST /api/v1/consent/data-deletion endpoint in backend/app/api/v1/consent.py (soft delete with 30-day grace period)
- [ ] T074 [US5] Implement POST /api/v1/consent/withdraw endpoint in backend/app/api/v1/consent.py (withdraw consent, trigger account deactivation)
- [ ] T075 [US5] Create data export service in backend/app/services/data_export_service.py (generate ZIP with JSON/CSV files)
- [ ] T076 [US5] Create data deletion service in backend/app/services/data_deletion_service.py (soft delete, anonymize after 30 days)
- [ ] T077 [US5] Add Celery task for async data export in backend/app/tasks/consent_tasks.py (generate export, email download link)
- [ ] T078 [US5] Add cron job for data anonymization in backend/app/tasks/consent_tasks.py (nightly check for deleted_at > 30 days)

### Frontend Implementation for US5

- [ ] T079 [P] [US5] Create ConsentHistory component in frontend/fundrbolt-admin/src/components/legal/ConsentHistory.tsx (table with pagination)
- [ ] T080 [P] [US5] Create DataRightsForm component in frontend/fundrbolt-admin/src/components/legal/DataRightsForm.tsx (export/delete request buttons)
- [ ] T081 [US5] Create ConsentSettings page in frontend/fundrbolt-admin/src/pages/legal/ConsentSettings.tsx (history + data rights)
- [ ] T082 [US5] Add link to Consent Settings in user account menu in frontend/fundrbolt-admin/src/components/layout/Header.tsx
- [ ] T083 [US5] Add route for /settings/consent in frontend/fundrbolt-admin/src/App.tsx

**Checkpoint**: All user stories complete - full GDPR compliance with consent history and data rights

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Admin functionality, optimization, and documentation

### Admin Functionality

- [ ] T084 [P] Implement POST /api/v1/legal/documents endpoint in backend/app/api/v1/legal.py (create draft document, admin only)
- [ ] T085 [P] Implement PATCH /api/v1/legal/documents/:id endpoint in backend/app/api/v1/legal.py (update draft document, admin only)
- [ ] T086 [P] Implement POST /api/v1/legal/documents/:id/publish endpoint in backend/app/api/v1/legal.py (publish draft, archive old version, admin only)
- [ ] T087 Add role check middleware for admin endpoints in backend/app/middleware/consent_check.py

### Optimization & Performance

- [ ] T088 [P] Add database indexes verification in backend/alembic/versions/[timestamp]_add_legal_compliance.py
- [ ] T089 [P] Add Redis cache warming for legal documents on app startup in backend/app/main.py
- [ ] T090 [P] Optimize consent status query with JOIN optimization in backend/app/services/consent_service.py
- [ ] T091 [P] Add frontend lazy loading for legal document pages in frontend/fundrbolt-admin/src/App.tsx

### Documentation & Validation

- [ ] T092 [P] Update backend README with legal endpoints in backend/README.md
- [ ] T093 [P] Update frontend README with legal components in frontend/fundrbolt-admin/README.md
- [ ] T094 Add OpenAPI documentation for legal endpoints in backend/app/main.py
- [ ] T095 Run quickstart.md validation following .specify/specs/005-legal-documentation/quickstart.md

### Security & Compliance

- [ ] T096 [P] Verify audit log immutability trigger in database
- [ ] T097 [P] Verify 7-year retention policy configuration
- [ ] T098 [P] Test cookie blocking for non-consented categories
- [ ] T099 [P] Verify GDPR data export includes all required data
- [ ] T100 [P] Test consent middleware blocks outdated users correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (P1), US2 (P1), US3 (P1) can proceed in parallel after Phase 2
  - US4 (P2) depends on US1 and US2 (needs legal documents infrastructure)
  - US5 (P3) depends on US1, US2, US3 (needs consent tracking infrastructure)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories ✅
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories ✅
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories ✅
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1/US2 but independently testable
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - Uses infrastructure from US1/US2/US3 but independently testable

### Within Each User Story

- Backend endpoints before frontend integration
- Models and services (from Foundational) already complete
- API clients before components
- Zustand stores before components that use them
- Components before page integration
- Core implementation before optimization

### Parallel Opportunities

- **Phase 1 (Setup)**: T002-T006 (database tables) can run in parallel
- **Phase 2 (Foundational)**: T010-T013 (models), T015-T017 (schemas) can run in parallel
- **Phase 3 (US1)**: T027-T028 (types), T029-T030 (services), T032-T033 (hooks), T034-T035 (components) can run in parallel within their groups
- **Phase 4 (US2)**: T042 (modal) can run parallel with T043-T044 (integration)
- **Phase 5 (US3)**: T052-T053 (types/service), T055-T056 (hook/utils), T057-T058 (components) can run in parallel within their groups
- **Phase 6 (US4)**: T066-T067 (pages), T062-T065 (backend endpoints with caching) can run in parallel
- **Phase 7 (US5)**: T079-T080 (components), T071-T078 (backend endpoints) can run in parallel
- **Phase 8 (Polish)**: T084-T086 (admin endpoints), T088-T091 (optimization), T092-T094 (docs), T096-T100 (security) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all backend endpoints for User Story 1 together:
Task T021: "GET /api/v1/legal/documents/terms_of_service endpoint"
Task T022: "POST /api/v1/consent/accept endpoint"
Task T023: "GET /api/v1/consent/status endpoint"

# Launch all frontend types/services for User Story 1 together:
Task T027: "LegalDocument types"
Task T028: "Consent types"
Task T029: "legalService API client"
Task T030: "consentService API client"

# Launch all frontend hooks for User Story 1 together:
Task T032: "useLegalDocuments hook"
Task T033: "useConsentCheck hook"

# Launch all frontend components for User Story 1 together:
Task T034: "LegalDocumentViewer component"
Task T035: "TermsOfServiceModal component"
```

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch all models together:
Task T010: "LegalDocument model"
Task T011: "UserConsent model"
Task T012: "CookieConsent model"
Task T013: "ConsentAuditLog model"

# Launch all schemas together:
Task T015: "LegalDocument schemas"
Task T016: "Consent schemas"
Task T017: "Cookie schemas"

# Services run sequentially (depend on models/schemas):
Task T018: "LegalService"
Task T019: "ConsentService"
Task T020: "CookieService"
```

---

## Implementation Strategy

### MVP First (User Stories 1, 2, 3 - P1 Priority)

1. Complete Phase 1: Setup (database schema)
2. Complete Phase 2: Foundational (models, schemas, services) - **CRITICAL BLOCKER**
3. Complete Phase 3: User Story 1 (TOS acceptance)
4. Complete Phase 4: User Story 2 (Privacy Policy acceptance)
5. Complete Phase 5: User Story 3 (Cookie consent)
6. **STOP and VALIDATE**: Test P1 stories independently
7. Deploy MVP with basic legal compliance

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (T001-T020)
2. Add User Story 1 → Test independently → MVP-1 (T021-T037)
3. Add User Story 2 → Test independently → MVP-2 (T038-T044)
4. Add User Story 3 → Test independently → MVP-3 (T045-T061) **Production Ready**
5. Add User Story 4 → Test independently → Enhanced (T062-T070)
6. Add User Story 5 → Test independently → Full GDPR Compliance (T071-T083)
7. Polish and optimize → Final Release (T084-T100)

### Parallel Team Strategy

With multiple developers:

1. **Team completes Setup + Foundational together** (T001-T020) - **MUST COMPLETE FIRST**
2. **Once Foundational is done, split into parallel tracks**:
   - **Developer A**: User Story 1 (TOS) - T021-T037
   - **Developer B**: User Story 2 (Privacy) - T038-T044
   - **Developer C**: User Story 3 (Cookies) - T045-T061
3. **After P1 stories complete**:
   - **Developer A**: User Story 4 (Document Access) - T062-T070
   - **Developer B**: User Story 5 (Data Rights) - T071-T083
   - **Developer C**: Polish & Admin - T084-T100

### Recommended MVP Scope

**Minimum Viable Product** = Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5

This delivers:
- Terms of Service acceptance during registration ✅
- Privacy Policy acceptance during registration ✅
- Cookie consent popup with blocking ✅
- Basic GDPR compliance ✅
- ~61 tasks, estimated 2-3 weeks

**Extended MVP** = Add Phase 6 (Document Access)

- Footer links to legal documents ✅
- View documents without re-acceptance ✅
- ~70 tasks, estimated 3 weeks

**Full Feature** = All phases (1-8)

- Complete GDPR compliance with data rights ✅
- Admin document management ✅
- Full optimization and security ✅
- ~100 tasks, estimated 4-5 weeks

---

## Task Count Summary

- **Phase 1 (Setup)**: 9 tasks
- **Phase 2 (Foundational)**: 11 tasks (BLOCKING)
- **Phase 3 (US1 - TOS)**: 17 tasks
- **Phase 4 (US2 - Privacy)**: 7 tasks
- **Phase 5 (US3 - Cookies)**: 17 tasks
- **Phase 6 (US4 - Access)**: 9 tasks
- **Phase 7 (US5 - Data Rights)**: 13 tasks
- **Phase 8 (Polish)**: 17 tasks

**Total**: 100 tasks

**Parallel Opportunities**: 37 tasks marked [P] can run in parallel with other tasks

**MVP Tasks** (Phase 1-5): 61 tasks
**Extended MVP** (Phase 1-6): 70 tasks
**Full Feature** (Phase 1-8): 100 tasks

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [US#] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Phase 2 (Foundational) is CRITICAL - blocks ALL user story work
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All file paths are absolute and match plan.md structure
- Tests were NOT requested in specification, so test tasks are excluded
- Focus on implementation → manual testing → iteration based on spec acceptance scenarios
