# Quickstart: Ticket Purchasing & Assignment

**Feature**: 036-ticket-purchasing | **Date**: 2026-03-12

## Overview

This guide provides step-by-step instructions for implementing the ticket purchasing and assignment feature. Follow these phases sequentially.

## Prerequisites

- ✅ Branch `036-ticket-purchasing` checked out
- ✅ Backend dependencies installed (`cd backend && poetry install`)
- ✅ Frontend dependencies installed (`cd frontend/donor-pwa && pnpm install`)
- ✅ PostgreSQL and Redis running locally (via `docker-compose up`)
- ✅ Existing features operational: ticket management (015), payment processing (033), registration (010), sponsors (007)

## Phase 1: Database Schema & Models

### 1.1 Create Database Migration

```bash
cd backend
poetry run alembic revision -m "add ticket purchasing and assignment tables"
```

**Migration Content**:
- Add `max_tickets_per_donor` column to `events` table (INTEGER, NULLABLE, DEFAULT 20)
- Create `ticket_assignments` table (see data-model.md)
- Create `ticket_invitations` table (see data-model.md)
- Add `sponsorship_sponsor_id` column to `ticket_purchases` table
- Add `assignment_status` column to `assigned_tickets` table
- Add indexes on all foreign keys and query filters

```bash
poetry run alembic upgrade head
```

### 1.2 Update SQLAlchemy Models

- Update `backend/app/models/ticket_management.py` — add TicketAssignment, TicketInvitation models
- Update `backend/app/models/event.py` — add `max_tickets_per_donor` column
- Add relationships: `assigned_ticket.assignment`, `ticket_purchase.assignments`

### 1.3 Create Pydantic Schemas

- Create `backend/app/schemas/ticket_purchasing.py` — request/response models for all endpoints

## Phase 2: Backend Services & API

### 2.1 Ticket Purchasing Service

Create `backend/app/services/ticket_purchasing_service.py`:
- `validate_cart()` — check inventory, promo codes, per-donor limits
- `checkout()` — create purchases, assigned tickets, process payment, create sponsors
- `get_purchases()` — list donor's purchases for an event
- `get_inventory()` — list all tickets across events
- `get_purchase_history()` — paginated purchase history

### 2.2 Ticket Assignment Service

Create `backend/app/services/ticket_assignment_service.py`:
- `assign_ticket()` — assign ticket to guest, detect self-assignment
- `update_assignment()` — reassign to different guest
- `cancel_assignment()` — cancel and return to unassigned
- `self_register()` — complete registration for self-assigned tickets
- `cancel_registration()` — cancel guest registration, return ticket

### 2.3 Ticket Invitation Service

Create `backend/app/services/ticket_invitation_service.py`:
- `send_invitation()` — generate token, send email
- `resend_invitation()` — resend with rate limiting
- `validate_token()` — verify HMAC token, check expiry
- `register_via_invitation()` — complete registration from invitation link

### 2.4 API Endpoints

Create API route files:
- `backend/app/api/v1/public_tickets.py` — public ticket browsing
- `backend/app/api/v1/ticket_purchases.py` — checkout, purchase history
- `backend/app/api/v1/ticket_assignments.py` — assignment CRUD
- `backend/app/api/v1/ticket_invitations.py` — invitation sending, token registration

## Phase 3: Donor PWA Frontend

### 3.1 Cart Store

Create `frontend/donor-pwa/src/stores/ticket-cart-store.ts`:
- Zustand store with localStorage persistence
- Cart items: `{ packageId, quantity }`
- Methods: `addItem`, `removeItem`, `updateQuantity`, `clearCart`, `getTotal`
- Per-event scoping

### 3.2 Ticket Listing Page

Update `frontend/donor-pwa/src/routes/events.$slug.tickets.tsx`:
- Replace stub with full ticket package listing
- Show event details + package cards with prices
- "Buy Tickets" CTA → auth check → redirect to checkout

### 3.3 Cart & Checkout

Update `frontend/donor-pwa/src/routes/events.$slug.tickets.checkout.tsx`:
- Multi-step checkout: Package Selection → Sponsorship Details (if applicable) → Payment → Confirmation
- Cart summary sidebar
- Promo code input
- Payment via existing PaymentMethodSelector + HPF

### 3.4 Ticket Inventory & Assignment

Create ticket inventory components:
- `TicketInventory.tsx` — my tickets dashboard
- `TicketAssignmentForm.tsx` — assign ticket to guest
- `TicketAssignmentCard.tsx` — show assignment status
- Add route for ticket inventory page

### 3.5 Invitation Registration

Create invitation registration flow:
- Route for `/invite/{token}` — validate token, prompt account creation/sign-in
- Registration form with meal selection + custom ticket options
- Confirmation screen

### 3.6 Landing Page Updates

Update authenticated home page:
- Show ticket inventory for donors with no registrations
- CTA to assign tickets or browse events

## Verification

After implementation, verify each user story independently:

1. **US1**: Navigate to event as anonymous user → see packages and prices
2. **US2**: Log in → add packages to cart → apply promo → checkout → see confirmation
3. **US3**: View inventory → assign ticket to guest → assign to self → complete self-registration
4. **US4**: Send invitation → click link in email → create account → register → see event
5. **US5**: Add sponsorship package → fill sponsor details → checkout → see sponsor on event page
6. **US6**: Log in with no registrations → see ticket inventory dashboard
7. **US7**: Resend invitation → cancel assignment → reassign
8. **US8**: View purchase history → download receipt
