# Data Model: Ticket Purchasing & Assignment

**Date**: 2026-03-12 | **Feature**: 036-ticket-purchasing

## Entity-Relationship Overview

```
Events (existing)
  ├── TicketPackage (1:N) [existing]
  │     ├── CustomTicketOption (1:N) [existing]
  │     └── TicketPurchase (1:N) [existing]
  │           ├── AssignedTicket (1:N) [existing]
  │           │     ├── TicketAssignment (1:1) [NEW]
  │           │     └── OptionResponse (1:N) [existing]
  │           └── PromoCodeApplication (1:1 optional) [existing]
  ├── Sponsor (1:N) [existing — created by sponsorship package purchase]
  └── max_tickets_per_donor [NEW column]

Users (existing)
  ├── TicketPurchase (1:N as purchaser) [existing]
  ├── TicketAssignment (1:N as assignee) [NEW]
  ├── EventRegistration (1:N) [existing — created on guest registration]
  └── RegistrationGuest (1:N) [existing — linked on registration]

TicketAssignment [NEW]
  ├── AssignedTicket (1:1) [existing]
  ├── User (0:1 as assignee) [existing — linked when guest registers]
  └── TicketInvitation (0:N) [NEW — invitation emails sent]
```

## Database Table Changes

### 1. events (MODIFY — add column)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `max_tickets_per_donor` | INTEGER | NULLABLE, CHECK (>= 1) | Max total tickets a single donor can purchase for this event. NULL = unlimited. Default: 20 |

### 2. ticket_assignments (NEW)

Links an assigned ticket to a guest with invitation and registration tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `assigned_ticket_id` | UUID | FOREIGN KEY (assigned_tickets.id) ON DELETE CASCADE, NOT NULL, UNIQUE | The individual ticket being assigned |
| `ticket_purchase_id` | UUID | FOREIGN KEY (ticket_purchases.id) ON DELETE CASCADE, NOT NULL, INDEX | The purchase this assignment belongs to |
| `event_id` | UUID | FOREIGN KEY (events.id) ON DELETE CASCADE, NOT NULL, INDEX | Event for denormalized queries |
| `assigned_by_user_id` | UUID | FOREIGN KEY (users.id) ON DELETE SET NULL, INDEX | The purchaser who made this assignment |
| `guest_name` | VARCHAR(200) | NOT NULL | Name of the assigned guest |
| `guest_email` | VARCHAR(254) | NOT NULL | Email of the assigned guest |
| `assignee_user_id` | UUID | FOREIGN KEY (users.id) ON DELETE SET NULL, NULLABLE, INDEX | The guest's user account (linked after registration) |
| `registration_id` | UUID | FOREIGN KEY (event_registrations.id) ON DELETE SET NULL, NULLABLE | Guest's event registration (linked after registration) |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'assigned', CHECK IN ('assigned', 'invited', 'registered', 'cancelled') | Assignment lifecycle state |
| `invitation_sent_at` | TIMESTAMP WITH TIME ZONE | NULLABLE | When the invitation email was last sent |
| `invitation_count` | INTEGER | NOT NULL, DEFAULT 0 | Number of invitation emails sent |
| `registered_at` | TIMESTAMP WITH TIME ZONE | NULLABLE | When the guest completed registration |
| `cancelled_at` | TIMESTAMP WITH TIME ZONE | NULLABLE | When the assignment was cancelled |
| `cancelled_by` | VARCHAR(20) | NULLABLE, CHECK IN ('guest', 'coordinator', 'purchaser') | Who cancelled the assignment |
| `is_self_assignment` | BOOLEAN | NOT NULL, DEFAULT FALSE | Whether the purchaser assigned this ticket to themselves |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_ticket_assignments_purchase` on `ticket_purchase_id`
- `idx_ticket_assignments_event` on `event_id`
- `idx_ticket_assignments_assignee` on `assignee_user_id`
- `idx_ticket_assignments_email_event` on `guest_email, event_id`
- `idx_ticket_assignments_status` on `event_id, status`

**Constraints**:
- `UNIQUE (assigned_ticket_id)` — one assignment per ticket at a time
- `status` transitions: `assigned` → `invited` (on email send) → `registered` (on registration) or → `cancelled` (on cancel)

**State Transitions**:
```
[unassigned] → assigned → invited → registered
                  │           │
                  └───────────┴──→ cancelled → [unassigned]
```

### 3. ticket_invitations (NEW)

Audit trail of invitation emails sent for ticket assignments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `assignment_id` | UUID | FOREIGN KEY (ticket_assignments.id) ON DELETE CASCADE, NOT NULL, INDEX | The assignment this invitation belongs to |
| `email_address` | VARCHAR(254) | NOT NULL | Email address invitation was sent to |
| `invitation_token` | VARCHAR(500) | NOT NULL, UNIQUE | HMAC-signed token for the registration link |
| `token_expires_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | Token expiration (event date + 24 hours) |
| `sent_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | When the email was sent |
| `opened_at` | TIMESTAMP WITH TIME ZONE | NULLABLE | When the invitation link was first clicked |
| `registered_at` | TIMESTAMP WITH TIME ZONE | NULLABLE | When registration was completed through this invitation |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Indexes**:
- `idx_ticket_invitations_assignment` on `assignment_id`
- `idx_ticket_invitations_token` on `invitation_token`

### 4. ticket_purchases (MODIFY — add columns)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `sponsorship_sponsor_id` | UUID | FOREIGN KEY (sponsors.id) ON DELETE SET NULL, NULLABLE | Sponsor entry created for sponsorship package purchases |

### 5. assigned_tickets (MODIFY — add columns)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `assignment_status` | VARCHAR(20) | NOT NULL, DEFAULT 'unassigned', CHECK IN ('unassigned', 'assigned', 'registered') | Quick-access assignment status (denormalized from ticket_assignments). Note: 'invited' and 'cancelled' states from ticket_assignments map to 'assigned' and 'unassigned' respectively in this simplified column for fast queries. |

## Existing Tables Referenced (no modifications)

- **ticket_packages**: Package definitions with `is_sponsorship` flag, `quantity_limit`, `sold_count`, `seats_per_package`
- **custom_ticket_options**: Custom questions per package (up to 4)
- **option_responses**: Guest responses to custom questions
- **promo_codes / promo_code_applications**: Discount code system
- **sponsors**: Event sponsor entries with logo, website, contact info
- **event_registrations**: Event registration linking user to event
- **registration_guests**: Individual guest records with meal selections
- **payment_transactions**: Payment records (linked from ticket_purchases)
- **payment_profiles**: Saved payment methods
