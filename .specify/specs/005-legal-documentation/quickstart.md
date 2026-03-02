# Quickstart Guide: Legal Documentation & Compliance

**Feature**: 005-legal-documentation
**For**: Developers implementing this feature
**Last Updated**: 2025-10-28

## Overview

This guide provides a quick reference for implementing the legal documentation and compliance feature. Follow these steps to get started.

## Prerequisites

- Feature branch `005-legal-documentation` checked out
- Backend: Python 3.11+, Poetry installed
- Frontend: Node.js 22+, pnpm installed
- PostgreSQL and Redis running (via Docker Compose)
- Familiarity with existing auth system (feature 001)

## Quick Setup

### 1. Run Database Migration

```bash
cd backend
poetry run alembic upgrade head
```

This creates 4 new tables:
- `legal_documents`
- `user_consents`
- `cookie_consents`
- `consent_audit_logs`

### 2. Seed Initial Legal Documents

```bash
poetry run python scripts/seed_legal_documents.py
```

Creates draft versions of Terms of Service and Privacy Policy.

### 3. Install Dependencies (if needed)

```bash
# Backend (no new dependencies required)
cd backend
poetry install

# Frontend (no new dependencies required)
cd frontend/fundrbolt-admin
pnpm install
```

### 4. Run Tests

```bash
# Backend tests
cd backend
poetry run pytest app/tests/contract/test_legal_api.py -v
poetry run pytest app/tests/integration/test_legal_flow.py -v

# Frontend tests
cd frontend/fundrbolt-admin
pnpm test:unit src/components/legal
```

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Cookie       │  │ Legal Doc    │  │ Consent      │     │
│  │ Banner       │  │ Viewer       │  │ History      │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                  │              │
│         └─────────────────┴──────────────────┘              │
│                           │                                 │
│                  ┌────────▼────────┐                        │
│                  │  Zustand Store  │                        │
│                  │  (legalStore,   │                        │
│                  │   cookieStore)  │                        │
│                  └────────┬────────┘                        │
│                           │                                 │
│                  ┌────────▼────────┐                        │
│                  │  API Services   │                        │
│                  │  (legalService, │                        │
│                  │   consentService│                        │
│                  │   cookieService)│                        │
│                  └────────┬────────┘                        │
└───────────────────────────┼─────────────────────────────────┘
                            │ HTTP/JSON
┌───────────────────────────▼─────────────────────────────────┐
│                         BACKEND                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              FastAPI Middleware                      │  │
│  │          (ConsentCheckMiddleware)                    │  │
│  │    - Check consent status on each request            │  │
│  │    - Return 409 if outdated consent                  │  │
│  └─────────────────────┬────────────────────────────────┘  │
│                        │                                    │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │           API Routes (/api/v1/)                      │  │
│  │  - /legal/documents (GET, POST)                      │  │
│  │  - /consent/accept (POST)                            │  │
│  │  - /consent/status (GET)                             │  │
│  │  - /cookies/consent (GET, POST, PUT)                 │  │
│  └─────────────────────┬────────────────────────────────┘  │
│                        │                                    │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │              Service Layer                           │  │
│  │  - LegalService (document management)                │  │
│  │  - ConsentService (user consent tracking)            │  │
│  │  - CookieService (cookie preferences)                │  │
│  └─────────────────────┬────────────────────────────────┘  │
│                        │                                    │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │           SQLAlchemy Models                          │  │
│  │  - LegalDocument                                     │  │
│  │  - UserConsent                                       │  │
│  │  │  - CookieConsent                                 │  │
│  │  - ConsentAuditLog (immutable)                       │  │
│  └─────────────────────┬────────────────────────────────┘  │
│                        │                                    │
└────────────────────────┼────────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   PostgreSQL DB     │
              │  - legal_documents  │
              │  - user_consents    │
              │  - cookie_consents  │
              │  - consent_audit_log│
              └─────────────────────┘
```

---

## Key Concepts

### 1. Document Versioning

Legal documents use semantic versioning (e.g., "1.0", "2.1"):
- **Major version change (1.0 → 2.0)**: Requires user re-acceptance
- **Minor version change (1.0 → 1.1)**: No re-acceptance needed (typo fixes, clarifications)

### 2. Consent Status

Users can be in three states:
- **Current**: Accepted latest version
- **Outdated**: Accepted old version, need to accept new version
- **Missing**: Never accepted (new users)

### 3. Cookie Categories

Three cookie categories enforced:
- **Essential**: Always enabled (session, CSRF) - no consent needed
- **Analytics**: Google Analytics, performance tracking - requires consent
- **Marketing**: Facebook Pixel, ad tracking - requires consent

### 4. Audit Trail

All consent events logged to immutable `consent_audit_logs` table:
- Accept, withdraw, update, expire events
- Retained for 7 years minimum (regulatory compliance)
- Cannot be updated or deleted (database trigger enforced)

---

## Common Tasks

### Task 1: Add a New Legal Document

```python
# backend/scripts/add_legal_document.py
from app.services.legal_service import LegalService
from app.schemas.legal_document import LegalDocumentCreate

# Create draft document
document = LegalService.create_document(
    LegalDocumentCreate(
        document_type="terms_of_service",
        version="2.0",
        content="# Terms of Service v2.0\n\n...",
        effective_date="2025-12-01"
    )
)

# Publish when ready (archives old version)
LegalService.publish_document(document.id)
```

### Task 2: Check User Consent Status

```python
# backend/app/services/consent_service.py
from app.services.consent_service import ConsentService

# Get user's consent status
status = ConsentService.get_consent_status(user_id)

# Returns:
# {
#   "terms_of_service": {"status": "current", "needs_acceptance": False, ...},
#   "privacy_policy": {"status": "outdated", "needs_acceptance": True, ...}
# }

if status["blocked"]:
    # User needs to accept updated documents
    required_docs = status["required_documents"]
```

### Task 3: Record User Consent

```python
# Called during registration or update prompt
from app.services.consent_service import ConsentService
from app.schemas.consent import ConsentAcceptRequest

consents = ConsentService.accept_documents(
    user_id=user.id,
    consents=[
        {"document_type": "terms_of_service", "document_version": "1.0", "consent_method": "registration"},
        {"document_type": "privacy_policy", "document_version": "1.0", "consent_method": "registration"}
    ],
    ip_address=request.client.host,
    user_agent=request.headers.get("user-agent")
)

# Automatically logs to consent_audit_logs
```

### Task 4: Handle Cookie Consent (Frontend)

```typescript
// frontend/src/components/legal/CookieConsentBanner.tsx
import { useCookieConsent } from '@/hooks/useCookieConsent';

function CookieConsentBanner() {
  const { consent, setConsent, loading } = useCookieConsent();

  const handleAcceptAll = async () => {
    await setConsent({
      essential_cookies: true,
      analytics_cookies: true,
      marketing_cookies: true
    });
  };

  const handleRejectAll = async () => {
    await setConsent({
      essential_cookies: true,
      analytics_cookies: false,
      marketing_cookies: false
    });
  };

  // Only show banner if consent not recorded
  if (consent !== null) return null;

  return (
    <div className="cookie-banner">
      {/* Banner UI */}
    </div>
  );
}
```

### Task 5: Enforce Cookie Consent (Frontend)

```typescript
// frontend/src/utils/analytics.ts
import { cookieStore } from '@/stores/cookieStore';

// Only initialize analytics if user consented
export function initializeAnalytics() {
  const consent = cookieStore.getState().consent;

  if (consent?.analytics_cookies) {
    ReactGA.initialize('GA-MEASUREMENT-ID');
  }
}

// Call after cookie consent is set
cookieStore.subscribe(
  state => state.consent,
  (consent) => {
    if (consent?.analytics_cookies) {
      initializeAnalytics();
    }
  }
);
```

### Task 6: Handle Consent Check Middleware (Backend)

```python
# backend/app/middleware/consent_check.py
from fastapi import Request, HTTPException
from app.services.consent_service import ConsentService

async def consent_check_middleware(request: Request, call_next):
    # Skip for exempt routes
    if request.url.path.startswith("/api/v1/legal/") or \
       request.url.path == "/api/v1/auth/logout":
        return await call_next(request)

    # Check if user authenticated
    if hasattr(request.state, "user"):
        user_id = request.state.user.id
        status = ConsentService.get_consent_status(user_id)

        if status["blocked"]:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "consent_required",
                    "required_documents": status["required_documents"]
                }
            )

    return await call_next(request)
```

### Task 7: Handle 409 Consent Required (Frontend)

```typescript
// frontend/src/services/api.ts
import axios from 'axios';
import { useConsentModal } from '@/hooks/useConsentModal';

axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 409 &&
        error.response?.data?.error === 'consent_required') {
      // Show consent modal with required documents
      const requiredDocs = error.response.data.required_documents;
      useConsentModal.getState().open(requiredDocs);
    }
    return Promise.reject(error);
  }
);
```

---

## Testing Checklist

### Backend Tests

- [ ] Legal document CRUD operations
- [ ] Document versioning logic (major vs minor)
- [ ] Consent recording with audit trail
- [ ] Consent status checking (current, outdated, missing)
- [ ] Cookie consent storage and retrieval
- [ ] Middleware blocking outdated consent
- [ ] GDPR data export generation
- [ ] GDPR data deletion with soft delete

### Frontend Tests

- [ ] Cookie banner displays on first visit
- [ ] Cookie preferences persist across sessions
- [ ] Legal document viewer displays content
- [ ] Consent modal triggers on 409 response
- [ ] Consent history displays correctly
- [ ] Analytics only loads with consent

### E2E Tests

- [ ] New user registration with legal acceptance
- [ ] Existing user prompted for updated terms
- [ ] Cookie consent blocks non-essential cookies
- [ ] User can view and change cookie preferences
- [ ] User can view consent history

---

## Deployment Checklist

### Pre-Deployment

- [ ] Run all tests (backend + frontend)
- [ ] Review database migration script
- [ ] Prepare initial legal documents (Terms, Privacy Policy)
- [ ] Configure Redis cache for consent status
- [ ] Update frontend environment variables (API endpoints)

### Deployment Steps

1. **Database Migration**:
   ```bash
   cd backend
   poetry run alembic upgrade head
   ```

2. **Seed Legal Documents**:
   ```bash
   poetry run python scripts/seed_legal_documents.py --env production
   ```

3. **Deploy Backend**:
   ```bash
   make deploy-backend ENV=production TAG=v1.1.0
   ```

4. **Deploy Frontend**:
   ```bash
   make deploy-frontend ENV=production
   ```

5. **Verify Deployment**:
   - Check `/health` endpoint
   - Verify legal documents accessible
   - Test cookie consent banner
   - Confirm consent middleware blocks outdated users

### Post-Deployment

- [ ] Monitor error rates (should be <1%)
- [ ] Check consent acceptance rate (should be >95%)
- [ ] Verify audit logs are being created
- [ ] Test GDPR data export workflow
- [ ] Confirm cookie blocking works correctly

---

## Troubleshooting

### Issue: Cookie consent not persisting

**Symptom**: Banner reappears on every page load

**Solution**:
1. Check localStorage: `localStorage.getItem('fundrbolt_cookie_consent')`
2. Verify API endpoint returns 200 OK for POST `/cookies/consent`
3. Check Redis connection for authenticated users
4. Verify `expires_at` is set to 12 months in future

### Issue: Users not blocked despite outdated consent

**Symptom**: Users can access app without accepting updated terms

**Solution**:
1. Verify middleware is registered in `main.py`
2. Check consent status endpoint returns correct `blocked: true`
3. Confirm legal document published version is correct
4. Review exempt routes list (should not include protected routes)

### Issue: Audit log trigger fails

**Symptom**: Database error when recording consent

**Solution**:
1. Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'immutable_audit_log';`
2. Verify trigger function: `SELECT prosrc FROM pg_proc WHERE proname = 'prevent_audit_log_modification';`
3. Re-run migration if trigger missing
4. Test with direct SQL: `INSERT INTO consent_audit_logs (...) VALUES (...);`

### Issue: Frontend 409 interceptor not working

**Symptom**: No modal appears when consent required

**Solution**:
1. Check axios interceptor is registered before API calls
2. Verify modal component is mounted in app root
3. Check browser console for JavaScript errors
4. Test manually: `axios.post('/api/v1/consent/accept', ...)`

---

## Additional Resources

- [API Contracts Documentation](./contracts/api-contracts.md)
- [Data Model Documentation](./data-model.md)
- [Research & Technical Decisions](./research.md)
- [Feature Specification](./spec.md)
- [GDPR Compliance Checklist](https://gdpr.eu/checklist/)
- [EU Cookie Law Guide](https://gdpr.eu/cookies/)

---

## Support

For questions or issues during implementation:

1. Review this quickstart guide
2. Check the API contracts for endpoint details
3. Reference the data model for schema questions
4. Consult the research document for technical decisions
5. Review existing auth feature (001) for similar patterns

**Next Steps**: Proceed to Phase 2 with `/speckit.tasks` command to generate detailed implementation tasks.
