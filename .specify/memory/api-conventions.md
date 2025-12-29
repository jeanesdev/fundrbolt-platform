# Fundrbolt API Conventions

## REST Endpoints

### URL Structure
`/api/v1/{resource}/{id}/{sub-resource}`

**Examples:**
- `GET /api/v1/events` - List all events
- `GET /api/v1/events/{event_id}` - Get single event
- `POST /api/v1/events` - Create event
- `PUT /api/v1/events/{event_id}` - Update event
- `DELETE /api/v1/events/{event_id}` - Delete event
- `GET /api/v1/events/{event_id}/items` - List items for event

### Naming Conventions
- Resources: plural nouns (`events`, `items`, `bids`)
- Use kebab-case for multi-word resources (`auction-items`)
- IDs: UUIDs, not integers
- Timestamps: ISO 8601 format (`2025-10-16T21:38:00Z`)

### HTTP Status Codes
- `200 OK` - Success (GET, PUT, PATCH)
- `201 Created` - Success (POST)
- `204 No Content` - Success (DELETE)
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Missing/invalid token
- `403 Forbidden` - Valid token, insufficient permissions
- `404 Not Found` - Resource doesn't exist
- `409 Conflict` - Business rule violation (e.g., bid too low)
- `422 Unprocessable Entity` - Pydantic validation error
- `500 Internal Server Error` - Unexpected server error

### Request/Response Format
**Request:**
```

{
"name": "Spring Gala 2025",
"date": "2025-05-15T18:00:00Z",
"venue": "Grand Ballroom"
}

```

**Response (Success):**
```

{
"id": "550e8400-e29b-41d4-a716-446655440000",
"name": "Spring Gala 2025",
"date": "2025-05-15T18:00:00Z",
"venue": "Grand Ballroom",
"created_at": "2025-10-16T21:38:00Z",
"updated_at": "2025-10-16T21:38:00Z"
}

```

**Response (Error):**
```

{
"error": {
"code": "INVALID_BID_AMOUNT",
"message": "Bid must be at least \$150 (current high bid \$125 + increment \$25)",
"field": "amount"
}
}

```

### Authentication
- Header: `Authorization: Bearer {jwt_token}`
- Token expiry: 15 minutes (access), 7 days (refresh)
- Refresh endpoint: `POST /api/v1/auth/refresh`

### Pagination
```

GET /api/v1/items?page=2\&limit=50\&sort=created_at\&order=desc

```

**Response:**
```

{
"items": [...],
"pagination": {
"page": 2,
"limit": 50,
"total": 250,
"pages": 5
}
}

```

### Filtering
```

GET /api/v1/items?status=active\&min_bid=100\&max_bid=500

```

## WebSocket Events

### Client → Server
- `join_event` - Join event room
- `place_bid` - Place bid on item
- `raise_paddle` - Signal intent to bid (live auction)

### Server → Client
- `bid_placed` - Someone placed a bid
- `item_sold` - Auction closed for item
- `outbid` - You were outbid
- `you_won` - You won the item
- `leaderboard_update` - Top bidders changed

**Event Payload:**
```

{
"event": "bid_placed",
"data": {
"item_id": "abc-123",
"bid_amount": 500,
"bidder_paddle": 42,
"timestamp": "2025-10-16T21:40:00Z"
}
}

```
