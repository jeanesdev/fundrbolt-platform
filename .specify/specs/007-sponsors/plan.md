# Implementation Plan: Event Sponsors

**Branch**: `007-sponsors` | **Date**: 2025-11-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-sponsors/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add comprehensive sponsor management functionality to events, enabling event organizers to add, edit, and display sponsor information including logos, contact details, donation amounts, and sponsor tier levels. Sponsors will be displayed with thumbnail logos in a dedicated Sponsors tab within the event management interface. The implementation leverages existing Azure Blob Storage infrastructure for logo uploads and follows established patterns from the EventMedia system.

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript (Frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy, Pydantic, Alembic (Backend); React, Vite, Zustand, React Router (Frontend)
**Storage**: Azure Database for PostgreSQL (sponsor data), Azure Blob Storage (sponsor logos), Azure Cache for Redis (optional caching)
**Testing**: pytest with 80%+ coverage (Backend), React Testing Library + Vitest (Frontend)
**Target Platform**: Linux server (Azure App Service), modern browsers (PWA support)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: Logo uploads <2 minutes, sponsor list render <1 second, support 50+ sponsors per event
**Constraints**: 5MB max logo file size, PNG/JPG/JPEG/SVG/WebP formats only, isolated per event, role-based access control
**Scale/Scope**: 50 sponsors per event, 10MB total sponsor logos per event, thumbnail generation for list views

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| **Type Safety** | ✅ PASS | Python type hints + Pydantic models, TypeScript strict mode |
| **Testing Requirements** | ✅ PASS | Target 80%+ coverage with unit + integration tests |
| **Code Style** | ✅ PASS | Black, Ruff, isort (Python); ESLint, Prettier (TypeScript) |
| **Commit Standards** | ✅ PASS | Conventional Commits enforced via pre-commit hooks |
| **Security** | ✅ PASS | Role-based access, file validation, Azure Blob Storage encryption |
| **Privacy (GDPR)** | ✅ PASS | Sponsor data deletable with event, audit logging in place |
| **Observability** | ✅ PASS | Prometheus metrics for uploads, structured logging |
| **YAGNI Principle** | ✅ PASS | Implementing only specified requirements, no extra features |
| **Scalability** | ✅ PASS | Supports 50 sponsors per event, follows existing media patterns |
| **Dependencies** | ✅ PASS | Reusing existing Pillow (image processing), Azure SDK libraries |

**Constitution Compliance**: All gates pass. This feature follows established patterns from EventMedia (003-event-creation-ability) for file uploads, uses existing Azure Blob Storage infrastructure, and adheres to project security and testing standards.

## Project Structure

### Documentation (this feature)

```text
specs/007-sponsors/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── sponsors.openapi.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── models/
│   │   └── sponsor.py                    # Sponsor model (new)
│   ├── schemas/
│   │   └── sponsor.py                    # Sponsor Pydantic schemas (new)
│   ├── api/
│   │   └── v1/
│   │       └── sponsors.py               # Sponsor endpoints (new)
│   ├── services/
│   │   └── sponsor_service.py            # Sponsor business logic (new)
│   └── tests/
│       ├── test_sponsors_api.py          # API tests (new)
│       ├── test_sponsor_service.py       # Service tests (new)
│       └── test_sponsor_models.py        # Model tests (new)
├── alembic/
│   └── versions/
│       └── XXXX_add_sponsors_table.py    # Migration (new)

frontend/fundrbolt-admin/
├── src/
│   ├── types/
│   │   └── sponsor.ts                    # TypeScript types (new)
│   ├── services/
│   │   └── sponsor-service.ts            # API client (new)
│   ├── stores/
│   │   └── sponsor-store.ts              # Zustand store (new)
│   ├── features/
│   │   └── events/
│   │       ├── components/
│   │       │   ├── SponsorsTab.tsx       # Main sponsors UI (new)
│   │       │   ├── SponsorForm.tsx       # Add/edit form (new)
│   │       │   ├── SponsorList.tsx       # List with thumbnails (new)
│   │       │   └── SponsorCard.tsx       # Individual sponsor card (new)
│   │       └── hooks/
│   │           └── useSponsors.ts        # React hooks (new)
│   └── tests/
│       └── features/
│           └── events/
│               └── SponsorsTab.test.tsx  # Component tests (new)
```

**Structure Decision**: Using existing web application structure (backend + frontend). Sponsors follow the same pattern as EventMedia, EventLinks, and FoodOptions - a related entity managed within the event context. Logo uploads reuse the MediaService/FileUploadService patterns for Azure Blob Storage integration.

## Complexity Tracking

**No violations** - all constitution gates pass. This feature follows established patterns and does not introduce additional complexity beyond what is specified.
