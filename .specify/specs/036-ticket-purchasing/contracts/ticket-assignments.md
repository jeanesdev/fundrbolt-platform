# API Contract: Ticket Assignments

**Feature**: 036-ticket-purchasing | **Date**: 2026-03-12

## Endpoints

### POST /api/v1/tickets/{assigned_ticket_id}/assign

**Purpose**: Assign an unassigned ticket to a guest by name and email.

**Auth**: Required (must be the ticket purchaser)

**Request Body**:
```json
{
  "guest_name": "John Smith",
  "guest_email": "john@example.com"
}
```

**Response 201**:
```json
{
  "id": "uuid",
  "assigned_ticket_id": "uuid",
  "ticket_number": "T-001",
  "guest_name": "John Smith",
  "guest_email": "john@example.com",
  "status": "assigned",
  "is_self_assignment": false,
  "created_at": "2026-03-10T14:30:00Z"
}
```

**Response 400**: Ticket already assigned
**Response 403**: Not the ticket purchaser
**Response 404**: Ticket not found

**Self-assignment detection**: If `guest_email` matches the authenticated user's email, `is_self_assignment` is set to `true`. The client should then redirect to the self-registration flow.

### PATCH /api/v1/tickets/assignments/{assignment_id}

**Purpose**: Update a ticket assignment (reassign to different guest). Only allowed when status is `assigned` or `invited` (not `registered`).

**Auth**: Required (must be the ticket purchaser)

**Request Body**:
```json
{
  "guest_name": "Jane Doe",
  "guest_email": "jane@example.com"
}
```

**Response 200**: Updated assignment object
**Response 409**: Cannot reassign — guest has already registered

### DELETE /api/v1/tickets/assignments/{assignment_id}

**Purpose**: Cancel a ticket assignment, returning the ticket to unassigned.

**Auth**: Required (must be the ticket purchaser OR the assigned guest OR a coordinator)

**Response 200**:
```json
{
  "id": "uuid",
  "status": "cancelled",
  "ticket_status": "unassigned"
}
```

**Response 409**: Cannot cancel — business rule prevents it

### POST /api/v1/tickets/assignments/{assignment_id}/self-register

**Purpose**: Complete self-registration for a ticket the donor assigned to themselves.

**Auth**: Required (must be the assignee)

**Request Body**:
```json
{
  "meal_selection_id": "uuid",
  "custom_option_responses": [
    { "option_id": "uuid", "response_value": "Chicken" }
  ]
}
```

**Response 201**:
```json
{
  "assignment_id": "uuid",
  "registration_id": "uuid",
  "status": "registered",
  "event_slug": "annual-gala-2026"
}
```

### POST /api/v1/tickets/assignments/{assignment_id}/cancel-registration

**Purpose**: Cancel a guest's registration, returning the ticket to unassigned in the purchaser's inventory.

**Auth**: Required (must be the registered guest OR a coordinator)

**Response 200**:
```json
{
  "assignment_id": "uuid",
  "status": "cancelled",
  "ticket_status": "unassigned",
  "cancelled_by": "guest"
}
```
