# API Contract: Ticket Purchases

**Feature**: 036-ticket-purchasing | **Date**: 2026-03-12

## Endpoints

### POST /api/v1/events/{event_id}/tickets/checkout

**Purpose**: Submit a multi-package cart for checkout. Creates TicketPurchase records, AssignedTicket entries, processes payment, and optionally creates Sponsor entries for sponsorship packages.

**Auth**: Required (Bearer token)

**Request Body**:
```json
{
  "items": [
    {
      "package_id": "uuid",
      "quantity": 2
    }
  ],
  "promo_code": "EARLYBIRD",
  "payment_profile_id": "uuid",
  "idempotency_key": "uuid",
  "sponsorship_details": [
    {
      "package_id": "uuid",
      "company_name": "Acme Corp",
      "website_url": "https://acme.com",
      "contact_name": "Jane Doe",
      "contact_email": "jane@acme.com",
      "logo_blob_name": "uploads/temp/logo-abc123.png"
    }
  ]
}
```

**Response 201**:
```json
{
  "order_id": "uuid",
  "purchases": [
    {
      "id": "uuid",
      "package_name": "Individual Ticket",
      "quantity": 2,
      "unit_price": "150.00",
      "line_total": "300.00",
      "assigned_tickets": [
        { "id": "uuid", "ticket_number": "T-001", "qr_code": "uuid" },
        { "id": "uuid", "ticket_number": "T-002", "qr_code": "uuid" }
      ]
    }
  ],
  "promo_discount": "30.00",
  "total_amount": "270.00",
  "payment_status": "completed",
  "transaction_id": "uuid",
  "sponsors_created": ["uuid"]
}
```

**Response 400**: Validation errors (invalid package, quantity exceeds limit, invalid promo code)
**Response 409**: Quantity exceeds per-donor event cap
**Response 402**: Payment failed

### GET /api/v1/events/{event_id}/tickets/purchases

**Purpose**: List the authenticated donor's ticket purchases for an event.

**Auth**: Required

**Response 200**:
```json
{
  "purchases": [
    {
      "id": "uuid",
      "package_name": "Individual Ticket",
      "quantity": 2,
      "total_price": "270.00",
      "payment_status": "completed",
      "purchased_at": "2026-03-10T14:30:00Z",
      "assigned_tickets": [
        {
          "id": "uuid",
          "ticket_number": "T-001",
          "assignment_status": "unassigned",
          "assignment": null
        },
        {
          "id": "uuid",
          "ticket_number": "T-002",
          "assignment_status": "assigned",
          "assignment": {
            "guest_name": "John Smith",
            "guest_email": "john@example.com",
            "status": "invited"
          }
        }
      ]
    }
  ],
  "total_tickets": 4,
  "assigned_count": 1,
  "registered_count": 0,
  "unassigned_count": 3
}
```

### GET /api/v1/tickets/my-inventory

**Purpose**: List all the authenticated donor's tickets across all events (for the landing page).

**Auth**: Required

**Response 200**:
```json
{
  "events": [
    {
      "event_id": "uuid",
      "event_name": "Annual Gala 2026",
      "event_slug": "annual-gala-2026",
      "event_date": "2026-06-15T18:00:00Z",
      "total_tickets": 4,
      "assigned_count": 1,
      "registered_count": 0,
      "unassigned_count": 3
    }
  ]
}
```

### GET /api/v1/tickets/purchase-history

**Purpose**: List all purchase history for the authenticated donor with receipt access.

**Auth**: Required

**Query Params**: `page`, `per_page`

**Response 200**:
```json
{
  "purchases": [
    {
      "id": "uuid",
      "event_name": "Annual Gala 2026",
      "packages": [{ "name": "Individual Ticket", "quantity": 2 }],
      "promo_code": "EARLYBIRD",
      "promo_discount": "30.00",
      "total_amount": "270.00",
      "payment_status": "completed",
      "purchased_at": "2026-03-10T14:30:00Z",
      "receipt_url": "/api/v1/payments/transactions/uuid/receipt"
    }
  ],
  "total_count": 5,
  "page": 1,
  "per_page": 20
}
```

### POST /api/v1/events/{event_id}/tickets/validate-cart

**Purpose**: Validate cart contents before checkout (check inventory, promo codes, per-donor limits).

**Auth**: Required

**Request Body**:
```json
{
  "items": [
    { "package_id": "uuid", "quantity": 2 }
  ],
  "promo_code": "EARLYBIRD"
}
```

**Response 200**:
```json
{
  "valid": true,
  "items": [
    {
      "package_id": "uuid",
      "package_name": "Individual Ticket",
      "quantity": 2,
      "unit_price": "150.00",
      "line_total": "300.00",
      "available": true,
      "remaining_quantity": 45
    }
  ],
  "promo": {
    "code": "EARLYBIRD",
    "valid": true,
    "discount_type": "percentage",
    "discount_value": "10.00",
    "discount_amount": "30.00"
  },
  "subtotal": "300.00",
  "discount": "30.00",
  "total": "270.00",
  "donor_ticket_count_after": 6,
  "donor_ticket_limit": 20,
  "warnings": []
}
```

### POST /api/v1/events/{event_id}/tickets/sponsorship-logo

**Purpose**: Upload a sponsor logo during checkout (before payment).

**Auth**: Required

**Request**: Multipart form with `logo` file field

**Response 200**:
```json
{
  "blob_name": "uploads/temp/logo-abc123.png",
  "preview_url": "https://storage.blob.core.windows.net/..."
}
```
