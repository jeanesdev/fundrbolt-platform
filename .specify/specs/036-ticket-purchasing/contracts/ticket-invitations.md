# API Contract: Ticket Invitations

**Feature**: 036-ticket-purchasing | **Date**: 2026-03-12

## Endpoints

### POST /api/v1/tickets/assignments/{assignment_id}/invite

**Purpose**: Send an invitation email to the assigned guest.

**Auth**: Required (must be the ticket purchaser)

**Request Body** (optional):
```json
{
  "personal_message": "Looking forward to seeing you there!"
}
```

**Response 200**:
```json
{
  "assignment_id": "uuid",
  "status": "invited",
  "invitation_sent_at": "2026-03-10T14:35:00Z",
  "invitation_count": 1
}
```

**Response 400**: No guest assigned to this ticket
**Response 429**: Too many invitations sent (rate limit: max 5 per assignment)

### POST /api/v1/tickets/assignments/{assignment_id}/resend-invite

**Purpose**: Resend the invitation email to a guest who hasn't registered yet.

**Auth**: Required (must be the ticket purchaser)

**Response 200**: Same as invite response with incremented `invitation_count`
**Response 409**: Guest has already registered

### GET /api/v1/tickets/invitations/{token}/validate

**Purpose**: Validate an invitation token from an email link (public endpoint).

**Response 200**:
```json
{
  "valid": true,
  "event": {
    "id": "uuid",
    "name": "Annual Gala 2026",
    "slug": "annual-gala-2026",
    "date": "2026-06-15T18:00:00Z"
  },
  "guest_name": "John Smith",
  "guest_email": "john@example.com",
  "inviter_name": "Sarah Johnson",
  "package_name": "Individual Ticket",
  "requires_account": true
}
```

**Response 400**: Token expired or invalid
**Response 409**: Already registered

### POST /api/v1/tickets/invitations/{token}/register

**Purpose**: Complete registration through an invitation link. Creates account (if needed), event registration, guest record, and links to the ticket assignment.

**Auth**: Required (guest must be authenticated — create account first, then call this)

**Request Body**:
```json
{
  "meal_selection_id": "uuid",
  "custom_option_responses": [
    { "option_id": "uuid", "response_value": "Chicken" }
  ],
  "phone": "555-0123"
}
```

**Response 201**:
```json
{
  "registration_id": "uuid",
  "assignment_status": "registered",
  "event_slug": "annual-gala-2026",
  "message": "You are registered for Annual Gala 2026!"
}
```

**Response 400**: Invalid token, email mismatch, or missing required fields
**Response 409**: Already registered for this event
