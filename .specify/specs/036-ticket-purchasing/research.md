# Research: Ticket Purchasing & Assignment

**Date**: 2026-03-12 | **Feature**: 036-ticket-purchasing

## Research Tasks & Findings

### R1: Multi-Package Cart Architecture

**Decision**: Client-side cart stored in Zustand with localStorage persistence.

**Rationale**: Cart state is ephemeral and per-device — no need for server-side storage. Zustand with `persist` middleware (localStorage) survives page refreshes and re-authentication. Cart is scoped per event (one event's cart at a time). On checkout, the entire cart is submitted as a single API request.

**Alternatives considered**:
- Server-side cart (Redis): Adds complexity, cross-device sync unnecessary for this use case
- Session-only (no persistence): Poor UX — cart lost on page refresh
- IndexedDB: Overkill for simple cart data

### R2: Soft Oversell Strategy

**Decision**: Allow purchases to proceed regardless of inventory. Display remaining/available count as guidance only. Flag oversold packages in admin dashboard.

**Rationale**: Per clarification, the platform permits soft overselling. The `sold_count` field on `TicketPackage` is incremented on purchase but is not used as a hard gate. Admin dashboard shows warning badges when `sold_count > quantity_limit`. Coordinators resolve manually (refunds, upgrades, etc.).

**Alternatives considered**:
- Hard inventory check at checkout: Rejected per user preference
- Cart reservation with TTL: Over-engineered for soft oversell model

### R3: Ticket Assignment & Invitation Token Flow

**Decision**: Use signed, time-limited invitation tokens (UUID + HMAC signature) embedded in invitation URLs. Token encodes: assigned_ticket_id, guest_email, event_id, expiry.

**Rationale**: Invitation links must be secure (prevent unauthorized registration), stateless (no server-side token table needed), and time-limited (expire after event date). HMAC signing with a server-side secret prevents token forgery. The token's guest_email is validated against the registering user's email.

**Alternatives considered**:
- Database-stored tokens: Adds a table and cleanup job; unnecessary given HMAC approach
- Magic links (passwordless auth): Different purpose — we need full account creation

### R4: Sponsorship Info Collection During Checkout

**Decision**: Add a "Sponsorship Details" step in the checkout flow that appears only when the cart contains at least one sponsorship-flagged package. Collects: company name (required), logo file (required), website URL (optional), contact name (optional), contact email (optional).

**Rationale**: Sponsor details are part of the purchase commitment and must be collected before payment. The existing `Sponsor` model has all necessary fields. On successful payment, the system creates a `Sponsor` entry linked to the event.

**Alternatives considered**:
- Post-purchase collection: Risk of incomplete sponsor data; worse UX
- Admin-only sponsor creation: Defeats purpose of self-service sponsorship packages

### R5: Custom Ticket Option Responses During Registration

**Decision**: Custom ticket option responses are collected during guest registration, not at purchase time. The registration flow for invited guests includes the package's custom questions alongside meal selection.

**Rationale**: Per clarification, custom questions pertain to individual attendees (e.g., "T-shirt size"), not the purchaser. The purchaser may not know guests' answers. Responses are stored in the existing `OptionResponse` model linked to the `AssignedTicket` and the registering user.

**Alternatives considered**:
- At purchase time: Purchaser may not know guests' preferences
- During assignment: Purchaser still may not know; adds friction to assignment flow

### R6: Per-Event Ticket Cap Configuration

**Decision**: Add a `max_tickets_per_donor` column to the `events` table (nullable integer, default 20). Cart enforces this limit client-side; backend validates at checkout.

**Rationale**: Per clarification, coordinators should be able to set a per-event cap on total tickets a donor can purchase. Default of 20 is reasonable for gala-style events (50-500 attendees). NULL means unlimited.

**Alternatives considered**:
- Platform-wide fixed limit: Too rigid for diverse event sizes
- No limit at all: Risk of bulk-buying abuse

### R7: Self-Registration Flow

**Decision**: When a donor assigns a ticket to themselves (matching their own email), skip the invitation email flow. Instead, immediately redirect to an inline registration form (same as the existing registration flow: personal details + meal selection + custom ticket options).

**Rationale**: Sending yourself an invitation email is unnecessary friction. The system detects self-assignment by comparing the assignment email with the authenticated user's email. After self-registration completes, the ticket status updates to "Registered" and the donor sees the event on their home page.

**Alternatives considered**:
- Always send email (even to self): Poor UX, unnecessary round-trip
- Auto-register without form: Skips meal selection and custom questions

### R8: Guest Registration Cancellation

**Decision**: Both guests and coordinators can cancel registrations. Cancellation returns the ticket to "Unassigned" in the purchaser's inventory. Guest cancels via donor PWA settings; coordinator cancels via admin interface. The cancelled guest loses event access.

**Rationale**: Per clarification, both self-service and coordinator cancellation are supported. The existing `RegistrationGuest.status` field supports a `cancelled` state. When cancelled, the `AssignedTicket` is unlinked from the guest and returned to the purchaser's pool.

**Alternatives considered**:
- No cancellation (permanent lock): Too rigid
- Coordinator-only: Doesn't respect guest autonomy
