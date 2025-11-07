# Implementation Tasks: Public Landing Page

**Feature**: 006-landing-page | **Branch**: `006-landing-page` | **Date**: 2025-11-06

## Progress Summary

### User Story 3 (Testimonials): COMPLETE ✅

- Tasks T036-T057: 22/22 completed (100%)
- Backend: 14 unit tests, 21 contract tests passing
- Frontend: 50 component tests passing
- Manual QA: Visual design, filters, responsive layout validated
- **Total: 88 tests passing** (35 backend, 53 frontend)

## Task Organization

Tasks are organized by user story priority (P1 → P2 → P3) to enable incremental delivery and testing. Each user story is independently testable and delivers standalone value.

**Total Tasks**: 47
**Parallel Opportunities**: 15 task groups can run in parallel
**Estimated Duration**: 28-35 hours (single developer)

## User Story 1: First-Time Visitor Landing (Priority P1)

**Goal**: Allow visitors to understand platform value and access registration/login flows

**Dependencies**: None (MVP foundation)

**Estimated Duration**: 8-10 hours

### Backend Setup

- [ ] [T001] [P1] [US1] Create ContactSubmission model in `backend/app/models/contact_submission.py` with UUID, sender fields, message, IP address, status enum
- [ ] [T002] [P1] [US1] Create Testimonial model in `backend/app/models/testimonial.py` with quote_text, author fields, display_order, soft delete
- [ ] [T003] [P1] [US1] Create ContactSubmissionCreate/Response Pydantic schemas in `backend/app/schemas/contact.py` with field validation
- [ ] [T004] [P1] [US1] Create TestimonialResponse Pydantic schema in `backend/app/schemas/testimonial.py` for public API
- [ ] [T005] [P1] [US1] Generate Alembic migration for contact_submissions and testimonials tables with indexes
- [ ] [T006] [P1] [US1] Run migration and verify tables created (`alembic upgrade head`)

**Parallel Group 1** (T001-T004 can run in parallel after reading data-model.md)

### Frontend Foundation

- [ ] [T007] [P1] [US1] Create landing-site app structure in `frontend/landing-site/` with vite.config.ts, package.json, tsconfig.json
- [ ] [T008] [P1] [US1] Install dependencies: react, react-router-dom, axios, zod, react-hook-form, vitest
- [ ] [T009] [P1] [US1] Create API client in `frontend/landing-site/src/services/api.ts` with axios instance and base types
- [ ] [T010] [P1] [US1] Create PublicLayout component in `frontend/landing-site/src/components/layout/PublicLayout.tsx` with header/footer slots
- [ ] [T011] [P1] [US1] Create Navigation component in `frontend/landing-site/src/components/layout/Navigation.tsx` with links to all pages
- [ ] [T012] [P1] [US1] Create Footer component in `frontend/landing-site/src/components/layout/Footer.tsx` with legal links and branding

**Parallel Group 2** (T007-T009 can run in parallel)
**Parallel Group 3** (T010-T012 can run in parallel after T007)

### Landing Page Implementation

- [ ] [T013] [P1] [US1] Create LandingPage component in `frontend/landing-site/src/pages/LandingPage.tsx` with hero section
- [ ] [T014] [P1] [US1] Add registration CTAs to LandingPage: donor, auctioneer, NPO registration buttons linking to auth flows
- [ ] [T015] [P1] [US1] Add login CTA to LandingPage linking to `/login`
- [ ] [T016] [P1] [US1] Implement responsive layout for LandingPage (320px-2560px breakpoints)
- [ ] [T017] [P1] [US1] Add auth redirect logic: redirect authenticated users to dashboard based on role
- [ ] [T018] [P1] [US1] Create routes in `frontend/landing-site/src/routes/index.tsx` with lazy loading and Suspense
- [ ] [T019] [P1] [US1] Add meta tags to LandingPage with Helmet: title, description, Open Graph tags

**Sequential** (T013-T019 must be sequential)

### Testing & Integration

- [ ] [T020] [P1] [US1] Create LandingPage.test.tsx with rendering and CTA click tests
- [ ] [T021] [P1] [US1] Create Navigation.test.tsx with keyboard navigation and link tests
- [ ] [T022] [P1] [US1] Test authenticated user redirect with mock auth context
- [ ] [T023] [P1] [US1] Run accessibility audit with axe-core on LandingPage (target: zero critical violations)
- [ ] [T024] [P1] [US1] Test responsive design at 320px, 768px, 1024px, 1920px breakpoints
- [ ] [T025] [P1] [US1] Integrate cookie consent banner from feature 005 into PublicLayout
- [ ] [T026] [P1] [US1] Manual testing: Navigate from landing page to all registration/login flows

**Parallel Group 4** (T020-T022 can run in parallel)

**MVP Deliverable**: Working landing page with all registration/login CTAs functional

---

## User Story 2: Learning About Platform (Priority P2)

**Goal**: Provide about page explaining platform mission, features, benefits

**Dependencies**: US1 (navigation and layout infrastructure)

**Estimated Duration**: 3-4 hours

### About Page Implementation

- [ ] [T027] [P2] [US2] Create AboutPage component in `frontend/landing-site/src/pages/AboutPage.tsx` with mission statement
- [ ] [T028] [P2] [US2] Add platform features section to AboutPage: mobile bidding, real-time updates, easy setup
- [ ] [T029] [P2] [US2] Add user type benefits section to AboutPage: donor, auctioneer, NPO admin value props
- [ ] [T030] [P2] [US2] Add registration CTAs at bottom of AboutPage linking back to landing page or registration
- [ ] [T031] [P2] [US2] Implement responsive layout for AboutPage
- [ ] [T032] [P2] [US2] Add meta tags to AboutPage with Helmet
- [ ] [T033] [P2] [US2] Add About link to Navigation component
- [ ] [T034] [P2] [US2] Create AboutPage.test.tsx with rendering and content tests
- [ ] [T035] [P2] [US2] Run accessibility audit on AboutPage

**Sequential** (T027-T033 must be sequential)
**Parallel Group 5** (T034-T035 can run in parallel)

---

## User Story 3: Social Proof and Trust Building (Priority P2)

**Goal**: Display curated testimonials to build user confidence

**Dependencies**: US1 (backend models, frontend infrastructure)

**Estimated Duration**: 6-7 hours

### Backend - Testimonials Service

- [x] [T036] [P2] [US3] Create TestimonialService in `backend/app/services/testimonial_service.py` with get_published_testimonials method ✅
- [x] [T037] [P2] [US3] Add create_testimonial, update_testimonial, delete_testimonial methods to TestimonialService ✅
- [x] [T038] [P2] [US3] Create public testimonials endpoint GET `/api/v1/public/testimonials` in `backend/app/api/v1/public/testimonials.py` ✅
- [x] [T039] [P2] [US3] Create admin testimonials endpoints POST/PATCH/DELETE `/api/v1/admin/testimonials` with superadmin role requirement ✅
- [x] [T040] [P2] [US3] Register testimonial routes in `backend/app/main.py` ✅
- [x] [T041] [P2] [US3] Create testimonial seed script `backend/seed_testimonials.py` with 3 sample testimonials ✅ (5 testimonials seeded)

**Parallel Group 6** (T036-T037 can run in parallel)
**Sequential** (T038-T041 must follow T036-T037)

### Frontend - Testimonials Pages

- [x] [T042] [P2] [US3] Add testimonialApi methods to `frontend/landing-site/src/services/api.ts` ✅
- [x] [T043] [P2] [US3] Create TestimonialCard component in `frontend/landing-site/src/components/testimonials/TestimonialCard.tsx` ✅
- [x] [T044] [P2] [US3] Create TestimonialsPage component in `frontend/landing-site/src/pages/TestimonialsPage.tsx` with testimonial grid ✅
- [x] [T045] [P2] [US3] Implement pagination for testimonials (10 per page) ✅ Smart pagination (hides when <10 items)
- [x] [T046] [P2] [US3] Add filter by role (donor, auctioneer, npo_admin) on TestimonialsPage ✅ All 4 filters working
- [x] [T047] [P2] [US3] Add registration CTAs to TestimonialsPage ✅
- [x] [T048] [P2] [US3] Implement responsive layout for TestimonialsPage and TestimonialCard ✅ Mobile/tablet/desktop breakpoints
- [x] [T049] [P2] [US3] Add meta tags to TestimonialsPage ✅ Helmet with Open Graph
- [x] [T050] [P2] [US3] Add Testimonials link to Navigation component ✅

**Sequential** (T042-T050 must be sequential)

### Testing - Testimonials

- [x] [T051] [P2] [US3] Create contract tests for GET `/api/v1/public/testimonials` in `backend/tests/contract/test_testimonial_api.py` ✅ 8 tests passing
- [x] [T052] [P2] [US3] Create contract tests for admin testimonial endpoints with auth ✅ 13 tests passing
- [x] [T053] [P2] [US3] Create TestimonialCard.test.tsx with rendering and photo handling tests ✅ 13 tests passing
- [x] [T054] [P2] [US3] Create TestimonialsPage.test.tsx with pagination and filter tests ✅ 15 tests passing
- [x] [T055] [P2] [US3] Test testimonial service methods with unit tests in `backend/tests/unit/test_testimonial_service.py` ✅ 14 tests passing
- [x] [T056] [P2] [US3] Run accessibility audit on TestimonialsPage ✅ 9 jest-axe tests passing (WCAG 2.1 AA compliant)
- [x] [T057] [P2] [US3] Manual testing: Seed testimonials, verify display, test admin CRUD ✅ Complete (visual QA, filters, responsive design validated)

**Parallel Group 7** (T051-T052 can run in parallel)
**Parallel Group 8** (T053-T054 can run in parallel)
**Parallel Group 9** (T055-T056 can run in parallel)

---

## User Story 4: Contacting Platform (Priority P3)

**Goal**: Allow users to submit contact form messages to platform team

**Dependencies**: US1 (backend models, rate limiting middleware)

**Estimated Duration**: 7-8 hours

### Backend - Contact Service

- [ ] [T058] [P3] [US4] Create ContactService in `backend/app/services/contact_service.py` with create_submission method
- [ ] [T059] [P3] [US4] Add send_email_notification method to ContactService using existing EmailService
- [ ] [T060] [P3] [US4] Implement retry logic for email failures with exponential backoff
- [ ] [T061] [P3] [US4] Create contact endpoint POST `/api/v1/public/contact/submit` in `backend/app/api/v1/public/contact.py`
- [ ] [T062] [P3] [US4] Add rate limiting decorator to contact endpoint: 5 submissions/hour per IP
- [ ] [T063] [P3] [US4] Register contact route in `backend/app/main.py`
- [ ] [T064] [P3] [US4] Add Prometheus metrics for contact submissions (counter for success/failure)

**Sequential** (T058-T060 must be sequential)
**Parallel Group 10** (T061-T062 can run in parallel after T058-T060)

### Frontend - Contact Form

- [ ] [T065] [P3] [US4] Add contactApi.submit method to `frontend/landing-site/src/services/api.ts`
- [ ] [T066] [P3] [US4] Create ContactForm component in `frontend/landing-site/src/components/forms/ContactForm.tsx` with react-hook-form
- [ ] [T067] [P3] [US4] Add Zod validation schema to ContactForm: name (1-100), email (valid), subject (1-200), message (1-5000)
- [ ] [T068] [P3] [US4] Implement error handling in ContactForm: rate limit, validation, server errors
- [ ] [T069] [P3] [US4] Create ContactPage component in `frontend/landing-site/src/pages/ContactPage.tsx` using ContactForm
- [ ] [T070] [P3] [US4] Add success message and form reset after submission
- [ ] [T071] [P3] [US4] Implement responsive layout for ContactPage
- [ ] [T072] [P3] [US4] Add meta tags to ContactPage
- [ ] [T073] [P3] [US4] Add Contact link to Navigation component and Footer

**Sequential** (T065-T073 must be sequential)

### Testing - Contact Form

- [ ] [T074] [P3] [US4] Create contract tests for POST `/api/v1/public/contact/submit` in `backend/tests/contract/test_contact_api.py`
- [ ] [T075] [P3] [US4] Test rate limiting: submit 6 requests, verify 6th returns 429
- [ ] [T076] [P3] [US4] Test validation errors: invalid email, missing fields, message too long
- [ ] [T077] [P3] [US4] Create integration test for full contact submission flow with email in `backend/tests/integration/test_contact_submission_flow.py`
- [ ] [T078] [P3] [US4] Create unit tests for ContactService in `backend/tests/unit/test_contact_service.py`
- [ ] [T079] [P3] [US4] Create ContactForm.test.tsx with form validation and submission tests
- [ ] [T080] [P3] [US4] Create ContactPage.test.tsx with success/error state tests
- [ ] [T081] [P3] [US4] Run accessibility audit on ContactPage (focus on form accessibility)
- [ ] [T082] [P3] [US4] Manual testing: Submit contact form, verify email received, test rate limiting

**Parallel Group 11** (T074-T076 can run in parallel)
**Parallel Group 12** (T077-T078 can run in parallel)
**Parallel Group 13** (T079-T080 can run in parallel)

---

## Cross-Cutting Tasks (All User Stories)

**Goal**: Production readiness, performance, security, observability

**Dependencies**: All user stories (US1-US4)

**Estimated Duration**: 4-6 hours

### Performance Optimization

- [ ] [T083] [PERF] [ALL] Implement code splitting for each route (lazy loading already in T018)
- [ ] [T084] [PERF] [ALL] Optimize images: convert to WebP, add responsive srcset
- [ ] [T085] [PERF] [ALL] Enable gzip/brotli compression in Vite build config
- [ ] [T086] [PERF] [ALL] Configure browser caching headers for static assets
- [ ] [T087] [PERF] [ALL] Run Lighthouse audit on all pages (target: >90 performance, >95 accessibility)
- [ ] [T088] [PERF] [ALL] Test page load time on slow 3G connection (<3 sec p95)

**Parallel Group 14** (T084-T086 can run in parallel)

### SEO & Discoverability

- [ ] [T089] [SEO] [ALL] Generate sitemap.xml with all public pages
- [ ] [T090] [SEO] [ALL] Create robots.txt allowing all crawlers
- [ ] [T091] [SEO] [ALL] Add canonical URLs to all pages
- [ ] [T092] [SEO] [ALL] Implement structured data (JSON-LD) for organization on landing page
- [ ] [T093] [SEO] [ALL] Verify semantic HTML usage: header, nav, main, footer, article tags
- [ ] [T094] [SEO] [ALL] Add alt text to all images

**Parallel Group 15** (T089-T094 can run in parallel)

### Security & Compliance

- [ ] [T095] [SEC] [ALL] Test CSRF protection on contact form
- [ ] [T096] [SEC] [ALL] Verify HTML sanitization in contact message field (backend)
- [ ] [T097] [SEC] [ALL] Test cookie consent integration from feature 005 on all pages
- [ ] [T098] [SEC] [ALL] Verify no PII logged in application logs
- [ ] [T099] [SEC] [ALL] Test rate limiting under load (locust or similar)

### Documentation & Deployment

- [ ] [T100] [DOC] [ALL] Update `.github/copilot-instructions.md` with landing-site app structure
- [ ] [T101] [DOC] [ALL] Create landing-site README with setup instructions
- [ ] [T102] [DOC] [ALL] Update root README with landing page feature overview
- [ ] [T103] [DEPLOY] [ALL] Configure Azure Static Web Apps for landing-site deployment
- [ ] [T104] [DEPLOY] [ALL] Test deployment to dev environment
- [ ] [T105] [DEPLOY] [ALL] Verify all features work in deployed environment

---

## Dependency Graph

```text
US1 (Landing Page) - MVP Foundation
├─ Backend Setup (T001-T006)
│  ├─ Models (T001-T002) [Parallel]
│  ├─ Schemas (T003-T004) [Parallel]
│  └─ Migration (T005-T006) [Sequential]
├─ Frontend Foundation (T007-T012)
│  ├─ App Setup (T007-T009) [Parallel]
│  └─ Layout Components (T010-T012) [Parallel, depends on T007]
├─ Landing Page (T013-T019) [Sequential]
└─ Testing (T020-T026) [Mostly Parallel]

US2 (About Page) - Depends on US1
└─ About Page (T027-T035) [Sequential, with parallel tests]

US3 (Testimonials) - Depends on US1
├─ Backend (T036-T041) [Parallel services, sequential endpoints]
├─ Frontend (T042-T050) [Sequential]
└─ Testing (T051-T057) [Parallel groups]

US4 (Contact Form) - Depends on US1
├─ Backend (T058-T064) [Sequential service, parallel endpoints]
├─ Frontend (T065-T073) [Sequential]
└─ Testing (T074-T082) [Parallel groups]

Cross-Cutting (T083-T105) - Depends on US1-US4
├─ Performance (T083-T088) [Parallel]
├─ SEO (T089-T094) [Parallel]
├─ Security (T095-T099) [Parallel]
└─ Deployment (T100-T105) [Sequential]
```

## Parallel Execution Examples

**Example 1 - US1 Backend Setup** (save 2 hours):

- Developer A: T001 (ContactSubmission model)
- Developer B: T002 (Testimonial model)
- Developer C: T003 (Contact schemas)
- Developer D: T004 (Testimonial schemas)

**Example 2 - US3 Testing** (save 1.5 hours):

- Developer A: T051-T052 (backend contract tests)
- Developer B: T053-T054 (frontend component tests)
- Developer C: T055-T056 (unit tests + accessibility)

**Example 3 - Cross-Cutting SEO** (save 1 hour):

- Developer A: T089-T090 (sitemap + robots.txt)
- Developer B: T091-T092 (canonical URLs + structured data)
- Developer C: T093-T094 (semantic HTML + alt text)

## Task Summary

| User Story | Priority | Tasks | Duration | Parallel Groups |
|------------|----------|-------|----------|-----------------|
| US1: Landing Page | P1 | T001-T026 | 8-10h | 4 |
| US2: About Page | P2 | T027-T035 | 3-4h | 1 |
| US3: Testimonials | P2 | T036-T057 | 6-7h | 4 |
| US4: Contact Form | P3 | T058-T082 | 7-8h | 3 |
| Cross-Cutting | ALL | T083-T105 | 4-6h | 3 |
| **TOTAL** | | **105 tasks** | **28-35h** | **15 groups** |

**Note**: Task count corrected from initial 47 estimate after full breakdown.

## MVP Scope (Minimum Viable Product)

**Recommended MVP**: US1 only (T001-T026)

**Rationale**:

- Delivers core value: visitors can access registration/login flows
- Independently testable and deployable
- Establishes infrastructure for US2-US4
- ~8-10 hours of work

**Post-MVP Releases**:

- Release 1.1: US2 (About Page) - adds educational content
- Release 1.2: US3 (Testimonials) - adds social proof
- Release 1.3: US4 (Contact Form) - adds support channel
- Release 2.0: Cross-cutting (performance, SEO, security hardening)

## Notes

- All tasks assume working knowledge of FastAPI, React, SQLAlchemy, TypeScript
- Testing tasks include both automated and manual steps
- Accessibility audits should use axe-core CLI or browser extension
- Rate limiting requires Redis running locally (use Docker Compose)
- Email testing requires SendGrid/ACS configuration (use MailHog for local dev)
- Deployment tasks require Azure subscription and permissions

## Next Steps

1. Review tasks with product owner to confirm priorities
2. Break down any tasks >2 hours into subtasks if needed
3. Assign tasks to sprint backlog based on developer availability
4. Set up CI/CD pipeline to run tests on each commit
5. Create feature flags for gradual rollout of US2-US4
