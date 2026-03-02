# Fundrbolt Error Handling

## Error Code Standards

### Format
`CATEGORY_SPECIFIC_ERROR`

### Categories
- `AUTH_*` - Authentication/authorization
- `VALIDATION_*` - Input validation
- `BUSINESS_*` - Business rule violations
- `SYSTEM_*` - Infrastructure/system errors

### Examples
- `AUTH_INVALID_TOKEN` - JWT token expired or malformed
- `AUTH_INSUFFICIENT_PERMISSIONS` - User lacks required role
- `VALIDATION_REQUIRED_FIELD` - Required field missing
- `VALIDATION_INVALID_FORMAT` - Field format incorrect (e.g., email)
- `BUSINESS_BID_TOO_LOW` - Bid doesn't meet minimum
- `BUSINESS_AUCTION_CLOSED` - Can't bid on closed auction
- `SYSTEM_DATABASE_ERROR` - Database connection failed
- `SYSTEM_EXTERNAL_SERVICE_ERROR` - Stripe/Twilio API failed

## Logging Approach

### What to Log
- All errors (ERROR, CRITICAL levels)
- All auth events (login, logout, failed auth)
- All bids placed
- All payment transactions
- All admin actions

### What NOT to Log
- Passwords (even hashed)
- Full JWT tokens
- Credit card numbers
- PII in plain text

### Log Format
```

{
"timestamp": "2025-10-16T21:42:00Z",
"level": "ERROR",
"service": "api",
"user_id": "user-123",
"event_id": "event-456",
"trace_id": "abc-xyz",
"message": "Bid placement failed",
"metadata": {
"error_code": "BUSINESS_BID_TOO_LOW",
"item_id": "item-789",
"bid_amount": 100,
"required_amount": 150
}
}

```

### Development (IceCream)
Use `ic()` for quick debugging:
```

from utils.logger import log  \# Central logger

def place_bid(item_id, amount):
ic(item_id, amount)  \# Dev only
log.info("Placing bid", item_id=item_id, amount=amount)  \# Prod

```
