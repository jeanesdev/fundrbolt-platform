# Implementation Plan: Public Landing Page with User Onboarding

**Branch**: `006-landing-page` | **Date**: 2025-11-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-landing-page/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Create a public-facing landing page ecosystem consisting of four pages: a main landing page with role-specific registration CTAs (donor, auctioneer, NPO), an about page explaining the platform, a testimonials page for social proof, and a contact form page. Backend provides API endpoints for contact form submission with rate limiting and email delivery. Frontend delivers responsive, accessible public pages that integrate with existing authentication and legal compliance features.

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript (Frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy, Pydantic (Backend); React, Vite, Zustand, React Router (Frontend)
**Storage**: PostgreSQL (contact submissions, testimonials), Redis (rate limiting)
**Testing**: pytest (Backend), Vitest/React Testing Library (Frontend)
**Target Platform**: Web application (Azure App Service backend, Azure Static Web Apps frontend)
**Project Type**: Web application (backend API + frontend SPA)
**Performance Goals**: <3 sec page load (p95), <300ms API latency (p95), handle 1000+ concurrent visitors
**Constraints**: <200ms p95 API response, publicly accessible without auth, SEO-indexable, WCAG 2.1 AA compliant
**Scale/Scope**: 4 public pages, 2 database entities, 6 API endpoints, integration with 3 existing features

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Donor-Driven Engagement ✅

- **Status**: PASS
- **Rationale**: Landing page prioritizes clear donor/user onboarding paths with minimal friction. Contact form provides immediate support channel. All CTAs designed to guide users toward engagement.

### Real-Time Reliability ✅

- **Status**: PASS (Not Applicable)
- **Rationale**: Landing pages are static content delivery with no real-time bidding requirements. Rate limiting ensures contact form responsiveness under load.

### Production-Grade Quality ✅

- **Status**: PASS
- **Rationale**: Comprehensive testing (contract, integration, unit), type safety (Pydantic, TypeScript), proper error handling, audit logging for contact submissions, accessibility compliance.

### Solo Developer Efficiency ✅

- **Status**: PASS
- **Rationale**: Leverages existing auth (feature 001), legal compliance (feature 005), email service (feature 001). Minimal new infrastructure. Static pages require no complex state management.

### Data Security and Privacy ✅

- **Status**: PASS
- **Rationale**: Contact form implements rate limiting, email validation, PII protection (no logging of email content), audit trail for submissions. Integration with cookie consent (feature 005).

### Minimalist Development (YAGNI) ✅

- **Status**: PASS
- **Rationale**: Implements only specified pages and contact form. No CMS, no dynamic content management, no analytics dashboard. Manual testimonial curation initially (per assumptions). Email delivery only (no ticketing system initially).

### Type Safety & Validation ✅

- **Status**: PASS
- **Rationale**: Pydantic models for all API requests/responses, TypeScript strict mode, form validation on frontend and backend.

### Testing Requirements ✅

- **Status**: PASS
- **Rationale**: Contract tests for API endpoints, integration tests for contact form submission flow, unit tests for validation logic, E2E tests for page navigation and form submission.

### Security & Compliance ✅

- **Status**: PASS
- **Rationale**: Rate limiting on contact form, email validation, CSRF protection, integration with cookie consent, audit logging, graceful error handling.

### Observability ✅

- **Status**: PASS
- **Rationale**: Structured logging for contact submissions, Prometheus metrics for form submissions/failures, health check endpoints, error tracking.

## Project Structure

### Documentation (this feature)

```
.specify/specs/006-landing-page/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── openapi.yaml     # Contact form API specification
├── checklists/
│   └── requirements.md  # Specification quality checklist (already exists)
└── spec.md              # Feature specification (already exists)
```

### Source Code (repository root)

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── public/
│   │           ├── __init__.py
│   │           ├── contact.py          # Contact form endpoints (NEW)
│   │           └── testimonials.py     # Testimonials endpoints (NEW)
│   ├── models/
│   │   ├── contact_submission.py       # Contact submission model (NEW)
│   │   └── testimonial.py              # Testimonial model (NEW)
│   ├── schemas/
│   │   ├── contact.py                  # Contact Pydantic schemas (NEW)
│   │   └── testimonial.py              # Testimonial Pydantic schemas (NEW)
│   ├── services/
│   │   ├── contact_service.py          # Contact form business logic (NEW)
│   │   └── testimonial_service.py      # Testimonial service (NEW)
│   └── middleware/
│       └── rate_limit.py               # Rate limiting (EXISTING - extend)
└── tests/
    ├── contract/
    │   ├── test_contact_api.py         # Contact API contract tests (NEW)
    │   └── test_testimonial_api.py     # Testimonial API contract tests (NEW)
    ├── integration/
    │   └── test_contact_submission_flow.py  # End-to-end contact flow (NEW)
    └── unit/
        ├── test_contact_service.py     # Contact service unit tests (NEW)
        └── test_testimonial_service.py # Testimonial service unit tests (NEW)

frontend/fundrbolt-admin/  # NOTE: Will create separate landing-site app in Phase 1
├── src/
│   ├── pages/
│   │   ├── public/
│   │   │   ├── LandingPage.tsx         # Main landing page (NEW)
│   │   │   ├── AboutPage.tsx           # About page (NEW)
│   │   │   ├── TestimonialsPage.tsx    # Testimonials page (NEW)
│   │   │   └── ContactPage.tsx         # Contact form page (NEW)
│   ├── components/
│   │   ├── public/
│   │   │   ├── PublicLayout.tsx        # Shared layout for public pages (NEW)
│   │   │   ├── PublicNavigation.tsx    # Navigation header (NEW)
│   │   │   ├── PublicFooter.tsx        # Footer with links (NEW)
│   │   │   ├── ContactForm.tsx         # Contact form component (NEW)
│   │   │   └── TestimonialCard.tsx     # Testimonial display component (NEW)
│   ├── services/
│   │   ├── contactService.ts           # Contact API client (NEW)
│   │   └── testimonialService.ts       # Testimonial API client (NEW)
│   ├── hooks/
│   │   └── useContactForm.ts           # Contact form logic hook (NEW)
│   └── routes/
│       └── publicRoutes.tsx            # Public route definitions (NEW)
└── tests/
    ├── pages/
    │   └── public/
    │       ├── LandingPage.test.tsx    # Landing page tests (NEW)
    │       ├── AboutPage.test.tsx      # About page tests (NEW)
    │       └── ContactPage.test.tsx    # Contact form tests (NEW)
    └── components/
        └── public/
            ├── ContactForm.test.tsx    # Form validation tests (NEW)
            └── PublicNavigation.test.tsx  # Navigation tests (NEW)

alembic/versions/
└── YYYYMMDD_HHMM_add_contact_testimonial_tables.py  # Migration for new tables (NEW)
```

**Structure Decision**: Web application structure (Option 2) selected. Backend provides REST API for contact form submissions and testimonial retrieval. Frontend implements public pages as React SPA with separate routing from authenticated admin area. Existing backend structure (app/api, app/models, app/services) extended with public-facing endpoints under /api/v1/public namespace. Frontend creates new public/ subdirectory for landing page components separate from admin dashboard.

## Complexity Tracking

*No violations - all Constitution Check items passed*
