# API Contracts: Legal Documentation & Compliance

**Feature**: 005-legal-documentation
**API Version**: v1
**Base Path**: `/api/v1`

## Overview

This document defines the REST API contracts for legal documentation and compliance features. All endpoints follow RESTful conventions and return JSON responses.

## Authentication

Most endpoints require authentication via JWT Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

Exceptions (public endpoints):
- `GET /legal/documents/:type` - Anonymous users can view current legal documents
- `GET /legal/documents/:type/version/:version` - Anonymous viewing of specific versions

## Endpoints Summary

### Legal Documents

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/legal/documents` | Optional | List all current published legal documents |
| GET | `/legal/documents/:type` | Optional | Get current version of specific document type |
| GET | `/legal/documents/:type/version/:version` | Optional | Get specific version of document |
| POST | `/legal/documents` | Admin | Create new legal document (draft) |
| PATCH | `/legal/documents/:id` | Admin | Update draft legal document |
| POST | `/legal/documents/:id/publish` | Admin | Publish draft legal document |
| GET | `/legal/documents/:type/versions` | Admin | List all versions of document type |

### Consent Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/consent/accept` | Required | Accept legal documents (registration/update) |
| GET | `/consent/status` | Required | Get user's current consent status |
| GET | `/consent/history` | Required | Get user's consent history |
| POST | `/consent/data-export` | Required | Request GDPR data export |
| POST | `/consent/data-deletion` | Required | Request GDPR account deletion |
| POST | `/consent/withdraw` | Required | Withdraw consent (triggers account deactivation) |

### Cookie Consent

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/cookies/consent` | Optional | Get cookie consent status (user or session) |
| POST | `/cookies/consent` | Optional | Set cookie preferences |
| PUT | `/cookies/consent` | Optional | Update cookie preferences |
| DELETE | `/cookies/consent` | Optional | Revoke cookie consent (default to reject all) |

---

## Legal Documents API

### GET /legal/documents

Get all current published legal documents (Terms of Service and Privacy Policy).

**Authentication**: Optional (public endpoint)

**Request**:

```http
GET /api/v1/legal/documents HTTP/1.1
Host: api.fundrbolt.app
```

**Response** (200 OK):

```json
{
  "documents": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "document_type": "terms_of_service",
      "version": "1.0",
      "effective_date": "2025-10-01",
      "content": "# Terms of Service\n\n...",
      "status": "published",
      "created_at": "2025-09-15T10:00:00Z",
      "updated_at": "2025-09-15T10:00:00Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "document_type": "privacy_policy",
      "version": "2.0",
      "effective_date": "2025-10-01",
      "content": "# Privacy Policy\n\n...",
      "status": "published",
      "created_at": "2025-09-20T14:30:00Z",
      "updated_at": "2025-09-20T14:30:00Z"
    }
  ]
}
```

---

### GET /legal/documents/:type

Get the current published version of a specific legal document.

**Authentication**: Optional (public endpoint)

**Path Parameters**:
- `type` (string, required): Document type (`terms_of_service` | `privacy_policy`)

**Request**:

```http
GET /api/v1/legal/documents/terms_of_service HTTP/1.1
Host: api.fundrbolt.app
```

**Response** (200 OK):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "document_type": "terms_of_service",
  "version": "1.0",
  "effective_date": "2025-10-01",
  "content": "# Terms of Service\n\n## 1. Acceptance of Terms\n\nBy accessing...",
  "status": "published",
  "created_at": "2025-09-15T10:00:00Z",
  "updated_at": "2025-09-15T10:00:00Z"
}
```

**Error Responses**:

```json
// 404 Not Found - No published document of this type
{
  "error": "not_found",
  "message": "No published terms_of_service document found"
}

// 400 Bad Request - Invalid document type
{
  "error": "invalid_document_type",
  "message": "Document type must be 'terms_of_service' or 'privacy_policy'"
}
```

---

### GET /legal/documents/:type/version/:version

Get a specific version of a legal document (for viewing version history).

**Authentication**: Optional (public endpoint)

**Path Parameters**:
- `type` (string, required): Document type
- `version` (string, required): Version number (e.g., "1.0", "2.5")

**Request**:

```http
GET /api/v1/legal/documents/terms_of_service/version/1.0 HTTP/1.1
Host: api.fundrbolt.app
```

**Response** (200 OK):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "document_type": "terms_of_service",
  "version": "1.0",
  "effective_date": "2025-10-01",
  "content": "# Terms of Service (v1.0)\n\n...",
  "status": "archived",
  "created_at": "2025-09-15T10:00:00Z",
  "updated_at": "2025-09-15T10:00:00Z"
}
```

---

### POST /legal/documents (Admin Only)

Create a new legal document (starts in draft status).

**Authentication**: Required (Admin role)

**Request**:

```http
POST /api/v1/legal/documents HTTP/1.1
Host: api.fundrbolt.app
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "document_type": "terms_of_service",
  "version": "2.0",
  "content": "# Terms of Service (v2.0)\n\n## Major Changes...",
  "effective_date": "2025-12-01"
}
```

**Response** (201 Created):

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "document_type": "terms_of_service",
  "version": "2.0",
  "content": "# Terms of Service (v2.0)\n\n## Major Changes...",
  "status": "draft",
  "effective_date": "2025-12-01",
  "created_at": "2025-10-28T16:45:00Z",
  "updated_at": "2025-10-28T16:45:00Z"
}
```

**Validation Errors** (400 Bad Request):

```json
{
  "error": "validation_error",
  "details": [
    {
      "field": "version",
      "message": "Version '2.0' already exists for terms_of_service"
    }
  ]
}
```

---

## Consent Management API

### POST /consent/accept

Accept one or more legal documents. Called during registration or when prompted for updated documents.

**Authentication**: Required

**Request**:

```http
POST /api/v1/consent/accept HTTP/1.1
Host: api.fundrbolt.app
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "consents": [
    {
      "document_type": "terms_of_service",
      "document_version": "1.0",
      "consent_method": "registration"
    },
    {
      "document_type": "privacy_policy",
      "document_version": "2.0",
      "consent_method": "registration"
    }
  ]
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "consents": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "user_id": "990e8400-e29b-41d4-a716-446655440004",
      "document_type": "terms_of_service",
      "document_version": "1.0",
      "accepted_at": "2025-10-28T17:00:00Z",
      "consent_method": "registration"
    },
    {
      "id": "880e8400-e29b-41d4-a716-446655440005",
      "user_id": "990e8400-e29b-41d4-a716-446655440004",
      "document_type": "privacy_policy",
      "document_version": "2.0",
      "accepted_at": "2025-10-28T17:00:00Z",
      "consent_method": "registration"
    }
  ],
  "audit_logged": true
}
```

**Error Responses**:

```json
// 400 Bad Request - Invalid document version
{
  "error": "invalid_version",
  "message": "Document version '1.0' is not published for terms_of_service"
}

// 409 Conflict - Already consented to this version
{
  "error": "already_consented",
  "message": "User already consented to terms_of_service version 1.0"
}
```

---

### GET /consent/status

Get user's current consent status for all legal documents.

**Authentication**: Required

**Request**:

```http
GET /api/v1/consent/status HTTP/1.1
Host: api.fundrbolt.app
Authorization: Bearer <access_token>
```

**Response** (200 OK):

```json
{
  "user_id": "990e8400-e29b-41d4-a716-446655440004",
  "consents": {
    "terms_of_service": {
      "current_version": "2.0",
      "user_version": "1.0",
      "accepted_at": "2025-09-01T12:00:00Z",
      "status": "outdated",
      "needs_acceptance": true
    },
    "privacy_policy": {
      "current_version": "2.0",
      "user_version": "2.0",
      "accepted_at": "2025-10-20T15:30:00Z",
      "status": "current",
      "needs_acceptance": false
    }
  },
  "blocked": true,
  "required_documents": ["terms_of_service"]
}
```

**Status Values**:
- `current`: User has accepted the latest version
- `outdated`: User accepted old version, new version available
- `missing`: User never accepted this document

---

### GET /consent/history

Get user's complete consent history (all acceptances, withdrawals, updates).

**Authentication**: Required

**Request**:

```http
GET /api/v1/consent/history HTTP/1.1
Host: api.fundrbolt.app
Authorization: Bearer <access_token>
```

**Query Parameters**:
- `document_type` (optional): Filter by document type
- `limit` (optional, default: 50): Number of records to return
- `offset` (optional, default: 0): Pagination offset

**Response** (200 OK):

```json
{
  "user_id": "990e8400-e29b-41d4-a716-446655440004",
  "total": 3,
  "history": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440006",
      "document_type": "privacy_policy",
      "document_version": "2.0",
      "accepted_at": "2025-10-20T15:30:00Z",
      "consent_method": "update_prompt",
      "ip_address": "192.0.2.1"
    },
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440007",
      "document_type": "terms_of_service",
      "document_version": "1.0",
      "accepted_at": "2025-09-01T12:00:00Z",
      "consent_method": "registration",
      "ip_address": "192.0.2.1"
    },
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440008",
      "document_type": "privacy_policy",
      "document_version": "1.0",
      "accepted_at": "2025-09-01T12:00:00Z",
      "consent_method": "registration",
      "ip_address": "192.0.2.1"
    }
  ]
}
```

---

### POST /consent/data-export

Request GDPR data export (all personal data in machine-readable format).

**Authentication**: Required

**Request**:

```http
POST /api/v1/consent/data-export HTTP/1.1
Host: api.fundrbolt.app
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response** (202 Accepted):

```json
{
  "request_id": "dd0e8400-e29b-41d4-a716-446655440009",
  "status": "processing",
  "message": "Data export request received. You will receive an email with download link when ready.",
  "estimated_completion": "2025-10-28T18:00:00Z"
}
```

**Note**: This endpoint enqueues an async job. User receives email with time-limited download link when export is ready.

---

### POST /consent/data-deletion

Request GDPR account and data deletion (soft delete with 30-day grace period).

**Authentication**: Required

**Request**:

```http
POST /api/v1/consent/data-deletion HTTP/1.1
Host: api.fundrbolt.app
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "confirmation": "DELETE_MY_ACCOUNT",
  "reason": "No longer using the service"
}
```

**Response** (200 OK):

```json
{
  "request_id": "ee0e8400-e29b-41d4-a716-44665544000a",
  "status": "scheduled",
  "message": "Your account will be deleted in 30 days. You can cancel this request by logging in before the deletion date.",
  "deletion_date": "2025-11-27T17:00:00Z",
  "cancellation_deadline": "2025-11-26T23:59:59Z"
}
```

---

## Cookie Consent API

### GET /cookies/consent

Get current cookie consent preferences for user (authenticated) or session (anonymous).

**Authentication**: Optional

**Request**:

```http
GET /api/v1/cookies/consent HTTP/1.1
Host: api.fundrbolt.app
X-Session-ID: <anonymous_session_uuid>
```

**Response** (200 OK):

```json
{
  "essential_cookies": true,
  "analytics_cookies": false,
  "marketing_cookies": false,
  "consent_timestamp": "2025-10-28T17:00:00Z",
  "expires_at": "2026-10-28T17:00:00Z",
  "status": "active"
}
```

**Response** (404 Not Found - No consent recorded):

```json
{
  "error": "no_consent_found",
  "message": "No cookie consent found for this user/session",
  "default": {
    "essential_cookies": true,
    "analytics_cookies": false,
    "marketing_cookies": false
  }
}
```

---

### POST /cookies/consent

Set cookie preferences (initial consent).

**Authentication**: Optional

**Request**:

```http
POST /api/v1/cookies/consent HTTP/1.1
Host: api.fundrbolt.app
Authorization: Bearer <access_token>
X-Session-ID: <anonymous_session_uuid>
Content-Type: application/json

{
  "essential_cookies": true,
  "analytics_cookies": true,
  "marketing_cookies": false
}
```

**Response** (201 Created):

```json
{
  "id": "ff0e8400-e29b-41d4-a716-44665544000b",
  "user_id": "990e8400-e29b-41d4-a716-446655440004",
  "essential_cookies": true,
  "analytics_cookies": true,
  "marketing_cookies": false,
  "consent_timestamp": "2025-10-28T17:05:00Z",
  "expires_at": "2026-10-28T17:05:00Z",
  "audit_logged": true
}
```

---

### PUT /cookies/consent

Update cookie preferences (change existing consent).

**Authentication**: Optional

**Request**:

```http
PUT /api/v1/cookies/consent HTTP/1.1
Host: api.fundrbolt.app
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "analytics_cookies": false,
  "marketing_cookies": false
}
```

**Response** (200 OK):

```json
{
  "id": "ff0e8400-e29b-41d4-a716-44665544000b",
  "user_id": "990e8400-e29b-41d4-a716-446655440004",
  "essential_cookies": true,
  "analytics_cookies": false,
  "marketing_cookies": false,
  "consent_timestamp": "2025-10-28T17:10:00Z",
  "expires_at": "2026-10-28T17:10:00Z",
  "audit_logged": true
}
```

---

## Error Response Format

All error responses follow this consistent format:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": {
    "field": "Additional context (optional)"
  },
  "request_id": "trace_id_for_debugging"
}
```

### Common Error Codes

- `validation_error`: Request validation failed
- `unauthorized`: Authentication required or invalid token
- `forbidden`: Insufficient permissions
- `not_found`: Resource not found
- `conflict`: Request conflicts with current state
- `rate_limit_exceeded`: Too many requests
- `internal_server_error`: Unexpected server error

---

## Rate Limiting

- Anonymous: 100 requests/hour per IP
- Authenticated: 1000 requests/hour per user
- Admin: 5000 requests/hour per user

Rate limit headers included in all responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1698505200
```

---

## Versioning

API versioned via URL path: `/api/v1/`, `/api/v2/`, etc.

Current version: `v1`

Breaking changes will require a new version. Non-breaking changes (adding optional fields, new endpoints) can be added to existing version.
