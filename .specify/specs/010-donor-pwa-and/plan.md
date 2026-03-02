# Implementation Plan: Donor PWA with Guest Management & Meal Selection

**Branch**: `010-donor-pwa-and` | **Date**: 2025-01-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-donor-pwa-and/spec.md`

## Summary

Build a donor-facing Progressive Web App (PWA) that enables event registration with comprehensive guest information collection and meal selection capabilities. The system supports registrants specifying guest count during registration, optionally providing guest details (name, email, phone), and selecting meals for all attendees. Admins can send individual registration links to guests, view complete attendee lists with meal selections, and export data for catering and event planning.

**Research Findings**: See [research.md](./research.md) for 5 technical decisions (event slugs, PWA deployment, shared components, registration system, dynamic branding).

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript 5.x (Frontend)
**Primary Dependencies**: FastAPI 0.120, SQLAlchemy 2.0, Pydantic 2.0, React 18, Vite, TanStack Router
**Storage**: Azure Database for PostgreSQL (3 new tables: event_registrations, registration_guests, meal_selections)
**Testing**: pytest (backend), Vitest (frontend)
**Target Platform**: Azure Static Web Apps (separate donor PWA instance) + Azure App Service (shared backend API)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: <500ms registration API response, <2s page load
**Constraints**: Mobile-first UI, offline registration queue (future), GDPR compliance for guest PII
**Scale/Scope**: 10,000+ donors, 500+ events, 50,000+ attendees (registrants + guests)

## Constitution Check

- [x] Spec exists and passes quality gates (46 functional requirements validated)
- [x] All requirements testable (5 user stories with acceptance criteria)
- [x] Dependencies identified (event_food_options table, email delivery system)
- [x] Breaking changes documented (none - new feature, no existing donor PWA)
- [x] Security/privacy considerations addressed (guest PII handling, meal selections = health data, GDPR compliance)

## Project Structure

### Documentation (this feature)

```text
specs/010-donor-pwa-and/
├── plan.md              # This file (implementation plan summary)
├── spec.md              # Feature specification (46 functional requirements)
├── research.md          # Phase 0 research (5 technical decisions)
├── data-model.md        # Phase 1 data model (3 entities: EventRegistration, RegistrationGuest, MealSelection)
├── quickstart.md        # Phase 1 development guide
├── contracts/           # Phase 1 OpenAPI specifications
│   ├── event-registration-endpoints.yaml  # Original 5 endpoints (630 lines)
│   └── guest-management-endpoints.yaml    # Guest/meal endpoints (650+ lines)
└── tasks.md             # Phase 2 granular tasks (created via /speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── models/
│   │   ├── event_registration.py       # EventRegistration model (new)
│   │   ├── registration_guest.py       # RegistrationGuest model (new)
│   │   └── meal_selection.py           # MealSelection model (new)
│   ├── schemas/
│   │   ├── event_registration.py       # Pydantic schemas for registration CRUD
│   │   ├── registration_guest.py       # Pydantic schemas for guest management
│   │   └── meal_selection.py           # Pydantic schemas for meal selections
│   ├── services/
│   │   ├── event_registration_service.py
│   │   ├── guest_service.py
│   │   └── meal_selection_service.py
│   └── api/v1/
│       ├── registrations.py            # Donor registration endpoints
│       ├── admin/
│       │   └── event_attendees.py      # Admin guest management endpoints
│       └── public/
│           └── events.py               # Public event browsing endpoints
├── alembic/versions/
│   └── [timestamp]_add_guest_meal_tables.py  # Migration 011
└── tests/
    ├── test_event_registration.py
    ├── test_guest_management.py
    └── test_meal_selections.py

frontend/donor-pwa/                     # New React PWA (separate from fundrbolt-admin)
├── src/
│   ├── features/
│   │   ├── event-browse/               # Public event listing
│   │   ├── event-registration/         # Registration wizard with guest/meal steps
│   │   └── my-registrations/           # Manage registrations and guests
│   ├── components/
│   │   ├── GuestForm.tsx               # Guest information form
│   │   ├── MealSelectionForm.tsx       # Meal option selector
│   │   └── EventCard.tsx               # Event display card (shared with admin)
│   └── lib/
│       └── api/
│           ├── registrations.ts        # Registration API client
│           └── guests.ts               # Guest management API client
└── tests/
    ├── event-registration.test.tsx
    └── guest-management.test.tsx
```

**Structure Decision**: Web application with separate donor PWA instance. Shares backend API (`/api/v1/registrations`) with existing admin PWA but uses separate Azure Static Web App deployment for donor-facing UI. New backend models/services for 3-entity data model (EventRegistration, RegistrationGuest, MealSelection).

## Phase Completion Status

### Phase 0: Research ✅

**Status**: COMPLETE

**Artifact**: [research.md](./research.md)

**Decisions**:
1. Event slug-based routing (e.g., `/events/charity-gala-2025`)
2. Separate Azure Static Web App for donor PWA
3. Shared component library with admin PWA
4. SQLAlchemy 2.0 with relationship loading patterns
5. Dynamic NPO branding loaded per event

### Phase 1: Design ✅

**Status**: COMPLETE (updated with guest/meal requirements)

**Artifacts**:
- [data-model.md](./data-model.md) - 3 entities (EventRegistration, RegistrationGuest, MealSelection), 800+ lines
- [contracts/event-registration-endpoints.yaml](./contracts/event-registration-endpoints.yaml) - 5 base endpoints (630 lines)
- [contracts/guest-management-endpoints.yaml](./contracts/guest-management-endpoints.yaml) - 9 guest/meal/admin endpoints (650+ lines)
- [quickstart.md](./quickstart.md) - Local development setup guide
- [.github/copilot-instructions.md](../../.github/copilot-instructions.md) - Updated agent context

**Key Design Decisions**:
- **3-entity data model**: EventRegistration (user-event link), RegistrationGuest (optional guest details), MealSelection (meal choices per attendee)
- **Unique constraint**: (registration_id, guest_id) ensures one meal per attendee
- **Guest account linking**: RegistrationGuest.user_id nullable, populated when guest creates own account
- **Admin workflows**: Separate endpoints for sending invitations, exporting attendee lists, meal summaries
- **Migration 011**: Creates 3 tables with 11 total indexes for query optimization

**API Summary**: 14 total endpoints
- 5 base registration endpoints (browse events, create/cancel registration)
- 3 guest management endpoints (add/update/remove guests)
- 2 meal selection endpoints (create/update meal choices)
- 4 admin endpoints (send invitations, export attendees, meal summary, guest lists)

### Phase 2: Tasks ⏸️

**Status**: NOT STARTED (requires separate `/speckit.tasks` command)

**Next Command**: User must run `/speckit.tasks` to generate granular implementation tasks from Phase 1 design artifacts.

---

## Notes

- **Clarifications integrated**: Session 2025-11-20 added guest information requirements (guest count required, details optional, meal selections, admin invitations). All Phase 1 artifacts updated to reflect expanded scope.
- **Plan restoration**: This plan.md was restored after accidental overwrite by setup-plan.sh during second /speckit.plan run.
- **Pre-existing work**: 20 test failures in admin PWA (separate work stream, not blocking donor PWA)
