# API Contracts: Auctioneer Dashboard

**Feature**: 038-auctioneer-dashboard
**Date**: 2026-04-04
**Base Path**: `/api/v1`

## Authentication

All endpoints require JWT Bearer token. Responses use standard error format:
```json
{"detail": "Error message"}
```

---

## Auctioneer Item Commissions

### GET /admin/events/{event_id}/auctioneer/commissions

List all commission records for the current auctioneer on this event.

**Access**: Auctioneer (own data), Super Admin (all auctioneers' data)

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| auctioneer_user_id | UUID | (current user) | Super Admin only: view another auctioneer's data |

**Response 200**:
```json
{
  "commissions": [
    {
      "id": "uuid",
      "auction_item_id": "uuid",
      "auction_item_title": "Weekend Getaway",
      "auction_item_bid_number": 101,
      "auction_type": "LIVE",
      "commission_percent": "15.00",
      "flat_fee": "50.00",
      "notes": "High-value item, donor secured",
      "item_status": "PUBLISHED",
      "current_bid_amount": "500.00",
      "quantity_available": 1,
      "cost": "200.00",
      "primary_image_url": "https://...",
      "created_at": "2026-04-04T10:00:00Z",
      "updated_at": "2026-04-04T10:00:00Z"
    }
  ],
  "total": 5
}
```

**Response 403**: User is not auctioneer or super_admin for this event.

---

### PUT /admin/events/{event_id}/auctioneer/commissions/{auction_item_id}

Create or update commission for a specific auction item (upsert).

**Access**: Auctioneer (own data only)

**Request Body**:
```json
{
  "commission_percent": "15.00",
  "flat_fee": "50.00",
  "notes": "High-value item, donor secured"
}
```

**Validation**:
- commission_percent: 0.00–100.00 (required)
- flat_fee: >= 0.00 (required)
- notes: string, max 2000 chars (optional)

**Response 200** (updated):
```json
{
  "id": "uuid",
  "auction_item_id": "uuid",
  "commission_percent": "15.00",
  "flat_fee": "50.00",
  "notes": "High-value item, donor secured",
  "created_at": "2026-04-04T10:00:00Z",
  "updated_at": "2026-04-04T12:00:00Z"
}
```

**Response 201** (created): Same shape as 200.
**Response 403**: User is not auctioneer for this event.
**Response 404**: Auction item not found in this event.
**Response 422**: Validation error (percent out of range, negative fee).

---

### DELETE /admin/events/{event_id}/auctioneer/commissions/{auction_item_id}

Remove commission record for an auction item.

**Access**: Auctioneer (own data only)

**Response 204**: Deleted successfully.
**Response 403**: User is not auctioneer for this event.
**Response 404**: Commission record not found.

---

## Auctioneer Event Settings

### GET /admin/events/{event_id}/auctioneer/settings

Get the auctioneer's category-level earning percentages for this event.

**Access**: Auctioneer (own data), Super Admin (specify auctioneer_user_id)

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| auctioneer_user_id | UUID | (current user) | Super Admin only |

**Response 200**:
```json
{
  "auctioneer_user_id": "uuid",
  "event_id": "uuid",
  "live_auction_percent": "5.00",
  "paddle_raise_percent": "3.00",
  "silent_auction_percent": "4.00",
  "created_at": "2026-04-04T10:00:00Z",
  "updated_at": "2026-04-04T12:00:00Z"
}
```

**Response 200** (no settings yet): Returns defaults (all 0.00).
**Response 403**: User is not auctioneer or super_admin for this event.

---

### PUT /admin/events/{event_id}/auctioneer/settings

Create or update category-level earning percentages (upsert).

**Access**: Auctioneer (own data only)

**Request Body**:
```json
{
  "live_auction_percent": "5.00",
  "paddle_raise_percent": "3.00",
  "silent_auction_percent": "4.00"
}
```

**Validation**: Each percentage 0.00–100.00.

**Response 200**: Updated settings (same shape as GET response).
**Response 403**: User is not auctioneer for this event.
**Response 422**: Validation error.

---

## Auctioneer Dashboard

### GET /admin/events/{event_id}/auctioneer/dashboard

Get the full dashboard data: earnings summary, event revenue totals, and countdown timers.

**Access**: Auctioneer (own data), Super Admin (specify auctioneer_user_id)

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| auctioneer_user_id | UUID | (current user) | Super Admin only |

**Response 200**:
```json
{
  "earnings": {
    "per_item_total": "1250.00",
    "per_item_count": 5,
    "live_auction_category_earning": "500.00",
    "paddle_raise_category_earning": "150.00",
    "silent_auction_category_earning": "200.00",
    "total_earnings": "2100.00"
  },
  "event_totals": {
    "live_auction_raised": "10000.00",
    "paddle_raise_raised": "5000.00",
    "silent_auction_raised": "5000.00",
    "event_total_raised": "20000.00"
  },
  "timers": {
    "live_auction_start_datetime": "2026-04-05T19:00:00-05:00",
    "auction_close_datetime": "2026-04-05T21:00:00-05:00",
    "live_auction_status": "not_started",
    "silent_auction_status": "open"
  },
  "last_refreshed_at": "2026-04-04T12:00:00Z"
}
```

`live_auction_status`: `not_started` | `in_progress` | `ended` | `not_scheduled`
`silent_auction_status`: `open` | `closed` | `not_scheduled`

**Response 403**: User is not auctioneer or super_admin for this event.

---

## Live Auction Tab

### GET /admin/events/{event_id}/auctioneer/live-auction

Get the current live auction item and its bid history.

**Access**: Auctioneer, Super Admin

**Response 200**:
```json
{
  "current_item": {
    "id": "uuid",
    "bid_number": 101,
    "title": "Weekend Getaway",
    "description": "Luxury resort...",
    "starting_bid": "100.00",
    "current_bid_amount": "500.00",
    "bid_count": 8,
    "primary_image_url": "https://...",
    "donor_value": "1500.00",
    "cost": "200.00"
  },
  "high_bidder": {
    "bidder_number": 142,
    "first_name": "Jane",
    "last_name": "Doe",
    "table_number": 5,
    "profile_picture_url": "https://..."
  },
  "bid_history": [
    {
      "bidder_number": 142,
      "bidder_name": "Jane Doe",
      "bid_amount": "500.00",
      "placed_at": "2026-04-05T19:32:15-05:00"
    },
    {
      "bidder_number": 107,
      "bidder_name": "John Smith",
      "bid_amount": "450.00",
      "placed_at": "2026-04-05T19:31:45-05:00"
    }
  ],
  "auction_status": "in_progress"
}
```

**Response 200** (no active item):
```json
{
  "current_item": null,
  "high_bidder": null,
  "bid_history": [],
  "auction_status": "not_started"
}
```

**Response 403**: User is not auctioneer or super_admin for this event.

---

## Auctioneer Invitation (Extension of existing endpoint)

### POST /admin/npos/{npo_id}/invitations

Existing endpoint — extend to accept `role: "auctioneer"` and optional `event_id`.

**Request Body** (updated):
```json
{
  "email": "auctioneer@example.com",
  "first_name": "Mike",
  "last_name": "Gavel",
  "role": "auctioneer",
  "event_id": "uuid"
}
```

**Changes**: When `role == "auctioneer"`, `event_id` is required (auctioneer is always event-scoped). The event_id is embedded in the JWT token payload for use during invitation acceptance.

---

## WebSocket Events (Socket.IO)

### Event: `auction:bid_placed`

Emitted to room `event:{event_id}` when a bid is placed on a live auction item.

**Payload**:
```json
{
  "event_id": "uuid",
  "auction_item_id": "uuid",
  "bid": {
    "bidder_number": 142,
    "bidder_name": "Jane Doe",
    "bid_amount": "500.00",
    "placed_at": "2026-04-05T19:32:15-05:00"
  },
  "high_bidder": {
    "bidder_number": 142,
    "first_name": "Jane",
    "last_name": "Doe",
    "table_number": 5,
    "profile_picture_url": "https://..."
  },
  "current_bid_amount": "500.00",
  "bid_count": 8
}
```

### Event: `auction:item_changed`

Emitted to room `event:{event_id}` when the current live auction item changes.

**Payload**:
```json
{
  "event_id": "uuid",
  "current_item_id": "uuid",
  "previous_item_id": "uuid"
}
```
