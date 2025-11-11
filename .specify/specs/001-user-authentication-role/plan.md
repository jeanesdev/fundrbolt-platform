# Implementation Plan: User Authentication & Role Management

**Branch**: `001-user-authentication-role` | **Date**: October 20, 2025 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `.specify/specs/001-user-authentication-role/spec.md`
**Status**: Phase 2 Complete ✅ | **Next**: Phase 3 (Implementation)

## Summary

This feature establishes the authentication and authorization foundation for the Augeo platform. It implements a multi-tier role system with five distinct roles (Super Admin, NPO Admin, Event Coordinator, Staff, Donor) with organizational and event-level scoping. The system provides secure OAuth2 JWT-based authentication, role-based access control (RBAC), password management, **email verification for new users**, session handling, and comprehensive security logging. NPO Admins automatically have coordinator access to all events in their organization, while Staff are manually assigned to specific events. This feature is critical as it gates all other platform functionality and must be production-ready before any other features can be built.

**Technical Approach**: FastAPI backend with SQLAlchemy ORM for PostgreSQL (with Row-Level Security), Pydantic for validation, OAuth2 with JWT tokens (15-min access, 7-day refresh), bcrypt password hashing, Redis for session/token management, email verification via Azure Communication Services, and React TypeScript frontend with Zustand state management. User profiles include optional organization name and address fields for business/institutional affiliations.

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript 5.x (Frontend)
**Primary Dependencies**: FastAPI 0.104+, SQLAlchemy 2.0+, Pydantic 2.x, python-jose (JWT), passlib (bcrypt), Redis, React 18+, Zustand, React Query, Azure Communication Services (Email)
**Storage**: Azure Database for PostgreSQL with Row-Level Security (RLS), Azure Cache for Redis (sessions/tokens)
**Testing**: pytest (unit/integration), Playwright (E2E), TestClient (FastAPI), factory_boy (fixtures)
**Target Platform**: Azure App Service (backend containers), Azure CDN (frontend PWA)
**Project Type**: Web application (separate backend/frontend)
**Performance Goals**: Login <2s, Auth checks <100ms, JWT generation <200ms, Email verification <30s, 1000 concurrent sessions
**Constraints**: HTTPS only, bcrypt (12+ rounds), JWT expiry 15min/7day, rate limiting 5/15min, **PostgreSQL RLS for tenant isolation**, **email verification required before login**
**Scale/Scope**: 1000 users MVP, 10,000 users Phase 2, multi-tenant with NPO/event scoping + RLS + email verification

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **YAGNI Compliance**: Implements only specified features (5 roles, JWT auth, password reset, email verification, RBAC)—no social login, MFA, or SSO
✅ **Solo Developer Efficiency**: Leverages FastAPI auto-docs, SQLAlchemy ORM, managed Redis/Postgres, Azure Communication Services, AI-assisted test generation
✅ **Production-Grade Quality**: Type hints enforced, 80%+ test coverage, security logging, rate limiting, encrypted secrets, **PostgreSQL RLS**, **email verification**
✅ **Donor-Driven Engagement**: Auth flows optimized for speed (<2s login), clear error messages, password managers supported, verified emails reduce spam
✅ **Real-Time Reliability**: Session state in Redis with <100ms latency, immediate role changes via cache invalidation, hybrid Redis+PostgreSQL session storage
✅ **Data Security**: Bcrypt password hashing, HTTPS only, JWT with short expiry, audit logging, PII protection, **RLS for tenant isolation**, email verification
✅ **Monorepo Structure**: Fits `/backend` and `/frontend` folders, shared types in `/shared`
✅ **Minimal Dependencies**: Uses only permissive licenses (MIT/Apache 2.0), avoids GPL/AGPL

**No violations detected**—proceed with implementation.

## Project Structure

### Documentation (this feature)

```
.specify/specs/001-user-authentication-role/
├── plan.md              # This file
├── research.md          # Phase 0 output ✅ (authentication patterns, JWT best practices)
├── data-model.md        # Phase 1 output ✅ (User, Role, Permission, Session entities)
├── quickstart.md        # Phase 1 output ✅ (local setup, test auth flow)
├── contracts/           # Phase 1 output ✅ (API contracts)
│   ├── auth.yaml        # ✅ OpenAPI spec for /api/v1/auth/* endpoints
│   └── users.yaml       # ✅ OpenAPI spec for /api/v1/users/* endpoints
└── tasks.md             # Phase 2 output ✅ (170 implementation tasks)
```

### Source Code (repository root)

```
backend/
├── src/
│   ├── main.py                          # FastAPI app entry point
│   ├── config.py                        # Settings (Pydantic BaseSettings)
│   ├── database.py                      # SQLAlchemy engine, session, base
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py                      # User model with password hashing + org fields
│   │   ├── role.py                      # Role model (5 core roles)
│   │   ├── permission.py                # Permission model (platform/NPO/event scoped)
│   │   ├── session.py                   # Session model (Redis-backed)
│   │   └── audit_log.py                 # Audit log model (immutable)
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py                      # AuthRequest, TokenResponse, RefreshRequest
│   │   ├── user.py                      # UserCreate, UserUpdate, UserResponse (with optional org fields)
│   │   └── role.py                      # RoleResponse, PermissionResponse
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py              # JWT generation, token validation, refresh
│   │   ├── user_service.py              # User CRUD, role assignment
│   │   ├── password_service.py          # Hash, verify, reset token generation
│   │   └── session_service.py           # Redis session management
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py                      # Dependencies (get_current_user, require_role)
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py                  # POST /login, /logout, /refresh, /register
│   │   │   ├── users.py                 # GET/PUT/DELETE /users, POST /users/{id}/role
│   │   │   └── password.py              # POST /password/reset, /password/change
│   ├── middleware/
│   │   ├── __init__.py
│   │   ├── rate_limit.py                # Rate limiting (5 attempts per 15min)
│   │   └── audit_log.py                 # Automatic audit logging middleware
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── logger.py                    # Structured JSON logging
│   │   └── security.py                  # Security utilities (CORS, headers)
│   └── alembic/
│       ├── versions/
│       │   └── 001_create_auth_tables.py  # Initial migration
│       └── env.py
├── tests/
│   ├── conftest.py                      # Pytest fixtures (test DB, client)
│   ├── factories/
│   │   ├── user_factory.py              # factory_boy User fixtures
│   │   └── role_factory.py              # factory_boy Role fixtures
│   ├── unit/
│   │   ├── test_auth_service.py         # JWT generation, validation
│   │   ├── test_password_service.py     # Hash, verify, reset tokens
│   │   └── test_user_service.py         # User CRUD logic
│   ├── integration/
│   │   ├── test_auth_api.py             # Login, logout, refresh endpoints
│   │   ├── test_user_api.py             # User management endpoints
│   │   └── test_role_assignment.py      # Role changes, permission checks
│   └── e2e/
│       └── test_auth_flow.py            # Full registration → login → protected route
├── pyproject.toml                       # Poetry dependencies
├── Dockerfile
└── .env.example

frontend/
├── augeo-admin/                         # Admin dashboard (already exists)
│   └── src/
│       ├── features/
│       │   └── auth/
│       │       ├── components/
│       │       │   ├── LoginForm.tsx    # Email/password login
│       │       │   ├── RegisterForm.tsx # New user registration (with optional org fields)
│       │       │   └── PasswordResetForm.tsx
│       │       ├── hooks/
│       │       │   ├── useAuth.ts       # Auth state hook
│       │       │   └── useLogin.ts      # Login mutation
│       │       ├── services/
│       │       │   └── authService.ts   # API calls (login, logout, refresh)
│       │       └── stores/
│       │           └── authStore.ts     # Zustand auth state (already exists)
│       └── routes/
│           └── (auth)/
│               ├── login.tsx
│               ├── register.tsx
│               └── reset-password.tsx
└── donor-pwa/                           # Donor PWA (already exists)
    └── src/
        └── [similar auth structure as augeo-admin]

shared/
└── types/
    ├── user.ts                          # Shared User type definitions
    ├── auth.ts                          # Shared Auth types (TokenResponse, etc.)
    └── role.ts                          # Shared Role enum

.github/
└── workflows/
    └── auth-ci.yml                      # CI pipeline (lint, test, type check)
```

**Structure Decision**: Using web application structure with `/backend` (FastAPI API) and `/frontend` (React PWA + Admin). The backend contains all auth logic, database models, and API endpoints. The frontend has two apps (`augeo-admin` and `donor-pwa`) that both consume the same auth API. Shared TypeScript types live in `/shared`.

## Complexity Tracking

*No constitution violations—this section is empty.*

---

## Progress Tracking

### Phase 0: Research ✅ COMPLETE

- ✅ `research.md` created (13 technical decisions documented)
- ✅ JWT token management strategy defined (15min/7day)
- ✅ Password security standards defined (bcrypt, 12 rounds)
- ✅ RBAC architecture designed (5 roles, flat hierarchy)
- ✅ Session management approach finalized (hybrid Redis + PostgreSQL)
- ✅ Multi-tenant isolation strategy validated (PostgreSQL RLS)
- ✅ Email verification flow designed (24-hour tokens)
- ✅ Super admin bootstrap approach defined (Alembic seed)
- ✅ Event-scoped roles clarified (auto NPO admin, manual staff)

### Phase 1: Design ✅ COMPLETE

- ✅ `data-model.md` created (6 entities: User, Role, Permission, Session, AuditLog, EventStaff)
- ✅ User model extended with optional organization_name and organization_address fields
- ✅ `contracts/auth.yaml` created (8 authentication endpoints)
- ✅ `contracts/users.yaml` created (9 user management endpoints)
- ✅ `quickstart.md` created (12-section setup guide with 7 test scenarios)
- ✅ All documents cross-checked for consistency
- ✅ Constitution compliance validated

### Phase 2: Tasks ✅ COMPLETE

- ✅ `tasks.md` created (170 implementation tasks across 12 phases)
- ✅ Tasks organized by user story (US1-US4) for independent delivery
- ✅ MVP path identified (54 tasks for User Story 1 + foundation)
- ✅ Parallel execution opportunities marked (83 [P] tasks)
- ✅ Dependencies and execution order documented

### Phase 3: Implementation ⏳ PENDING

- ⏳ Backend: Database models, services, API endpoints, middleware
- ⏳ Frontend: Auth forms, protected routes, state management
- ⏳ Tests: Unit, integration, E2E, security tests

### Phase 4: Deployment ⏳ PENDING

- ⏳ Staging deployment with Azure services
- ⏳ Production deployment with monitoring
- ⏳ Performance validation (login <2s, auth <100ms)

---

## Next Steps

1. ✅ ~~**Run Phase 0 Research**~~: Create `research.md` documenting JWT strategy, Redis session design, RBAC middleware architecture
2. ✅ ~~**Run Phase 1 Design**~~: Create `data-model.md`, `contracts/`, and `quickstart.md`
3. ✅ ~~**Generate Tasks**~~: Run `/speckit.tasks 001-user-authentication-role` to create detailed implementation tasks
4. **Start Implementation**: Follow task sequence (T001-T170) starting with Setup → Foundational → User Story 1 (MVP) ← **YOU ARE HERE**
5. **Validate**: Use spec acceptance criteria to ensure all requirements are met
6. **Deploy**: Staging → production with monitoring

---

**Status**: ✅ **PHASE 2 COMPLETE - READY FOR PHASE 3 (IMPLEMENTATION)**
**Version**: 1.2.0
**Last Updated**: October 20, 2025
