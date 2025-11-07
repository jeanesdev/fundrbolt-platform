# Phase 0: Research & Technical Decisions

**Feature**: 006-landing-page
**Date**: 2025-11-06
**Status**: Complete

## Overview

This document consolidates research findings and technical decisions for implementing the public landing page feature. All decisions align with the Augeo Platform Constitution and leverage existing infrastructure from features 001 (authentication), 002 (NPO creation), and 005 (legal documentation).

## Technical Decisions

### 1. Frontend Architecture

**Decision**: Create separate public site within existing frontend monorepo

**Rationale**:

- Separation of concerns: Public pages have different requirements than authenticated admin dashboard
- Different routing needs: Public pages should be accessible without auth checks
- Different styling: Landing pages require marketing-focused design vs admin UI
- SEO optimization: Public pages need meta tags, semantic HTML, static rendering

**Alternatives Considered**:

- **Separate repository**: Rejected - adds deployment complexity, harder to share types/utilities
- **Mix public/private in same app**: Rejected - clutters admin app, complicates auth middleware

**Implementation Approach**:

```typescript
frontend/
├── augeo-admin/          # Existing admin dashboard
└── landing-site/         # NEW - Public landing pages
    ├── src/
    │   ├── pages/
    │   │   ├── LandingPage.tsx
    │   │   ├── AboutPage.tsx
    │   │   ├── TestimonialsPage.tsx
    │   │   └── ContactPage.tsx
    │   ├── components/
    │   │   ├── layout/
    │   │   │   ├── PublicLayout.tsx
    │   │   │   ├── Navigation.tsx
    │   │   │   └── Footer.tsx
    │   │   └── forms/
    │   │       └── ContactForm.tsx
    │   ├── services/
    │   │   └── api.ts
    │   └── routes/
    │       └── index.tsx
    ├── package.json
    ├── vite.config.ts
    └── tsconfig.json
```

**Best Practices**:

- Use React Router for client-side routing
- Implement code splitting for each page (lazy loading)
- Use semantic HTML for accessibility and SEO
- Implement structured data (JSON-LD) for search engines
- Mobile-first responsive design (320px-2560px)
- Lighthouse score target: >90 performance, >95 accessibility

### 2. Contact Form Implementation

**Decision**: Backend API endpoint with email delivery via existing email service (feature 001)

**Rationale**:

- Leverage existing SendGrid/Azure Communication Services from feature 001
- Store submissions in database for audit trail
- Rate limiting prevents spam without CAPTCHA initially
- Email validation on frontend and backend

**Alternatives Considered**:

- **Third-party form service (Formspree, Typeform)**: Rejected - less control, data privacy concerns, vendor lock-in
- **Mailto links**: Rejected - poor UX, no validation, no spam protection, no audit trail
- **CAPTCHA immediately**: Deferred - add only if spam becomes issue (YAGNI principle)

**Implementation Approach**:

```python
# Backend: app/api/v1/public/contact.py
from fastapi import APIRouter, Depends, HTTPException, Request
from app.schemas.contact import ContactSubmissionCreate, ContactSubmissionResponse
from app.services.contact_service import ContactService
from app.middleware.rate_limit import rate_limit

router = APIRouter(prefix="/public/contact", tags=["public"])

@router.post("/submit", response_model=ContactSubmissionResponse)
@rate_limit(max_requests=5, window_seconds=3600)  # 5 per hour per IP
async def submit_contact_form(
    data: ContactSubmissionCreate,
    request: Request,
    service: ContactService = Depends()
):
    """Submit contact form and send email to platform team"""
    submission = await service.create_submission(data, request.client.host)
    await service.send_email_notification(submission)
    return submission
```

**Best Practices**:

- Rate limiting by IP address (5 submissions/hour initially)
- Email validation (RFC 5322 compliant)
- HTML sanitization on server side (prevent XSS)
- Async email sending (non-blocking)
- Retry logic for email failures (exponential backoff)
- Audit logging for all submissions
- No PII in application logs

### 3. Testimonial Management

**Decision**: Manual admin entry with database storage, no public submission initially

**Rationale**:

- Quality control: Curated testimonials are more trustworthy
- No moderation workflow needed initially (YAGNI)
- Simple CRUD API for admin users only
- Public API for display only (read-only)

**Alternatives Considered**:

- **User-submitted testimonials**: Deferred to Phase 2 - requires moderation workflow, approval queue
- **Hardcoded in frontend**: Rejected - requires deployment to update, no admin control

**Implementation Approach**:

```python
# Backend: app/api/v1/public/testimonials.py
@router.get("/testimonials", response_model=List[TestimonialResponse])
async def list_testimonials(
    service: TestimonialService = Depends()
):
    """Get all published testimonials ordered by display_order"""
    return await service.get_published_testimonials()

# Admin-only endpoint (separate router)
@router.post("/admin/testimonials", response_model=TestimonialResponse)
@require_role("superadmin")
async def create_testimonial(
    data: TestimonialCreate,
    service: TestimonialService = Depends()
):
    """Create new testimonial (admin only)"""
    return await service.create_testimonial(data)
```

**Best Practices**:

- Display order field for manual curation
- Published flag for draft management
- Optional photo URLs (Azure Blob Storage)
- Character limits (quote: 500 chars, name: 100 chars)
- Pagination support (10 per page initially)

### 4. Authentication Integration

**Decision**: Redirect authenticated users from landing page to dashboard

**Rationale**:

- Logged-in users don't need to see registration CTAs
- Provides seamless experience for returning users
- Prevents confusion (why show "register" to logged-in users?)

**Implementation Approach**:

```typescript
// Frontend: LandingPage.tsx
export const LandingPage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Redirect to role-specific dashboard
      const dashboard = getDashboardRoute(user.role);
      navigate(dashboard, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Render landing page for unauthenticated users
  return <LandingPageContent />;
};
```

**Best Practices**:

- Check auth on mount (useEffect)
- Use replace: true to avoid back button issues
- Role-based dashboard routing
- Show loading state during auth check

### 5. Cookie Consent Integration

**Decision**: Integrate cookie consent banner from feature 005 on all public pages

**Rationale**:

- Legal requirement (GDPR, EU Cookie Law)
- Existing implementation from feature 005
- Consistent consent tracking across site

**Implementation Approach**:

```typescript
// Frontend: PublicLayout.tsx
import { CookieConsentBanner } from '@/components/legal/CookieConsentBanner';

export const PublicLayout: React.FC = ({ children }) => {
  return (
    <>
      <Navigation />
      <main>{children}</main>
      <Footer />
      <CookieConsentBanner /> {/* From feature 005 */}
    </>
  );
};
```

**Best Practices**:

- Banner appears on first visit
- Persisted in localStorage (anonymous) or database (authenticated)
- Does not block page rendering
- Accessible (keyboard navigation, screen reader support)

### 6. SEO Optimization

**Decision**: Implement basic SEO (meta tags, semantic HTML, sitemap.xml)

**Rationale**:

- Public pages must be discoverable via search engines
- Improves organic traffic and user acquisition
- No advanced SEO needed initially (YAGNI)

**Implementation Approach**:

```typescript
// Frontend: Each page sets meta tags
import { Helmet } from 'react-helmet-async';

export const LandingPage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Augeo - Fundraising Platform for Nonprofits</title>
        <meta name="description" content="World-class fundraising software..." />
        <meta property="og:title" content="Augeo Fundraising Platform" />
        <meta property="og:description" content="..." />
        <meta property="og:image" content="https://augeo.app/og-image.jpg" />
        <link rel="canonical" href="https://augeo.app" />
      </Helmet>
      {/* Page content */}
    </>
  );
};
```

**Best Practices**:

- Unique title/description per page
- Open Graph tags for social sharing
- Canonical URLs to prevent duplicate content
- Semantic HTML (header, nav, main, footer, article)
- Alt text on all images
- Sitemap.xml generated during build
- robots.txt allowing all crawlers

### 7. Performance Optimization

**Decision**: Code splitting, lazy loading, CDN caching, image optimization

**Rationale**:

- Target: <3 sec load time (p95) per success criteria
- Mobile users on slower connections
- Reduces initial bundle size

**Implementation Approach**:

```typescript
// Lazy load pages
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const TestimonialsPage = lazy(() => import('./pages/TestimonialsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));

// Routes with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/about" element={<AboutPage />} />
    <Route path="/testimonials" element={<TestimonialsPage />} />
    <Route path="/contact" element={<ContactPage />} />
  </Routes>
</Suspense>
```

**Best Practices**:

- Code split each route (lazy loading)
- Optimize images (WebP format, responsive sizes)
- Enable gzip/brotli compression
- Use Azure CDN for static assets
- Implement browser caching headers
- Monitor with Lighthouse CI in pipeline

### 8. Accessibility (WCAG 2.1 AA)

**Decision**: Build accessible from the start using semantic HTML and ARIA

**Rationale**:

- Success criteria: zero critical violations
- Legal requirement for public websites
- Better UX for all users
- Easier to maintain than retrofitting

**Implementation Approach**:

- Semantic HTML (nav, main, footer, article)
- Keyboard navigation support (Tab, Enter, Escape)
- Focus indicators visible
- ARIA labels where needed
- Color contrast >4.5:1
- Alt text on all images
- Skip to main content link
- Form labels associated with inputs
- Error messages announced to screen readers

**Best Practices**:

- Run axe-core in automated tests
- Manual testing with keyboard only
- Test with NVDA/JAWS screen readers
- Include in PR checklist

## Deferred Decisions (YAGNI)

The following features are explicitly NOT included in initial implementation:

### 1. CAPTCHA

**Why Deferred**: Rate limiting (5 submissions/hour) should be sufficient initially. Add CAPTCHA only if spam becomes measurable problem.

**Revisit When**: Contact form spam exceeds 10% of submissions

### 2. User-Submitted Testimonials

**Why Deferred**: Manual curation ensures quality. User submission requires moderation workflow, approval queue, notification system.

**Revisit When**: Admin requests ability for users to submit testimonials

### 3. A/B Testing

**Why Deferred**: No baseline metrics yet. Need production traffic data before testing variations.

**Revisit When**: 1000+ monthly landing page visitors

### 4. Analytics Dashboard

**Why Deferred**: No immediate need. Azure Monitor provides basic metrics. Custom dashboard is future enhancement.

**Revisit When**: Marketing team requests conversion funnel analysis

### 5. Multi-Language Support

**Why Deferred**: Constitution mentions Phase 2+. English-only initially.

**Revisit When**: Phase 2 planning begins

### 6. Live Chat Widget

**Why Deferred**: Contact form sufficient for MVP. Live chat requires staffing and third-party integration.

**Revisit When**: Support volume indicates need for real-time chat

### 7. Content Management System

**Why Deferred**: Static content changes infrequently. Code updates acceptable initially.

**Revisit When**: Non-technical team members need to update content weekly

## Integration Points

### Feature 001 (Authentication)

- **Login redirect**: `/api/v1/auth/login` endpoint
- **Registration redirects**:
  - Donor: `/api/v1/auth/register?role=donor`
  - Auctioneer: `/api/v1/auth/register?role=auctioneer`
  - NPO: Handled by Feature 002
- **Session check**: Use existing `useAuth()` hook
- **Email service**: Reuse SendGrid/ACS configuration

### Feature 002 (NPO Creation)

- **NPO registration**: Link to `/register/npo` (NPO application flow)

### Feature 005 (Legal Documentation)

- **Cookie consent**: Use existing `CookieConsentBanner` component
- **Terms/Privacy links**: Link to `/legal/terms` and `/legal/privacy`
- **Consent tracking**: Integrated automatically via middleware

## Technology Stack Summary

### Backend

- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL (2 new tables)
- **Caching**: Redis (rate limiting)
- **Email**: SendGrid/Azure Communication Services (existing)
- **Validation**: Pydantic
- **Testing**: pytest

### Frontend

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Axios (existing)
- **SEO**: react-helmet-async
- **Testing**: Vitest + React Testing Library

### Infrastructure

- **Hosting**: Azure Static Web Apps (frontend), Azure App Service (backend)
- **CDN**: Azure CDN
- **Storage**: Azure Blob Storage (testimonial photos)
- **Monitoring**: Azure Application Insights, Prometheus

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Contact form spam | Medium | Medium | Rate limiting, email validation, future CAPTCHA |
| SEO not effective | Low | Low | Follow best practices, monitor search console |
| Performance below 3sec | Medium | Low | Code splitting, CDN, Lighthouse CI checks |
| Accessibility violations | High | Low | Automated testing, manual testing, PR checklist |
| Email delivery failures | Medium | Low | Retry logic, error handling, fallback message |

## Open Questions

None - all technical decisions finalized based on constitution and existing features.

## References

- Feature Spec: [spec.md](./spec.md)
- Constitution: [.specify/memory/constitution.md](../../memory/constitution.md)
- Feature 001: [.specify/specs/001-user-authentication-role/](../001-user-authentication-role/)
- Feature 002: [.specify/specs/002-npo-creation/](../002-npo-creation/)
- Feature 005: [.specify/specs/005-legal-documentation/](../005-legal-documentation/)
