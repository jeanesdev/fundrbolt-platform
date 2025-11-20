# Implementation Plan: Admin PWA UI Cleanup & Role-Based Access Control

**Branch**: `009-admin-pwa-ui` | **Date**: 2025-11-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `.specify/specs/009-admin-pwa-ui/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature removes unnecessary template components from the admin PWA (Tasks, Chats, Apps, Settings, theme selectors, hamburger menu) and implements role-based access control with four distinct dashboards (SuperAdmin, NPO, Auctioneer, Event). It adds a persistent profile dropdown, an editable profile page matching the User model, an NPO context selector for multi-NPO management, and a functional search bar. The primary technical approach uses TanStack Router for navigation guards, TanStack Query for role-based data fetching, and backend API filtering by role and NPO context stored in JWT claims and Redis sessions.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend) + Python 3.11+ (backend)
**Primary Dependencies**: React 18 + Vite + TanStack Router + Radix UI + Tailwind 4 (frontend); FastAPI 0.120 + SQLAlchemy 2.0 + Pydantic 2.0 (backend)
**Storage**: PostgreSQL 15 (users, roles, npos, events, user_role_assignments) + Redis 7 (sessions)
**Testing**: vitest + @testing-library/react (frontend); pytest + pytest-asyncio (backend, 80%+ coverage)
**Target Platform**: PWA (Progressive Web App) deployed on Azure Static Web Apps (frontend) + Azure App Service (backend)
**Project Type**: web - Full-stack web application with frontend/backend coordination, authentication, role-based access control
**Performance Goals**: <2s dashboard load, <500ms page navigation, <1s profile updates, <300ms search results (up to 1000 records)
**Constraints**: Must maintain OAuth2+JWT auth, preserve existing DB schema, support 5 RBAC roles (SuperAdmin/NPO Admin/Event Coordinator/Staff/Donor), follow YAGNI principle, work with shadcn-admin template base
**Scale/Scope**: Medium feature (~15-20 files, 2000-3000 LOC changes). Frontend: nav restructure, 4 dashboards, profile page rewrite, NPO selector, search, role-based UI. Backend: filtered endpoints, profile update, search API, session context. Timeline: 2-3 week sprint

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Check (Pre-Research)

✅ **YAGNI Principle**: Feature builds only what's specified in the spec (remove template bloat, add role-based dashboards, profile editing, NPO selector, search). No anticipatory features added.

✅ **Tech Stack Alignment**: Uses existing React/Vite/TypeScript frontend, FastAPI/SQLAlchemy backend, PostgreSQL database, Redis sessions. No new technologies introduced.

✅ **Architecture Pattern**: Maintains existing REST API pattern, OAuth2+JWT authentication, RBAC authorization. No new patterns required.

✅ **No New Projects**: Works entirely within existing `frontend/augeo-admin` and `backend/app` codebases. No additional projects created.

✅ **Security Requirements**: Enforces role-based access control at both frontend (UI rendering) and backend (API filtering). Preserves existing JWT claims and session management.

✅ **Testing Standards**: Will maintain 80%+ backend test coverage, add frontend component tests for new UI. Follows existing pytest and vitest patterns.

**Constitution Status**: ✅ **PASSES** - All gates satisfied. No violations requiring justification.

### Post-Design Check (After Phase 1)

✅ **YAGNI Re-validation**: All design artifacts (data-model.md, contracts/, quickstart.md) strictly implement spec requirements:

- ProfileUpdate API: Matches User model fields exactly (no extra fields)
- Search API: Returns only 3 entity types specified (users, npos, events)
- NPO Context: Client-state only (no database schema changes)
- Dashboards: Placeholder components (no over-engineering with complex analytics)

✅ **Tech Stack Re-validation**: Phase 1 design confirms:

- Frontend: React Hook Form (already in dependencies), Zod validation (lightweight), Zustand store (already in use)
- Backend: PostgreSQL tsvector (native feature, no new DB), SQLAlchemy filters (existing ORM capability)
- No new services (Elasticsearch, message queues, etc.) introduced

✅ **Architecture Pattern Re-validation**:

- REST endpoints follow existing FastAPI patterns (GET /api/v1/resource, PATCH /api/v1/resource/{id})
- TanStack Router guards use existing auth context (no new auth mechanism)
- Zustand store follows existing state management pattern (see frontend/augeo-admin/src/stores/*)

✅ **API Contract Validation**:

- 3 OpenAPI specs generated (profile-update.yaml, search.yaml, npo-context-filtering.yaml)
- All use existing BearerAuth (JWT) security scheme
- Error responses match FastAPI defaults (401/403/404 with {detail: string})

✅ **Database Schema Validation**:

- Zero migrations required (all entities use existing schema)
- Search indexes (tsvector) are performance optimization, not schema change
- NPO Context is frontend-only state (localStorage + Zustand)

**Final Constitution Status**: ✅ **PASSES** - Design phase introduced no violations. Ready for Phase 2 (speckit.tasks).

## Project Structure

### Documentation (this feature)

```text
specs/009-admin-pwa-ui/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── api/v1/
│   │   ├── auth.py              # (existing) JWT auth endpoints
│   │   ├── users.py             # (modify) Add profile update, role-based filtering
│   │   ├── npos.py              # (modify) Add role-based filtering, NPO context
│   │   ├── events.py            # (modify) Add role-based filtering by NPO context
│   │   └── search.py            # (new) Cross-resource search endpoint
│   ├── models/
│   │   ├── user.py              # (existing) User model with profile fields
│   │   ├── role.py              # (existing) Role model
│   │   └── npo.py               # (existing) NPO model
│   ├── schemas/
│   │   ├── user.py              # (modify) ProfileUpdate schema
│   │   └── search.py            # (new) SearchRequest/Response schemas
│   ├── services/
│   │   ├── permission.py        # (existing) RBAC permission checks
│   │   └── search.py            # (new) Search service with filtering
│   └── middleware/
│       └── auth.py              # (existing) JWT validation, role extraction
└── tests/
    ├── api/v1/
    │   ├── test_users.py        # (modify) Profile update tests
    │   ├── test_npos.py         # (modify) Role filtering tests
    │   └── test_search.py       # (new) Search endpoint tests
    └── services/
        └── test_search.py       # (new) Search service unit tests

frontend/augeo-admin/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx         # (modify) Remove hamburger, add profile dropdown everywhere
│   │   │   ├── Sidebar.tsx          # (modify) Remove template items, add role-based nav
│   │   │   ├── ProfileDropdown.tsx  # (modify) Simplify to Profile + Logout only
│   │   │   └── NpoSelector.tsx      # (new) NPO context selector for top-left
│   │   ├── dashboards/
│   │   │   ├── SuperAdminDashboard.tsx   # (new) Placeholder dashboard
│   │   │   ├── NpoAdminDashboard.tsx     # (new) Placeholder dashboard
│   │   │   ├── AuctioneerDashboard.tsx   # (new) Placeholder dashboard
│   │   │   └── EventDashboard.tsx        # (new) Placeholder dashboard
│   │   ├── profile/
│   │   │   └── ProfileForm.tsx      # (new) Editable profile with User model fields
│   │   └── search/
│   │       ├── SearchBar.tsx        # (modify) Connect to backend search API
│   │       └── SearchResults.tsx    # (new) Display search results
│   ├── pages/
│   │   ├── DashboardPage.tsx        # (modify) Route to role-specific dashboard
│   │   ├── ProfilePage.tsx          # (modify) Use ProfileForm component
│   │   ├── NposPage.tsx             # (modify) Add role-based filtering
│   │   ├── EventsPage.tsx           # (modify) Filter by NPO context
│   │   └── UsersPage.tsx            # (modify) Filter by role permissions
│   ├── services/
│   │   ├── api.ts                   # (existing) Axios instance with auth
│   │   ├── auth.ts                  # (existing) Auth service with JWT
│   │   ├── npo-context.ts           # (new) NPO selection state management
│   │   └── search.ts                # (new) Search API calls
│   ├── hooks/
│   │   ├── useAuth.ts               # (existing) Get current user role
│   │   ├── useNpoContext.ts         # (new) NPO context state hook
│   │   └── useRoleBasedNav.ts       # (new) Role-based navigation items
│   ├── stores/
│   │   └── npo-context.ts           # (new) Zustand store for NPO selection
│   └── routes/
│       └── _authenticated.tsx       # (modify) Add role-based route guards
└── tests/
    ├── components/
    │   ├── layout/
    │   │   ├── Sidebar.test.tsx     # (new) Role-based nav tests
    │   │   └── NpoSelector.test.tsx # (new) NPO selector tests
    │   └── profile/
    │       └── ProfileForm.test.tsx # (new) Form validation tests
    └── services/
        └── search.test.ts           # (new) Search service tests
```

**Structure Decision**: Web application structure selected. Feature spans both `backend/` (FastAPI REST API with role-based filtering) and `frontend/augeo-admin/` (React PWA with component/page/service layers). Uses existing monorepo layout. No new projects created. Changes are modifications to existing admin PWA template plus new components for dashboards, NPO selector, profile form, and search.

## Complexity Tracking

**No violations** - Constitution Check passed all gates. No complexity justification required.
