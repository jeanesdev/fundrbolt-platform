# Implementation Plan: Ticket Purchasing & Assignment

**Branch**: `036-ticket-purchasing` | **Date**: 2026-03-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `.specify/specs/036-ticket-purchasing/spec.md`

## Summary

Enable donors to browse ticket packages on a public event page, purchase tickets through a multi-package cart with payment processing, and assign individual tickets to guests via email invitations. Guests create accounts and register for events through invitation links. Sponsorship packages collect sponsor details (logo, website) during checkout, creating sponsor entries visible on the event page. Soft oversell is permitted with coordinator resolution. Custom ticket option responses are collected during guest registration.

## Technical Context

**Language/Version**: Python 3.11 (backend) + TypeScript 5.x / React 19 (donor PWA)
**Primary Dependencies**:
  - Backend: FastAPI 0.120+, SQLAlchemy 2.0, Pydantic 2.0, Alembic, Pillow (logo processing)
  - Frontend (donor-pwa): React 19, Vite 7, TanStack Router, Zustand, React Query, Radix UI, Tailwind CSS 4
**Storage**: Azure Database for PostgreSQL (primary data); Azure Blob Storage (sponsor logos); Azure Cache for Redis (session/rate-limit)
**Testing**: pytest + pytest-asyncio (backend); vitest (frontend)
**Target Platform**: Linux server (Azure App Service) + web PWA (mobile-first)
**Project Type**: web (backend + donor PWA frontend)
**Performance Goals**: Event page loads in < 3 sec; full purchase flow in < 5 min; ticket assignment in < 30 sec
**Constraints**: PCI SAQ-A (payment via Deluxe HPF — no card data touches Fundrbolt); soft oversell permitted; cart stored client-side (localStorage); per-event ticket cap configurable by coordinator
**Scale/Scope**: MVP — 100 concurrent donors per event, 10 simultaneous events; ticket purchases < 10 req/s at peak

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 1 | No plaintext passwords or card numbers (Immutable Constraint 3) | ✅ PASS | HPF offloads card capture to Deluxe; only vault tokens stored |
| 2 | No hard-coded secrets (Immutable Constraint 4) | ✅ PASS | All secrets via Azure Key Vault / env vars |
| 3 | No skipping database migrations (Immutable Constraint 5) | ✅ PASS | New columns/tables via Alembic |
| 4 | API backward compatibility (Immutable Constraint 6) | ✅ PASS | All new endpoints under `/api/v1/` — no existing endpoints modified |
| 5 | Log security-relevant events (Immutable Constraint 8) | ✅ PASS | Purchases, assignments, invitations logged in audit trail |
| 6 | YAGNI — build only what is specified (Immutable Constraint 11) | ✅ PASS | No multi-currency, no waitlist, no ticket transfer between purchasers |
| 7 | CI must pass: ruff, mypy strict, pytest (Constitution §Code Quality) | ✅ PASS | Enforced per CI config |
| 8 | Type hints + Pydantic on all boundaries (Constitution §Type Safety) | ✅ PASS | All API models are Pydantic; all services fully typed |
| 9 | HTTPS/TLS everywhere (Immutable Constraint 9) | ✅ PASS | All endpoints HTTPS; HPF iframe over HTTPS |
| 10 | Audit log for all sensitive actions (Immutable Constraint 8) | ✅ PASS | ticket_audit_log captures purchases, assignments, cancellations |

**Constitution Check Result**: ✅ ALL GATES PASS — proceed to Phase 0 research.

## Project Structure

### Documentation (this feature)

```
.specify/specs/036-ticket-purchasing/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── public-tickets.md
│   ├── ticket-purchases.md
│   ├── ticket-assignments.md
│   └── ticket-invitations.md
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```
backend/
├── app/
│   ├── models/
│   │   └── ticket_management.py        # MODIFY — add ticket_assignments table, max_tickets_per_donor to events
│   ├── schemas/
│   │   └── ticket_purchasing.py        # NEW — Pydantic models for purchasing/assignment flows
│   ├── services/
│   │   ├── ticket_purchasing_service.py    # NEW — cart checkout, purchase creation, inventory tracking
│   │   ├── ticket_assignment_service.py    # NEW — assignment CRUD, self-registration, cancellation
│   │   └── ticket_invitation_service.py    # NEW — invitation email sending, token generation/validation
│   └── api/
│       └── v1/
│           ├── public_tickets.py           # NEW — unauthenticated ticket browsing
│           ├── ticket_purchases.py         # NEW — authenticated checkout, purchase history
│           ├── ticket_assignments.py       # NEW — ticket assignment CRUD
│           └── ticket_invitations.py       # NEW — invitation sending, registration via invite
└── alembic/
    └── versions/
        └── xxx_add_ticket_purchasing.py    # NEW — migration for new tables/columns

frontend/
└── donor-pwa/
    └── src/
        ├── routes/
        │   ├── events.$slug.tickets.tsx            # MODIFY — replace stub with ticket listing page
        │   └── events.$slug.tickets.checkout.tsx   # MODIFY — extend to multi-package cart checkout
        ├── features/
        │   └── tickets/
        │       ├── TicketPackageList.tsx            # NEW — browsable ticket package cards
        │       ├── TicketCart.tsx                   # NEW — cart sidebar/drawer with quantity controls
        │       ├── CartCheckout.tsx                 # NEW — multi-step checkout flow
        │       ├── SponsorshipInfoForm.tsx          # NEW — sponsor details form for sponsorship packages
        │       ├── TicketInventory.tsx              # NEW — my tickets dashboard
        │       ├── TicketAssignmentForm.tsx         # NEW — assign ticket to guest form
        │       ├── TicketAssignmentCard.tsx         # NEW — card showing assignment status
        │       └── InvitationRegistration.tsx       # NEW — registration flow from invitation link
        ├── stores/
        │   └── ticket-cart-store.ts                # NEW — Zustand store for cart state (localStorage)
        └── lib/
            └── api/
                ├── ticket-purchases.ts             # NEW — purchase API client
                ├── ticket-assignments.ts           # NEW — assignment API client
                └── ticket-invitations.ts           # NEW — invitation API client
```

**Structure Decision**: Web application (backend + frontend). Extends existing backend models and donor PWA routes. No new projects or packages — all changes within existing `backend/` and `frontend/donor-pwa/` directories.
