# Implementation Plan: Legal Documentation & Compliance

**Branch**: `005-legal-documentation` | **Date**: 2025-10-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `.specify/specs/005-legal-documentation/spec.md`

## Summary

This feature adds legal compliance infrastructure to the Fundrbolt platform: Terms of Service, Privacy Policy, and Cookie Consent management. The system will enforce acceptance of legal documents during registration, track consent history with audit trails for GDPR compliance, and provide granular cookie consent controls. Implementation includes backend API endpoints for document management and consent tracking, frontend components for document display and consent UI, and database models for versioned legal documents with immutable consent audit logs.

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript (Frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy, Pydantic (backend); React, Zustand, TypeScript (frontend)
**Storage**: PostgreSQL for legal documents, consent records, and audit logs; Redis for cookie consent caching
**Testing**: pytest (backend contract, integration, unit tests); Playwright (frontend E2E tests)
**Target Platform**: Azure App Service (backend), Azure Static Web Apps (frontend)
**Project Type**: Web application (backend + frontend monorepo)
**Performance Goals**: Legal document load <3s, cookie popup render <2s, consent recording <500ms
**Constraints**: GDPR compliance (7-year audit retention), immutable consent logs, 100% blocking for non-essential cookies without consent
**Scale/Scope**: 4 new database tables, 15+ API endpoints, 8+ React components, 31 functional requirements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Security & Compliance Gates

✅ **Data Protection (FR-015)**: 7-year audit retention for privacy consents meets constitution requirement ("transaction records 7 years for audit")

✅ **Privacy & Compliance**: GDPR data rights (FR-030, FR-031) align with constitution mandate for "right to access (data export API), right to deletion"

✅ **Consent Tracking**: FR-003, FR-010, FR-025 require logging timestamp of user agreement, matching constitution requirement

✅ **Audit Logging**: Consent Audit Log entity provides "immutable `audit_log` table for all sensitive actions" as required

### Architecture & Quality Gates

✅ **Type Safety**: Will use Pydantic models for all API requests/responses and SQLAlchemy models with type hints

✅ **Testing Requirements**: Contract tests for API endpoints, integration tests for consent flows, unit tests for validation logic

✅ **No Scope Creep**: Implementation will follow YAGNI principle - only building specified requirements (31 FRs), no anticipatory features

✅ **Multi-Tenancy**: Legal documents and consents will include appropriate tenant isolation (considering NPO context from existing user model)

### Performance Gates

✅ **Performance SLOs**: Success criteria (SC-002: 2s popup load, SC-004: 3s document load) meet constitution's "<300ms API p95" for backend calls

✅ **Caching Strategy**: Cookie consent will use Redis with appropriate TTL (FR-022: 12 months), legal documents cached with invalidation on version update

### Development Workflow Gates

✅ **Feature Flags**: Cookie consent categories and document version checks can use existing feature flag infrastructure if needed for rollout

✅ **Backward Compatibility**: New endpoints follow `/api/v1/` versioning, no breaking changes to existing auth/user APIs

**Gate Status**: ✅ PASSED - All constitution requirements satisfied. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
.specify/specs/005-legal-documentation/
├── plan.md              # This file
├── research.md          # Phase 0 output (next step)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
├── checklists/
│   └── requirements.md  # Already created during specification
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── models/
│   │   ├── legal_document.py        # NEW: LegalDocument model
│   │   ├── user_consent.py          # NEW: UserConsent model
│   │   ├── cookie_consent.py        # NEW: CookieConsent model
│   │   └── consent_audit_log.py     # NEW: ConsentAuditLog model
│   ├── schemas/
│   │   ├── legal_document.py        # NEW: Pydantic schemas for documents
│   │   ├── consent.py               # NEW: Pydantic schemas for consent
│   │   └── cookie.py                # NEW: Pydantic schemas for cookies
│   ├── api/
│   │   └── v1/
│   │       ├── legal.py             # NEW: Legal document endpoints
│   │       ├── consent.py           # NEW: Consent management endpoints
│   │       └── cookies.py           # NEW: Cookie consent endpoints
│   ├── services/
│   │   ├── legal_service.py         # NEW: Legal document business logic
│   │   ├── consent_service.py       # NEW: Consent tracking service
│   │   └── cookie_service.py        # NEW: Cookie consent service
│   ├── middleware/
│   │   └── consent_check.py         # NEW: Middleware to enforce legal acceptance
│   └── tests/
│       ├── contract/
│       │   ├── test_legal_api.py    # NEW: API contract tests
│       │   ├── test_consent_api.py  # NEW: Consent API tests
│       │   └── test_cookie_api.py   # NEW: Cookie API tests
│       ├── integration/
│       │   ├── test_legal_flow.py   # NEW: End-to-end legal acceptance
│       │   ├── test_consent_tracking.py # NEW: Consent audit trails
│       │   └── test_cookie_enforcement.py # NEW: Cookie blocking tests
│       └── unit/
│           ├── test_legal_service.py # NEW: Legal service unit tests
│           ├── test_consent_service.py # NEW: Consent service tests
│           └── test_cookie_service.py # NEW: Cookie service tests
└── alembic/
    └── versions/
        └── [timestamp]_add_legal_compliance.py  # NEW: Migration script

frontend/fundrbolt-admin/
├── src/
│   ├── components/
│   │   ├── legal/
│   │   │   ├── LegalDocumentViewer.tsx      # NEW: Document display component
│   │   │   ├── TermsOfServiceModal.tsx      # NEW: TOS acceptance modal
│   │   │   ├── PrivacyPolicyModal.tsx       # NEW: Privacy acceptance modal
│   │   │   ├── CookieConsentBanner.tsx      # NEW: Cookie consent popup
│   │   │   ├── CookiePreferences.tsx        # NEW: Cookie customization UI
│   │   │   ├── ConsentHistory.tsx           # NEW: User consent history view
│   │   │   └── LegalFooter.tsx              # NEW: Footer with legal links
│   │   └── layout/
│   │       └── Footer.tsx                   # MODIFY: Add legal links
│   ├── pages/
│   │   ├── legal/
│   │   │   ├── TermsOfService.tsx           # NEW: TOS page
│   │   │   ├── PrivacyPolicy.tsx            # NEW: Privacy Policy page
│   │   │   └── ConsentSettings.tsx          # NEW: User consent management
│   │   └── auth/
│   │       └── Register.tsx                 # MODIFY: Add legal acceptance
│   ├── services/
│   │   ├── legalService.ts                  # NEW: Legal document API calls
│   │   ├── consentService.ts                # NEW: Consent tracking API
│   │   └── cookieService.ts                 # NEW: Cookie consent API
│   ├── stores/
│   │   ├── legalStore.ts                    # NEW: Zustand store for legal docs
│   │   └── cookieStore.ts                   # NEW: Zustand store for cookies
│   ├── hooks/
│   │   ├── useLegalDocuments.ts             # NEW: Hook for legal documents
│   │   ├── useConsentCheck.ts               # NEW: Hook for consent status
│   │   └── useCookieConsent.ts              # NEW: Hook for cookie management
│   ├── utils/
│   │   └── cookieManager.ts                 # NEW: Browser cookie utilities
│   └── types/
│       ├── legal.ts                         # NEW: TypeScript types for legal
│       ├── consent.ts                       # NEW: TypeScript types for consent
│       └── cookie.ts                        # NEW: TypeScript types for cookies
└── tests/
    └── e2e/
        ├── legal-acceptance.spec.ts         # NEW: E2E legal acceptance flow
        ├── cookie-consent.spec.ts           # NEW: E2E cookie consent flow
        └── consent-history.spec.ts          # NEW: E2E consent management
```

**Structure Decision**: Following existing Fundrbolt monorepo pattern with clear backend/frontend separation. Backend uses FastAPI with layered architecture (models → services → API), frontend uses React with Zustand for state management. This matches the existing authentication feature structure (001-user-authentication-role) and maintains consistency with the codebase.

## Complexity Tracking

**Status**: No violations - Constitution Check passed cleanly

This feature operates within established patterns:

- Uses existing auth infrastructure (JWT, sessions, user model)
- Follows standard CRUD + audit patterns for legal documents
- Implements well-defined regulatory requirements (GDPR, EU Cookie Law)
- No novel architectural patterns or risky dependencies
- Complexity managed through phased delivery (P1 core → P2 access → P3 data rights)
