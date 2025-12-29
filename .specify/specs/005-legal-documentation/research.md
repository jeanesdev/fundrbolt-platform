# Research & Technical Decisions: Legal Documentation & Compliance

**Feature**: 005-legal-documentation
**Date**: 2025-10-28
**Purpose**: Resolve technical unknowns and document technology choices for legal compliance implementation

## Research Areas

### 1. Legal Document Versioning Strategy

**Decision**: Semantic versioning (major.minor) with immutable published versions

**Rationale**:
- Major version change (2.0 → 3.0) requires user re-acceptance
- Minor version change (2.0 → 2.1) for non-material updates (typos, clarifications) - no re-acceptance needed
- Immutability ensures audit trail integrity (GDPR Article 7 requirement for proof of consent)
- Version comparison logic simple: compare major version to determine if re-acceptance needed

**Alternatives Considered**:
- **Date-based versioning (2025-10-28)**: Rejected because difficult to determine materiality of changes programmatically
- **Hash-based versioning (SHA256)**: Rejected because not human-readable and no semantic meaning
- **Incremental integers (v1, v2, v3)**: Rejected because no way to distinguish material vs non-material changes

**Implementation Details**:
- Store version as `VARCHAR(20)` in format "1.0", "2.0", "2.1"
- `status` field: "draft" | "published" | "archived"
- Published versions are immutable (enforce in application logic)
- Draft versions can be edited until published
- When publishing new version, check if major version changed → trigger re-acceptance flow

---

### 2. Cookie Consent Storage Mechanism

**Decision**: Hybrid approach - Browser localStorage for anonymous users + PostgreSQL for authenticated users + Redis for performance

**Rationale**:
- Anonymous users (pre-registration): Store consent in localStorage with 12-month expiry, sync to server on registration
- Authenticated users: Store in PostgreSQL `cookie_consent` table for persistence across devices
- Redis cache: Cache consent status per user session to avoid DB lookup on every request
- Meets GDPR requirement for consent portability and audit trail

**Alternatives Considered**:
- **Cookies only**: Rejected due to size limits (4KB) and difficulty tracking consent history
- **PostgreSQL only**: Rejected because doesn't handle anonymous users or cross-device sync well
- **Redis only**: Rejected because lacks durability for audit compliance

**Implementation Details**:
- Frontend: `localStorage.setItem('fundrbolt_cookie_consent', JSON.stringify({...}))` with 12-month timestamp
- On registration/login: Read localStorage, call POST `/api/v1/cookies/consent`, clear localStorage entry
- Backend: Check Redis cache first (`user:{user_id}:cookie_consent`), fallback to PostgreSQL
- Cache TTL: 1 hour (balance between performance and consistency)
- Cookie enforcement: Middleware checks consent before setting non-essential cookies

---

### 3. Database Schema for Consent Audit Trail

**Decision**: Separate immutable `consent_audit_log` table with JSON metadata column

**Rationale**:
- Immutability requirement for regulatory compliance (GDPR, CCPA)
- Separate table prevents accidental updates to audit records
- JSON metadata column allows flexible storage of context (IP, user agent, referrer, etc.) without schema changes
- PostgreSQL JSONB provides indexing and query capabilities

**Alternatives Considered**:
- **Single table with soft deletes**: Rejected because audit trail should never be deleted, even soft deleted
- **Embedding audit in consent table**: Rejected because violates immutability (table allows updates)
- **External audit service**: Rejected for MVP complexity (adds deployment overhead)

**Implementation Details**:
- `consent_audit_log` table: `id`, `user_id`, `event_type` (accept/withdraw/update), `document_type`, `document_version`, `timestamp`, `ip_address`, `user_agent`, `metadata` (JSONB)
- Use database triggers or application-level hooks to prevent updates/deletes
- Retention: 7 years minimum (matches constitution and legal requirements)
- Indexes: `user_id`, `document_type`, `timestamp` for efficient querying

---

### 4. Cookie Blocking Implementation (Non-Essential Cookies)

**Decision**: Frontend-based cookie gate with server-side enforcement

**Rationale**:
- Frontend: Check consent status before initializing analytics/marketing scripts (Google Analytics, Facebook Pixel, etc.)
- Server: Return consent status in auth response, frontend stores in Zustand
- Fail-safe: If consent status unknown, default to "reject all" (GDPR compliance)
- Essential cookies (session, CSRF) always allowed (GDPR exemption for "strictly necessary" cookies)

**Alternatives Considered**:
- **Server-side cookie injection**: Rejected because modern tracking scripts are client-side
- **CDN-level blocking**: Rejected because requires enterprise CDN features not available in MVP
- **Tag manager approach**: Considered for Phase 2 (Google Tag Manager consent mode)

**Implementation Details**:
- Frontend: `useCookieConsent()` hook checks Zustand store before `ReactGA.initialize()`
- Essential cookies: `fundrbolt_session`, `fundrbolt_csrf`, `fundrbolt_cookie_consent_status` (exempt from consent)
- Analytics cookies: Google Analytics 4 with consent mode integration
- Marketing cookies: Facebook Pixel, LinkedIn Insight with conditional loading
- Cookie banner dismissal without choice = reject all (safest default)

---

### 5. Multi-Jurisdiction Cookie Compliance

**Decision**: Single strictest-standard implementation (EU Cookie Law) for MVP, geo-detection deferred to Phase 2

**Rationale**:
- EU Cookie Law is strictest global standard (explicit opt-in required)
- Implementing EU standard satisfies CCPA, PIPEDA, and other less strict regulations
- Geo-detection (IP to country) adds complexity without MVP value
- Consistent UX across all users simplifies testing and support

**Alternatives Considered**:
- **Geo-based consent UI**: Deferred to Phase 2 (requires IP geolocation service, regional legal review)
- **US-only compliance (CCPA)**: Rejected because CCPA allows opt-out, EU requires opt-in (stricter)
- **No cookie consent**: Not viable (legal non-compliance risk)

**Implementation Details**:
- Cookie banner shown to all users on first visit (regardless of location)
- Consent required for all non-essential cookies (no jurisdiction exemptions)
- Phase 2 consideration: Add `user.jurisdiction` field, adjust consent flow per region

---

### 6. Document Update Notification Strategy

**Decision**: Middleware-based interception on next request after version change

**Rationale**:
- Middleware checks user's `user_consent` table for current document versions
- If mismatch detected (user accepted v1.0, current is v2.0), block request and return 409 Conflict
- Frontend handles 409 by showing modal with updated document
- Prevents users from continuing to use app without accepting updated terms
- No polling or WebSocket complexity needed

**Alternatives Considered**:
- **Email notification**: Supplement but not sufficient (users may not check email)
- **WebSocket push**: Rejected for MVP complexity (requires active connection management)
- **Login-time check only**: Rejected because user might stay logged in for weeks

**Implementation Details**:
- Middleware: `ConsentCheckMiddleware` runs after auth, before route handler
- Exempt routes: `/api/v1/legal/*`, `/api/v1/auth/logout`, `/health`
- Response: `409 Conflict` with body `{"error": "consent_required", "documents": ["terms", "privacy"]}`
- Frontend: Axios interceptor catches 409, shows modal, blocks navigation

---

### 7. GDPR Data Rights Implementation (Export & Deletion)

**Decision**: Async job queue for data export, soft delete with 30-day grace period for deletion

**Rationale**:
- Export: Generate ZIP with JSON/CSV files for all user data (profile, consents, audit logs)
- Async processing prevents API timeout for large data sets
- Deletion: Soft delete with anonymization after 30 days (allows recovery for accidental requests)
- Retain transaction records for 7 years (legal requirement), anonymize PII

**Alternatives Considered**:
- **Synchronous export**: Rejected due to timeout risk for users with extensive history
- **Immediate hard delete**: Rejected because prevents recovery and violates audit retention
- **External data broker**: Deferred to Phase 2 (adds complexity for MVP)

**Implementation Details**:
- Export: POST `/api/v1/consent/data-export` → enqueue Celery task → email download link when ready
- Export format: ZIP containing `profile.json`, `consents.json`, `audit_log.json`
- Deletion: POST `/api/v1/consent/data-deletion` → soft delete (`deleted_at` timestamp)
- Cron job: Nightly check for `deleted_at > 30 days`, anonymize PII (replace with `DELETED_{uuid}`)
- Audit logs: Never delete, anonymize user identifiers after account deletion

---

## Technology Stack Summary

### Backend Dependencies (Python/FastAPI)

- **SQLAlchemy 2.0+**: ORM for legal document and consent models
- **Alembic**: Database migrations for new tables
- **Pydantic 2.0+**: Validation for legal document and consent schemas
- **Redis**: Cache for consent status (existing infrastructure)
- **PostgreSQL**: Persistent storage (existing infrastructure)

**No new external dependencies required** - feature uses existing stack

### Frontend Dependencies (React/TypeScript)

- **Zustand**: State management for cookie consent and legal document status (existing)
- **React Query**: Server state for legal documents (existing)
- **Axios**: HTTP client with consent interceptor (existing)
- **date-fns**: Date formatting for document versions (likely already installed)

**Consider adding**:
- **react-cookie-consent**: Pre-built cookie banner component (MIT license)
  - **Alternative**: Build custom component for full control over UX
  - **Decision**: Build custom component to match Fundrbolt branding and UX requirements

### Testing Dependencies

- **pytest**: Unit/integration tests (existing)
- **Playwright**: E2E tests for consent flows (existing)
- **factory-boy**: Test data factories for legal documents and consents (existing)

**No new testing dependencies required**

---

## Best Practices Reference

### GDPR Compliance Checklist

✅ **Consent Requirements (Article 7)**:
- Freely given, specific, informed, unambiguous consent
- Must be as easy to withdraw as to give
- Proof of consent required (audit trail)

✅ **Right to Access (Article 15)**:
- User can request all personal data held
- Provide in machine-readable format (JSON/CSV)

✅ **Right to Erasure (Article 17)**:
- User can request deletion of personal data
- Exceptions: Legal obligations, public interest
- Retain audit logs with anonymized identifiers

✅ **Data Portability (Article 20)**:
- User can receive personal data in structured format
- Transmit data to another controller if requested

✅ **Privacy by Design (Article 25)**:
- Default to reject all non-essential cookies
- Minimize data collection
- Pseudonymization where possible

### Cookie Consent Best Practices (ICO Guidelines)

✅ **Pre-Consent Requirements**:
- No non-essential cookies before consent
- Essential cookies clearly identified
- Link to detailed cookie policy

✅ **Consent Mechanism**:
- Prominent banner on first visit
- Clear "Accept All" and "Reject All" options
- Granular category controls available
- No pre-ticked boxes

✅ **Documentation**:
- Cookie policy explains each cookie's purpose
- Retention periods stated
- Third parties identified

### Database Design Patterns

**Versioned Documents Pattern**:
- Immutable published versions
- Draft/Published/Archived status flow
- Foreign keys reference specific versions

**Audit Trail Pattern**:
- Append-only table with timestamps
- JSONB metadata for extensibility
- Indexed on user_id and timestamp
- Database-level constraints prevent updates

**Soft Delete Pattern**:
- `deleted_at` timestamp column
- Grace period before hard delete
- Anonymization instead of deletion for audit records

---

## Open Questions for Implementation Phase

### Phase 1 Decisions Needed

1. **Document Content Storage**: Markdown or HTML in database?
   - **Recommendation**: Markdown (easier to version, render to HTML on frontend)

2. **Cookie Categories**: Stick with 3 (Essential, Analytics, Marketing) or expand?
   - **Recommendation**: 3 categories for MVP, expand in Phase 2 if needed

3. **Admin UI for Document Management**: Include in MVP or defer?
   - **Recommendation**: Defer to Phase 2, use database seeding for MVP

### Phase 2 Enhancements

- Geo-based consent flows (GDPR vs CCPA vs other)
- Tag manager integration (Google Tag Manager consent mode)
- Admin UI for legal document authoring and versioning
- Multi-language support for legal documents
- Advanced cookie preference memory (per-device vs per-account)

---

## Risk Assessment

### High Risk

- **Regulatory Non-Compliance**: Mitigated by following strictest standards (EU Cookie Law, GDPR)
- **Audit Trail Integrity**: Mitigated by immutable audit log with database constraints

### Medium Risk

- **User Friction**: Long legal documents may reduce conversion rates
  - Mitigation: Progressive disclosure, summaries, optional "read more"
- **Cross-Device Consent Sync**: Anonymous consent may not sync until registration
  - Mitigation: Clear messaging, localStorage backup

### Low Risk

- **Performance Impact**: Additional database queries for consent checks
  - Mitigation: Redis caching, middleware optimization
- **Storage Growth**: Audit logs grow over time
  - Mitigation: Partitioning by year, archival strategy for old logs

---

## Success Metrics

- **Compliance**: 100% of users accept legal documents before account activation
- **Performance**: Cookie banner loads in <2s, consent recording in <500ms
- **Audit Trail**: 100% of consent events logged with timestamp and version
- **Cookie Blocking**: 0 non-essential cookies set without explicit consent
- **User Experience**: <5% drop-off rate at legal acceptance step during registration
