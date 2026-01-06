# API Contracts: Table Details Management

**Feature**: 014-table-details-management
**Date**: 2026-01-01
**Phase**: 1 (Design & Contracts)

## Overview

This document defines the REST API contracts for table customization functionality. All endpoints follow RESTful conventions and return JSON responses.

**Base Path**: `/api/v1`
**Authentication**: Bearer JWT token required for all endpoints
**Rate Limiting**: 100 requests/minute per user (existing limit)

## Admin Endpoints

### 1. Update Table Details

**Purpose**: Set or modify capacity, name, and captain for a specific table

**Endpoint**: `PATCH /admin/events/{event_id}/tables/{table_number}`

**Authorization**: Requires `event_coordinator` or `super_admin` role + event membership

**Path Parameters**:
- `event_id` (UUID, required): Event identifier
- `table_number` (integer, required): Table number (1..event.table_count)

**Request Body**:
```json
{
  "custom_capacity": 8,
  "table_name": "VIP Sponsors",
  "table_captain_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Request Schema**:
```typescript
{
  custom_capacity?: number | null;  // 1-20 or null (use event default)
  table_name?: string | null;       // 1-50 chars or null (no name)
  table_captain_id?: string | null; // UUID or null (no captain)
}
```

**Validation Rules**:
- `custom_capacity`: Must be 1-20 or null
- `table_name`: Must be 1-50 characters (trimmed) or null; empty strings converted to null
- `table_captain_id`: Must reference existing guest assigned to this table

**Success Response** (200 OK):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "event_id": "123e4567-e89b-12d3-a456-426614174001",
  "table_number": 5,
  "custom_capacity": 8,
  "table_name": "VIP Sponsors",
  "table_captain": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "first_name": "Jane",
    "last_name": "Doe"
  },
  "current_occupancy": 6,
  "effective_capacity": 8,
  "is_full": false,
  "updated_at": "2026-01-01T10:30:00Z"
}
```

**Response Schema**:
```typescript
{
  id: string;                  // EventTable UUID
  event_id: string;            // Event UUID
  table_number: number;        // 1..table_count
  custom_capacity: number | null;
  table_name: string | null;
  table_captain: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  current_occupancy: number;   // Count of assigned guests
  effective_capacity: number;  // custom_capacity ?? event.max_guests_per_table
  is_full: boolean;            // current_occupancy >= effective_capacity
  updated_at: string;          // ISO 8601 timestamp
}
```

**Error Responses**:

- **400 Bad Request** - Invalid table_captain_id (captain not assigned to table):
```json
{
  "detail": "Captain must be assigned to this table",
  "captain_table_number": 3,
  "requested_table_number": 5
}
```

- **404 Not Found** - Table number doesn't exist:
```json
{
  "detail": "Table 99 not found for event",
  "event_table_count": 10
}
```

- **422 Unprocessable Entity** - Validation errors:
```json
{
  "detail": [
    {
      "loc": ["body", "custom_capacity"],
      "msg": "ensure this value is greater than or equal to 1",
      "type": "value_error.number.not_ge"
    }
  ]
}
```

---

### 2. Get Tables for Event

**Purpose**: Retrieve all tables with details for admin seating page

**Endpoint**: `GET /admin/events/{event_id}/tables`

**Authorization**: Requires `event_coordinator` or `super_admin` role + event membership

**Path Parameters**:
- `event_id` (UUID, required): Event identifier

**Query Parameters**:
- `include_guests` (boolean, optional, default=false): Include array of assigned guests per table

**Success Response** (200 OK):
```json
{
  "event_id": "123e4567-e89b-12d3-a456-426614174001",
  "event_max_guests_per_table": 10,
  "tables": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "table_number": 1,
      "custom_capacity": null,
      "table_name": null,
      "table_captain": null,
      "current_occupancy": 8,
      "effective_capacity": 10,
      "is_full": false,
      "guests": []  // Populated if include_guests=true
    },
    {
      "id": "123e4567-e89b-12d3-a456-426614174002",
      "table_number": 2,
      "custom_capacity": 8,
      "table_name": "VIP Sponsors",
      "table_captain": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "first_name": "Jane",
        "last_name": "Doe"
      },
      "current_occupancy": 6,
      "effective_capacity": 8,
      "is_full": false,
      "guests": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "first_name": "Jane",
          "last_name": "Doe",
          "bidder_number": 101,
          "is_table_captain": true
        }
        // ... 5 more guests
      ]
    }
  ],
  "summary": {
    "total_tables": 10,
    "total_capacity": 94,
    "total_assigned": 67,
    "tables_full": 2,
    "tables_with_captains": 3
  }
}
```

**Response Schema**:
```typescript
{
  event_id: string;
  event_max_guests_per_table: number;
  tables: Array<{
    id: string;
    table_number: number;
    custom_capacity: number | null;
    table_name: string | null;
    table_captain: {
      id: string;
      first_name: string;
      last_name: string;
    } | null;
    current_occupancy: number;
    effective_capacity: number;
    is_full: boolean;
    guests?: Array<{       // Only if include_guests=true
      id: string;
      first_name: string;
      last_name: string;
      bidder_number: number | null;
      is_table_captain: boolean;
    }>;
  }>;
  summary: {
    total_tables: number;
    total_capacity: number;
    total_assigned: number;
    tables_full: number;
    tables_with_captains: number;
  };
}
```

**Error Responses**:

- **404 Not Found** - Event has no seating configuration:
```json
{
  "detail": "Event does not have seating configured",
  "event_table_count": null
}
```

---

### 3. Assign Guest to Table (Modified Existing Endpoint)

**Purpose**: Assign guest to table with capacity validation

**Endpoint**: `PATCH /admin/events/{event_id}/guests/{guest_id}/seating`

**Note**: This is an **existing endpoint** from Feature 012 that requires **modification** to check table capacity

**Authorization**: Requires `event_coordinator` or `super_admin` role + event membership

**Path Parameters**:
- `event_id` (UUID, required): Event identifier
- `guest_id` (UUID, required): Registration guest identifier

**Request Body**:
```json
{
  "table_number": 5,
  "bidder_number": 105
}
```

**Validation Enhancement** (New for Feature 014):
- Before UPDATE, check table capacity:
  - Query EventTable for effective_capacity (custom_capacity ?? event.max_guests_per_table)
  - COUNT guests currently assigned to table
  - If count >= capacity, return 409 Conflict

**Success Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "table_number": 5,
  "bidder_number": 105,
  "table_name": "VIP Sponsors",
  "table_captain": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "first_name": "Jane",
    "last_name": "Doe"
  },
  "is_table_captain": false
}
```

**New Error Response** (409 Conflict):
```json
{
  "detail": "Table 5 is full (8/8 seats)",
  "table_number": 5,
  "table_name": "VIP Sponsors",
  "current_occupancy": 8,
  "effective_capacity": 8
}
```

---

## Donor Endpoints

### 4. Get Event Details for Donor (Modified Existing Endpoint)

**Purpose**: Include table assignment details in event info for donor home page

**Endpoint**: `GET /donor/events/{event_slug}`

**Note**: This is an **existing endpoint** that requires **modification** to include table details

**Authorization**: Requires authenticated user with event registration

**Path Parameters**:
- `event_slug` (string, required): Event URL slug

**Response Enhancement** (New for Feature 014):
- Add `table_assignment` field to response (only if event has started)
- Field is null if:
  - Event hasn't started (`now < event.start_datetime`)
  - Guest not assigned to table (`guest.table_number IS NULL`)

**Success Response** (200 OK):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174001",
  "title": "Annual Gala 2026",
  "slug": "annual-gala-2026",
  "start_datetime": "2026-06-15T18:00:00Z",
  "has_started": true,
  // ... other existing event fields ...
  "table_assignment": {
    "table_number": 5,
    "table_name": "VIP Sponsors",
    "table_captain": {
      "full_name": "Jane Doe",
      "is_you": false
    },
    "you_are_captain": false
  }
}
```

**Response Schema Addition**:
```typescript
{
  // ... existing event fields ...
  table_assignment: {
    table_number: number;
    table_name: string | null;
    table_captain: {
      full_name: string;      // "First Last"
      is_you: boolean;
    } | null;
    you_are_captain: boolean;
  } | null;  // Null if not started or not assigned
}
```

**Response when event not started**:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174001",
  "has_started": false,
  "table_assignment": null  // Hidden until event starts
}
```

---

## Shared Types

### EventTableResponse

```typescript
interface EventTableResponse {
  id: string;
  event_id: string;
  table_number: number;
  custom_capacity: number | null;
  table_name: string | null;
  table_captain: TableCaptainSummary | null;
  current_occupancy: number;
  effective_capacity: number;
  is_full: boolean;
  updated_at: string;
}
```

### TableCaptainSummary

```typescript
interface TableCaptainSummary {
  id: string;
  first_name: string;
  last_name: string;
}
```

### TableAssignment (Donor View)

```typescript
interface TableAssignment {
  table_number: number;
  table_name: string | null;
  table_captain: {
    full_name: string;
    is_you: boolean;
  } | null;
  you_are_captain: boolean;
}
```

## HTTP Status Codes

- **200 OK**: Successful GET/PATCH request
- **400 Bad Request**: Invalid input (e.g., captain not at table)
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: User lacks required role/permissions
- **404 Not Found**: Resource doesn't exist (event, table, guest)
- **409 Conflict**: Business rule violation (table full)
- **422 Unprocessable Entity**: Validation errors (Pydantic)
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Unexpected server error

## Rate Limiting

**Limits** (Existing from Feature 001):
- 100 requests/minute per authenticated user
- 1000 requests/minute per event (aggregate)

**Headers**:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

**429 Response**:
```json
{
  "detail": "Rate limit exceeded",
  "retry_after": 42
}
```

## Caching & ETag Support

### Admin Endpoints
**Caching**: None (always fresh data for coordinators)

### Donor Endpoints
**Caching**: Support ETag for `/donor/events/{event_slug}`

**Response Headers**:
- `ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"`
- `Cache-Control: private, max-age=10`  // 10-second client cache aligns with polling interval

**Conditional Request**:
```
GET /donor/events/annual-gala-2026
If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"
```

**304 Not Modified Response**:
- Empty body
- Same ETag header
- Donor UI reuses cached response

**Efficiency**: Reduces bandwidth for unchanged data during 10-second polling intervals

## Versioning

**Current API Version**: `v1`
**Backward Compatibility**: All changes in this feature are additive (new fields, new endpoints); no breaking changes to existing contracts

**Breaking Change Policy**: If breaking changes needed, introduce `v2` endpoints and deprecate `v1` over 6-month period
