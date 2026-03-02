# Implementation Plan: Ticket Package Management (Admin PWA)

**Branch**: `015-ticket-management-admin` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-ticket-management-admin/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Event coordinators need comprehensive ticket package management in the Admin PWA to configure event ticketing, custom options, and promotional codes. This feature enables Super Admins and Event Coordinators to create ticket packages with customizable pricing, quantity limits, images, custom registration options (up to 4 per package with boolean/multi-select/text input types), and promo codes with optional usage limits and date/time expiration. The system supports drag-and-drop reordering, package enable/disable capability, real-time sales tracking with 3-second updates, audit trails for changes after first sale, CSV export, and optimistic locking for concurrency control.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI 0.120+, SQLAlchemy 2.0+, Pydantic 2.0+, Alembic (backend); React 18+, Vite, TanStack Router, Zustand, Radix UI (frontend)
**Storage**: Azure Database for PostgreSQL (ticket packages, custom options, promo codes, purchases, audit logs), Azure Blob Storage (ticket package images), Azure Cache for Redis (sales count caching, rate limiting)
**Testing**: pytest with 80%+ coverage (backend), Vitest (frontend), contract tests for API endpoints, integration tests for full ticket purchase flows
**Target Platform**: Web application (Admin PWA for desktop/tablet, responsive design)
**Project Type**: Web application (backend API + frontend PWA)
**Performance Goals**:
- Real-time sales count updates within 3 seconds (SC-004)
- Validation error display <1 second (SC-005)
- API response time <300ms p95 (constitution requirement)
- Support 100+ concurrent coordinators per event (constitution requirement)
**Constraints**:
- Image uploads max 5MB, formats: JPG, PNG, WebP (FR-013)
- Virus scanning required on image upload (FR-015)
- Optimistic locking for concurrency control (FR-019, FR-046)
- Audit log with 7-year retention (FR-068)
- First-come-first-served for simultaneous purchases at capacity (Edge Cases #2)
**Scale/Scope**:
- Support 10+ simultaneous events (MVP)
- Up to 4 custom options per ticket package (FR-024)
- Unlimited ticket packages per event
- Promo codes with optional usage limits and expiration (FR-041-044)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Check (Pre-Phase 0) ✅ PASSED

### Core Principles Alignment

✅ **Donor-Driven Engagement**: Ticket package system optimizes donor purchase experience with clear options, promo codes, and custom registration fields (aligns with principle #1)

✅ **Real-Time Reliability**: Sales count updates within 3 seconds meet real-time requirements (aligns with principle #2, constitution: <500ms for critical paths, 3s acceptable for non-critical sales tracking)

✅ **Production-Grade Quality**: 80%+ test coverage, comprehensive validation, audit trails, optimistic locking for concurrency (aligns with principle #3)

✅ **Solo Developer Efficiency**: Leverages existing FastAPI/React stack, Azure managed services, no new frameworks (aligns with principle #4)

✅ **Data Security and Privacy**: Audit logs with 7-year retention, role-based access, encrypted storage (aligns with principle #5)

✅ **Minimalist Development (YAGNI)**: Implements exactly what's specified—no over-engineering, no anticipatory features (aligns with principle #6)

### Technology Stack Compliance

✅ **Backend**: FastAPI + SQLAlchemy 2.0 + Pydantic 2.0 + Alembic (constitution: FastAPI async/await, type hints, Pydantic validation)

✅ **Frontend**: React 18 + Vite + TypeScript strict + Zustand + Radix UI (constitution: React PWA, TypeScript strict, headless UI)

✅ **Storage**: Azure PostgreSQL + Azure Blob Storage + Azure Redis (constitution: managed Azure services)

✅ **Testing**: pytest with 80%+ coverage, contract tests, integration tests (constitution: 80%+ coverage, integration tests for critical paths)

### Code Quality Standards

✅ **Type Safety**: Python type hints on all functions, TypeScript strict mode (constitution: mandatory type hints, strict mode)

✅ **Testing**: 80%+ coverage target with unit/integration/contract tests (constitution: 80%+ coverage requirement)

✅ **Code Style**: Black, Ruff, isort (Python); ESLint, Prettier (TypeScript) via pre-commit hooks (constitution: formatting/linting enforced)

✅ **Commit Messages**: Will follow Conventional Commits (feat/fix/docs/refactor/test) (constitution: Conventional Commits mandatory)

✅ **Documentation**: Docstrings on public functions, OpenAPI spec auto-generated, ADRs for major decisions (constitution: Google-style docstrings, OpenAPI spec)

### Security & Compliance

✅ **Authorization**: Role-based access for Super Admin and Event Coordinator roles (constitution: RBAC with FastAPI dependency injection)

✅ **Audit Logging**: Immutable audit_logs table for ticket package changes after first sale (constitution: audit log for sensitive actions)

✅ **Data Retention**: 7-year audit log retention for compliance (constitution: transaction records 7 years for audit)

✅ **Secrets Management**: Azure Key Vault for Blob Storage credentials (constitution: Azure Key Vault for secrets)

✅ **Rate Limiting**: FastAPI middleware for API rate limits (constitution: 100 req/min per user, 1000 req/min per event)

### Performance & Scalability

✅ **API Latency**: Target <300ms p95 per constitution SLOs (constitution: p95 <300ms)

✅ **Caching**: Redis for sales count caching with 3-second refresh (constitution: Redis for caching with TTL)

✅ **Database**: PostgreSQL with indexed foreign keys, optimistic locking (constitution: index all foreign keys, no N+1 queries)

✅ **Concurrency**: Optimistic locking for quantity limits and promo code usage (constitution: handle concurrent operations)

### YAGNI Compliance

✅ **No Anticipatory Features**: Implements only specified requirements (4 custom options max, promo codes as specified) (constitution: YAGNI principle)

✅ **No Over-Engineering**: Direct SQLAlchemy models, FastAPI endpoints, React components—no unnecessary abstractions (constitution: ship minimal viable solution)

✅ **Specified Requirements Only**: All 68 functional requirements traced to user stories, no extras (constitution: build exactly what's specified)

### Post-Phase 1 Re-Check ✅ PASSED

**Design Decisions Reviewed**:
- ✅ **dnd-kit for drag-and-drop**: Modern, accessible, React 18 compatible, small bundle (13KB vs 40KB+ for alternatives)
- ✅ **Azure Blob Storage + Defender**: Managed service with built-in virus scanning, aligns with constitution's Azure stack
- ✅ **Polling for sales counts**: Simpler than WebSockets for 3-second non-critical updates, reduces infrastructure complexity
- ✅ **Optimistic locking with SQLAlchemy**: Built-in support, database-agnostic, scales horizontally per constitution requirements
- ✅ **Separate audit_logs table**: Immutable with PostgreSQL triggers, meets 7-year retention and compliance requirements
- ✅ **Redis caching for promo codes**: Cache-aside pattern with 60s TTL, reduces DB load while maintaining accuracy
- ✅ **Streaming CSV export with pandas**: Memory efficient, handles 10k+ rows, uses existing backend dependency

**No New Architecture Patterns**: All implementation strategies use existing fundrbolt-platform patterns from features 001-014.

**No Constitution Violations**: All design choices align with constitution principles, technology stack, and quality standards.

### Gate Status

**INITIAL CHECK: PASSED** ✅ - All constitution requirements met, no violations to justify. Ready to proceed to Phase 0 research.

**POST-PHASE 1 RE-CHECK: PASSED** ✅ - All Phase 0 research and Phase 1 design decisions align with constitution. No scope creep, no over-engineering, no new frameworks. Ready to proceed to Phase 2 (task breakdown via `/speckit.tasks`).

## Project Structure

### Documentation (this feature)

```
specs/015-ticket-management-admin/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── openapi.yaml     # OpenAPI 3.1 spec for ticket management endpoints
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
backend/
├── app/
│   ├── models/
│   │   ├── ticket_package.py         # Ticket Package model
│   │   ├── custom_ticket_option.py   # Custom Ticket Option model
│   │   ├── option_response.py        # Option Response model
│   │   ├── promo_code.py             # Promo Code model
│   │   ├── promo_code_application.py # Promo Code Application model
│   │   ├── ticket_purchase.py        # Ticket Purchase model
│   │   ├── assigned_ticket.py        # Assigned Ticket model
│   │   └── audit_log.py              # Audit Log Entry model (or extend existing)
│   ├── schemas/
│   │   ├── ticket_package.py         # Pydantic schemas for ticket packages
│   │   ├── custom_option.py          # Pydantic schemas for custom options
│   │   ├── promo_code.py             # Pydantic schemas for promo codes
│   │   └── ticket_purchase.py        # Pydantic schemas for ticket purchases
│   ├── api/
│   │   └── v1/
│   │       ├── admin/
│   │       │   ├── ticket_packages.py    # Admin ticket package endpoints
│   │       │   ├── custom_options.py     # Admin custom option endpoints
│   │       │   └── promo_codes.py        # Admin promo code endpoints
│   │       └── public/
│   │           └── ticket_purchases.py   # Public ticket purchase endpoints
│   ├── services/
│   │   ├── ticket_package_service.py     # Business logic for ticket packages
│   │   ├── custom_option_service.py      # Business logic for custom options
│   │   ├── promo_code_service.py         # Business logic for promo codes
│   │   ├── ticket_purchase_service.py    # Business logic for ticket purchases
│   │   ├── image_service.py              # Azure Blob Storage integration
│   │   └── audit_service.py              # Audit logging service (or extend existing)
│   └── middleware/
│       └── rate_limit.py                 # Rate limiting (extend existing)
├── alembic/
│   └── versions/
│       └── xxx_add_ticket_management.py  # Database migration
└── tests/
    ├── contract/
    │   └── test_ticket_api_contracts.py  # Contract tests for ticket endpoints
    ├── integration/
    │   ├── test_ticket_package_flows.py  # Full ticket package CRUD flows
    │   ├── test_promo_code_flows.py      # Promo code application flows
    │   └── test_ticket_purchase_flows.py # Ticket purchase with concurrency
    └── unit/
        ├── test_ticket_package_service.py
        ├── test_promo_code_service.py
        └── test_ticket_purchase_service.py

frontend/fundrbolt-admin/
├── src/
│   ├── components/
│   │   ├── tickets/
│   │   │   ├── TicketPackageList.tsx        # List view with drag-and-drop
│   │   │   ├── TicketPackageCard.tsx        # Package card with sales count
│   │   │   ├── TicketPackageForm.tsx        # Create/edit package form
│   │   │   ├── TicketPackageImageUpload.tsx # Image upload component
│   │   │   ├── CustomOptionsList.tsx        # Manage custom options
│   │   │   ├── CustomOptionForm.tsx         # Create/edit custom option
│   │   │   ├── PromoCodeList.tsx            # List promo codes
│   │   │   ├── PromoCodeForm.tsx            # Create/edit promo code
│   │   │   └── SalesTracker.tsx             # Real-time sales tracking
│   │   └── ui/
│   │       └── drag-drop/
│   │           └── DraggableList.tsx        # Reusable drag-and-drop component
│   ├── routes/
│   │   └── events/
│   │       └── $eventId/
│   │           └── tickets/
│   │               ├── index.tsx             # Ticket packages list page
│   │               ├── $packageId/
│   │               │   ├── edit.tsx          # Edit ticket package
│   │               │   ├── custom-options.tsx # Manage custom options
│   │               │   └── sales.tsx         # View sales data
│   │               └── promo-codes/
│   │                   ├── index.tsx         # Promo codes list
│   │                   └── $codeId/
│   │                       └── edit.tsx      # Edit promo code
│   ├── services/
│   │   ├── api/
│   │   │   ├── ticketPackages.ts            # API client for ticket packages
│   │   │   ├── customOptions.ts             # API client for custom options
│   │   │   ├── promoCodes.ts                # API client for promo codes
│   │   │   └── ticketPurchases.ts           # API client for sales data
│   │   └── stores/
│   │       ├── ticketPackageStore.ts        # Zustand store for packages
│   │       ├── promoCodeStore.ts            # Zustand store for promo codes
│   │       └── salesStore.ts                # Zustand store for real-time sales
│   └── hooks/
│       ├── useTicketPackages.ts             # Hook for ticket package data
│       ├── usePromoCodes.ts                 # Hook for promo code data
│       └── useRealTimeSales.ts              # Hook for polling sales counts
└── tests/
    └── tickets/
        ├── TicketPackageForm.test.tsx
        ├── PromoCodeForm.test.tsx
        └── DraggableList.test.tsx
```

**Structure Decision**: This is a web application (Option 2) with backend API (FastAPI) and frontend PWA (React). The structure follows the existing fundrbolt-platform monorepo layout with `/backend` and `/frontend/fundrbolt-admin` directories. All ticket management code will be organized by feature within these existing directories, maintaining consistency with the current codebase structure (as seen in 014-table-details-management and prior features).

## Complexity Tracking

*No constitution violations identified. All requirements align with existing architecture and standards.*
