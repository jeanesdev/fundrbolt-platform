Event Creation. Ability for NPO administrator and Event coordinator to create and edit an event. They should be able to input details like date, venue, descriptions, food options, upload media like logos, flyers, link to videos, social media tags, links to websites, etc.# Implementation Plan: NPO Creation and Management

**Branch**: `002-npo-creation` | **Date**: 2025-10-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-npo-creation/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable users to create and manage Non-Profit Organizations (NPOs) with comprehensive onboarding, branding customization, staff management, and SuperAdmin approval workflow. This feature implements the foundation for multi-tenant NPO management within the FundrBolt fundraising platform, ensuring proper verification and compliance before NPOs can host events or send invitations.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Python 3.11+ (Backend), TypeScript (Frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy, Pydantic, React, Zustand
**Storage**: PostgreSQL with multi-tenant architecture, Azure Blob Storage for file uploads
**Testing**: pytest (backend), Playwright (E2E), React Testing Library (frontend)
**Target Platform**: Web application (desktop/tablet optimized), PWA support
**Project Type**: Web application (frontend + backend)
**Performance Goals**: <300ms API response time, <500ms form submission processing
**Constraints**: Multi-tenant data isolation, GDPR compliance, file upload security
**Scale/Scope**: Support 1000+ NPOs, role-based access control, approval workflows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Initial Check (Phase 0)**: ✅ PASSED
**Post-Design Check (Phase 1)**: ✅ PASSED

✅ **Donor-Driven Engagement**: NPO branding and customization enhances donor trust and engagement
✅ **Production-Grade Quality**: Implements proper validation, security, and audit logging
✅ **Solo Developer Efficiency**: Leverages existing FastAPI/React stack and patterns
✅ **Data Security and Privacy**: Includes GDPR-compliant data handling and user consent tracking
✅ **Minimalist Development**: Implements only specified requirements without feature creep
✅ **Multi-Tenancy**: Uses existing `tenant_id` pattern for NPO isolation
✅ **Authentication & Authorization**: Extends existing RBAC with NPO admin and SuperAdmin roles
✅ **Type Safety**: Uses Pydantic models for validation and TypeScript strict mode

**Design Verification**:
- Data model aligns with existing multi-tenant architecture
- API contracts follow RESTful conventions and OpenAPI 3.0 standards
- File upload security implemented with Azure Blob Storage and signed URLs
- Legal compliance tracking meets GDPR requirements
- Performance considerations include proper indexing and caching strategies

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```
backend/
├── src/
│   ├── models/
│   │   ├── npo.py              # NPO entity model
│   │   ├── npo_application.py  # Application workflow model
│   │   ├── npo_member.py       # Staff/admin relationship model
│   │   └── legal_agreement.py  # EULA/Terms tracking model
│   ├── services/
│   │   ├── npo_service.py      # NPO CRUD operations
│   │   ├── application_service.py # Approval workflow logic
│   │   ├── invitation_service.py  # Staff invitation system
│   │   └── legal_service.py    # Agreement management
│   ├── api/
│   │   ├── npo_endpoints.py    # NPO management API
│   │   ├── application_endpoints.py # Application submission/review
│   │   └── admin_endpoints.py  # SuperAdmin review interface
│   └── schemas/
│       ├── npo_schemas.py      # Pydantic models
│       └── application_schemas.py
└── tests/
    ├── test_npo_service.py
    ├── test_application_workflow.py
    └── test_invitation_system.py

frontend/
├── src/
│   ├── features/
│   │   └── npo-management/
│   │       ├── components/
│   │       │   ├── NpoCreationForm.tsx
│   │       │   ├── BrandingConfiguration.tsx
│   │       │   ├── StaffInvitation.tsx
│   │       │   └── ApplicationStatus.tsx
│   │       ├── pages/
│   │       │   ├── CreateNpoPage.tsx
│   │       │   ├── NpoSettingsPage.tsx
│   │       │   └── SuperAdminReviewPage.tsx
│   │       ├── hooks/
│   │       │   ├── useNpoCreation.ts
│   │       │   └── useApplicationStatus.ts
│   │       └── services/
│   │           └── npo-api.ts
│   └── stores/
│       └── npo-store.ts
└── tests/
    └── e2e/
        ├── npo-creation.spec.ts
        └── application-approval.spec.ts
```

**Structure Decision**: Web application structure selected to match existing FundrBolt platform architecture with backend/frontend separation. NPO management is implemented as a feature module within the existing monorepo structure, leveraging shared authentication and multi-tenant patterns.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
