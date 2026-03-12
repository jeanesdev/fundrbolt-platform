# API Contract: Public Ticket Browsing

**Feature**: 036-ticket-purchasing | **Date**: 2026-03-12

## Endpoints

### GET /api/v1/events/{event_slug}/tickets

**Purpose**: List available ticket packages for an event (public, no auth required).

**Parameters**:
- `event_slug` (path, required): Event URL slug

**Response 200**:
```json
{
  "event": {
    "id": "uuid",
    "name": "Annual Gala 2026",
    "slug": "annual-gala-2026",
    "date": "2026-06-15T18:00:00Z",
    "venue": "Grand Ballroom",
    "description": "Join us for an evening of...",
    "banner_image_url": "https://...",
    "ticket_sales_open": true,
    "ticket_sales_message": null
  },
  "packages": [
    {
      "id": "uuid",
      "name": "Individual Ticket",
      "description": "Single seat with dinner and open bar",
      "price": "150.00",
      "seats_per_package": 1,
      "quantity_remaining": 45,
      "is_sold_out": false,
      "is_sponsorship": false,
      "image_url": "https://...",
      "display_order": 0,
      "custom_options": [
        {
          "id": "uuid",
          "label": "Meal preference",
          "option_type": "multi_select",
          "choices": ["Chicken", "Beef", "Vegan"],
          "is_required": true
        }
      ]
    }
  ]
}
```

**Response 404**: Event not found
**Response 200 (no packages)**: `packages` array is empty; `ticket_sales_open` may be `false` with optional `ticket_sales_message`
