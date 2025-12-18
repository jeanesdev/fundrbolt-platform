# API Contracts - Fundrbolt to Fundrbolt Rename

**Date**: 2025-12-17
**Feature**: 013-fundrbolt-to-fundrbolt

## Overview

This document specifies all API-level changes required for the Fundrbolt → Fundrbolt rename. Per the specification, there is **no backward compatibility** maintained; APIs cut over entirely to Fundrbolt naming.

---

## REST API Changes

### Response Headers

All API responses MUST include updated branding headers:

**Before**:
```http
X-Powered-By: Fundrbolt Platform
X-API-Title: Fundrbolt Fundraising API
```

**After**:
```http
X-Powered-By: Fundrbolt Platform
X-API-Title: Fundrbolt Fundraising API
```

**Location**: Update in `app/middleware/response_headers.py` or relevant middleware that sets these headers.

---

### OpenAPI Documentation

**Endpoint**: `GET /openapi.json` and `GET /docs`

**Changes**:

```yaml
openapi: 3.0.2
info:
  title: "Fundrbolt Platform API"  # was "Fundrbolt Platform API"
  description: "Fundrbolt fundraising platform API for nonprofits and auctioneers"  # updated
  version: "1.0.0"
  contact:
    name: "Fundrbolt Support"  # was "Fundrbolt Support"
    email: "support@fundrbolt.app"  # was "support@fundrbolt.app"
  license:
    name: "Proprietary"
```

**Location**: Update FastAPI instantiation in `app/main.py`:

```python
app = FastAPI(
    title="Fundrbolt Platform API",
    description="Fundrbolt fundraising platform API for nonprofits and auctioneers",
    contact={
        "name": "Fundrbolt Support",
        "email": "support@fundrbolt.app",
        "url": "https://fundrbolt.app",
    },
    version="1.0.0",
)
```

---

### Endpoint Paths & Parameters

**No changes** to endpoint paths, methods, or parameter names.

**Example** (unchanged):
```http
GET /api/v1/events
POST /api/v1/auth/login
PUT /api/v1/bids/{bid_id}
```

---

### Response Body Structure

**No changes** to response body structure; all field names remain unchanged.

**Example** (unchanged):
```json
{
  "id": "event-123",
  "name": "Annual Gala 2025",
  "status": "active",
  "created_at": "2025-01-15T10:00:00Z"
}
```

---

### Error Responses

**Status codes and error formats unchanged.**

Error messages MAY be updated to reflect Fundrbolt branding:

**Before**:
```json
{
  "detail": "Unauthorized. Please log in to Fundrbolt."
}
```

**After**:
```json
{
  "detail": "Unauthorized. Please log in to Fundrbolt."
}
```

**Recommendation**: Keep error messages generic and avoid brand names where possible.

---

## WebSocket Changes

### Socket.IO Namespaces

**No changes** to namespace structure.

**Example** (unchanged):
```
/socket.io/?transport=websocket&sid=...
```

### Socket.IO Metadata

**Metadata in connection responses MAY include updated branding**:

**Before**:
```json
{
  "app": "Fundrbolt",
  "version": "1.0.0"
}
```

**After**:
```json
{
  "app": "Fundrbolt",
  "version": "1.0.0"
}
```

---

## Authentication & Authorization

### JWT Claims

**No changes** to JWT structure; claims remain unchanged.

However, if JWT includes any `iss` (issuer) or `aud` (audience) claims with Fundrbolt references, update:

**Before**:
```json
{
  "iss": "https://fundrbolt.app",
  "aud": "fundrbolt-api",
  "sub": "user-123"
}
```

**After**:
```json
{
  "iss": "https://fundrbolt.app",
  "aud": "fundrbolt-api",
  "sub": "user-123"
}
```

**Location**: Update in `app/core/security.py` or JWT creation code.

### Session Cookies

**No changes** to cookie structure; names remain unchanged.

If cookie is named `fundrbolt_session`, consider renaming to `fundrbolt_session` (optional):

**Location**: Update in `app/middleware/sessions.py`.

---

## Rate Limiting & Throttling

**No changes** to rate limit headers or thresholds.

Response headers (e.g., `X-RateLimit-Remaining`) remain unchanged in format.

---

## External Service Integration

### Email Service

**Sender name update**:

**Before**:
```
From: Fundrbolt Support <noreply@fundrbolt.app>
Subject: Welcome to Fundrbolt
```

**After**:
```
From: Fundrbolt Support <noreply@fundrbolt.app>
Subject: Welcome to Fundrbolt
```

**Location**: Update in email templates (e.g., SendGrid, Azure Communication Services).

### Webhooks

**Webhook payloads MAY be updated** to reflect Fundrbolt branding in metadata:

**Before**:
```json
{
  "event": "bid.placed",
  "app": "fundrbolt",
  "timestamp": "2025-12-17T10:00:00Z"
}
```

**After**:
```json
{
  "event": "bid.placed",
  "app": "fundrbolt",
  "timestamp": "2025-12-17T10:00:00Z"
}
```

**Breaking Change**: Existing webhook consumers may need to update logic that depends on the `"app"` field. Communicate this change in advance.

---

## Backward Compatibility Statement

⚠️ **BREAKING CHANGE**: This rename introduces NO backward compatibility. All API consumers MUST update their integrations to reflect Fundrbolt naming and new service endpoints.

**Action Required**:
1. Notify all external API consumers of the rename
2. Provide migration timeline (recommend 30-60 days)
3. Publish migration guide
4. Monitor for stale client requests and log them for support follow-up

---

## Version & Deprecation Timeline

| Phase | Date | Action |
|-------|------|--------|
| Announcement | 2025-12-17 | Notify all consumers of rename |
| Cutover | 2026-01-15 | Production deployment with Fundrbolt APIs |
| Monitoring | 2026-01-15 – 2026-03-15 | Track stale Fundrbolt client requests |
| Support | Until 2026-03-15 | Assist clients migrating to Fundrbolt |

---

## Testing Checklist

- [ ] OpenAPI docs (`/docs`) display Fundrbolt branding
- [ ] `X-Powered-By` headers include "Fundrbolt"
- [ ] JWT tokens (if applicable) updated with new issuer
- [ ] Email templates tested with Fundrbolt sender name
- [ ] Webhook payloads tested with Fundrbolt app name
- [ ] Client SDKs/docs updated with new base URL (if domain changed)
- [ ] Load tests confirm no performance regression
- [ ] All integration tests pass

---

## Migration Guide (for External Consumers)

### For REST API Clients

1. **No endpoint changes**: All URLs remain the same (unless base domain changed)
2. **Update branding expectations**: Code checking for "Fundrbolt" in responses should now expect "Fundrbolt"
3. **Verify headers**: Check that `X-Powered-By` header is received correctly
4. **Test thoroughly**: Run integration tests against staging environment first

### For WebSocket Clients

1. **Connection unchanged**: Namespace paths remain the same
2. **Update event listeners** (if code filters by `app` field in metadata)
3. **Verify reconnection logic**: Ensure auto-reconnect still works post-rename
4. **Load test**: Confirm WebSocket stability under concurrent load

### For Email Recipients

1. **Sender name updated**: Emails now come from "Fundrbolt Support"
2. **Add to whitelist** (if needed): Update email filters to recognize new sender
3. **Bookmark new support URL** (if domain changed): Update links in bookmarks

---

## Support & Questions

For API migration questions:
- **Email**: support@fundrbolt.app (changed from support@fundrbolt.app)
- **Docs**: https://fundrbolt.app/api/docs (if domain changed)
- **Support Portal**: [URL TBD]

---
