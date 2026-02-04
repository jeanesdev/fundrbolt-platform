# API Contracts: Admin PWA Layout Redesign

**Feature**: 017-admin-pwa-layout
**Date**: 2026-01-22
**API Version**: v1

## Overview

This feature adds minimal backend changes - one new read-only endpoint and an optional query parameter to an existing endpoint.

---

## New Endpoint: Event Stats

### GET /api/v1/events/{event_id}/stats

**Purpose**: Fetch badge counts for event-specific navigation items (media, links, food options, sponsors, auction items, guests).

**Authentication**: Required (JWT Bearer token)

**Authorization**: User must have access to the event's NPO (via role membership)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event_id` | UUID | Yes | The unique identifier of the event |

#### Request Example

```http
GET /api/v1/events/550e8400-e29b-41d4-a716-446655440000/stats HTTP/1.1
Host: api.fundrbolt.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### Success Response (200 OK)

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "mediaCount": 5,
  "linksCount": 3,
  "foodOptionsCount": 4,
  "sponsorsCount": 12,
  "auctionItemsCount": 45,
  "guestCount": 87
}
```

**Response Schema**:

```typescript
interface EventStatsResponse {
  eventId: string // UUID of the event
  mediaCount: number // Count of event_media records
  linksCount: number // Count of event_links records
  foodOptionsCount: number // Count of event_food_options records
  sponsorsCount: number // Count of sponsors records
  auctionItemsCount: number // Count of auction_items records (published only)
  guestCount: number // Count of registration_guests (approved only)
}
```

#### Error Responses

**401 Unauthorized**
```json
{
  "detail": "Not authenticated"
}
```

**403 Forbidden**
```json
{
  "detail": "Access denied to this event"
}
```

**404 Not Found**
```json
{
  "detail": "Event not found"
}
```

**500 Internal Server Error**
```json
{
  "detail": "Internal server error"
}
```

#### Business Rules

1. **Authorization**: User must belong to a role (Super Admin, NPO Admin, NPO Staff, Event Coordinator) that has access to the event's NPO
2. **Guest Count**: Only count approved registrations (status = 'approved'), exclude cancelled/pending
3. **Auction Items Count**: Only count published items (status = 'published'), exclude drafts
4. **Performance**: Query should complete in <100ms (use efficient subqueries, ensure indexes on foreign keys)
5. **Caching**: Optional - cache response in Redis for 5 minutes with key `event:stats:{event_id}`

#### SQL Implementation

```sql
-- Efficient stats query with subqueries
SELECT
  (SELECT COUNT(*) FROM event_media WHERE event_id = $1) as media_count,
  (SELECT COUNT(*) FROM event_links WHERE event_id = $1) as links_count,
  (SELECT COUNT(*) FROM event_food_options WHERE event_id = $1) as food_options_count,
  (SELECT COUNT(*) FROM sponsors WHERE event_id = $1) as sponsors_count,
  (SELECT COUNT(*) FROM auction_items WHERE event_id = $1 AND status = 'published') as auction_items_count,
  (SELECT COUNT(*) FROM registration_guests WHERE event_id = $1 AND status = 'approved') as guest_count;
```

**Indexes Required** (verify existence):
```sql
CREATE INDEX IF NOT EXISTS idx_event_media_event_id ON event_media(event_id);
CREATE INDEX IF NOT EXISTS idx_event_links_event_id ON event_links(event_id);
CREATE INDEX IF NOT EXISTS idx_event_food_options_event_id ON event_food_options(event_id);
CREATE INDEX IF NOT EXISTS idx_sponsors_event_id ON sponsors(event_id);
CREATE INDEX IF NOT EXISTS idx_auction_items_event_id ON auction_items(event_id);
CREATE INDEX IF NOT EXISTS idx_registration_guests_event_id ON registration_guests(event_id);
```

---

## Modified Endpoint: Event List with Search

### GET /api/v1/events

**Purpose**: List events with optional filtering by NPO and search query.

**Change**: Add optional `search` query parameter for filtering events by name.

**Authentication**: Required (JWT Bearer token)

**Authorization**: Returns only events user has access to (based on NPO membership)

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `npo_id` | UUID | No | Filter events by NPO (existing parameter) |
| `search` | string | No | Case-insensitive substring search on event name (NEW) |
| `status` | string | No | Filter by status: 'active', 'upcoming', 'past' (existing) |
| `limit` | integer | No | Max results to return (default: 100, max: 500) |
| `offset` | integer | No | Pagination offset (default: 0) |

#### Request Examples

**Without search (existing behavior):**
```http
GET /api/v1/events?npo_id=123e4567-e89b-12d3-a456-426614174000 HTTP/1.1
Host: api.fundrbolt.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**With search (new):**
```http
GET /api/v1/events?npo_id=123e4567-e89b-12d3-a456-426614174000&search=gala HTTP/1.1
Host: api.fundrbolt.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### Success Response (200 OK)

```json
{
  "events": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "npo_id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Fall Gala 2026",
      "slug": "fall-gala-2026",
      "status": "active",
      "start_date": "2026-11-15T18:00:00Z",
      "logo_url": "https://storage.fundrbolt.com/events/550e8400.../logo.jpg"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "npo_id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Spring Gala 2027",
      "slug": "spring-gala-2027",
      "status": "upcoming",
      "start_date": "2027-04-20T19:00:00Z",
      "logo_url": null
    }
  ],
  "total": 2,
  "limit": 100,
  "offset": 0
}
```

#### Search Behavior

1. **Case-Insensitive**: `search=GALA` matches "Fall Gala", "spring gala", "GALA"
2. **Substring Match**: `search=fall` matches "Fall Gala", "Waterfall Festival"
3. **Empty Query**: `search=` or omitted - no filtering (existing behavior)
4. **Special Characters**: Escape SQL wildcards (%\_) to prevent injection
5. **Performance**: Use `ILIKE` with index on `events.name` for fast lookups

#### SQL Implementation

```sql
-- Existing query (no search)
SELECT * FROM events WHERE npo_id = $1 ORDER BY start_date DESC LIMIT $2 OFFSET $3;

-- Modified query (with search)
SELECT * FROM events
WHERE npo_id = $1
  AND ($2 IS NULL OR name ILIKE '%' || $2 || '%')
ORDER BY start_date DESC
LIMIT $3 OFFSET $4;
```

**Index Required**:
```sql
-- For search performance (optional, test before adding)
CREATE INDEX IF NOT EXISTS idx_events_name_trgm ON events USING gin(name gin_trgm_ops);
-- Requires PostgreSQL extension: CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

#### Error Responses

Same as existing endpoint:
- `401 Unauthorized`: Missing/invalid JWT
- `403 Forbidden`: User doesn't have access to specified NPO
- `400 Bad Request`: Invalid UUID format for npo_id

---

## Frontend API Client Updates

### EventStatsService

**Location**: `frontend/fundrbolt-admin/src/services/event-stats-service.ts`

**Methods**:

```typescript
export class EventStatsService {
  /**
   * Fetch badge counts for event navigation items
   * @param eventId - UUID of the event
   * @returns EventStatsResponse with all counts
   */
  static async getEventStats(eventId: string): Promise<EventStatsResponse> {
    const response = await apiClient.get(`/api/v1/events/${eventId}/stats`)
    return response.data
  }
}
```

**React Query Hook**:

```typescript
export function useEventStats(eventId: string | null) {
  return useQuery({
    queryKey: ['eventStats', eventId],
    queryFn: () => EventStatsService.getEventStats(eventId!),
    enabled: !!eventId, // Only fetch if event selected
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })
}
```

**Usage in Sidebar**:

```typescript
function EventNavGroup({ eventId }: { eventId: string }) {
  const { data: stats, isLoading } = useEventStats(eventId)

  return (
    <NavGroup title={`Event: ${eventName}`}>
      <NavItem href={`/events/${eventId}/media`} badge={stats?.mediaCount} />
      <NavItem href={`/events/${eventId}/sponsors`} badge={stats?.sponsorsCount} />
      {/* ... other nav items */}
    </NavGroup>
  )
}
```

### EventService Updates

**Location**: `frontend/fundrbolt-admin/src/services/event-service.ts`

**Modified Method**:

```typescript
export class EventService {
  /**
   * List events with optional search filter
   * @param npoId - Filter by NPO (optional)
   * @param search - Search query for event name (optional)
   * @returns Array of events
   */
  static async listEvents(params: {
    npoId?: string
    search?: string
    status?: 'active' | 'upcoming' | 'past'
    limit?: number
    offset?: number
  }): Promise<{ events: Event[], total: number }> {
    const response = await apiClient.get('/api/v1/events', { params })
    return response.data
  }
}
```

**React Query Hook** (updated):

```typescript
export function useEvents(npoId: string | null, search?: string) {
  return useQuery({
    queryKey: ['events', npoId, search],
    queryFn: () => EventService.listEvents({ npoId, search }),
    enabled: !!npoId,
    staleTime: 60 * 1000, // 1 minute (events don't change often)
  })
}
```

---

## OpenAPI Specification

### Event Stats Endpoint

```yaml
/api/v1/events/{event_id}/stats:
  get:
    summary: Get event statistics for navigation badges
    description: Returns counts of related records (media, links, sponsors, etc.) for displaying badges in the admin navigation sidebar.
    tags:
      - Events
    security:
      - BearerAuth: []
    parameters:
      - name: event_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
        description: The unique identifier of the event
    responses:
      '200':
        description: Event statistics retrieved successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                eventId:
                  type: string
                  format: uuid
                mediaCount:
                  type: integer
                  minimum: 0
                linksCount:
                  type: integer
                  minimum: 0
                foodOptionsCount:
                  type: integer
                  minimum: 0
                sponsorsCount:
                  type: integer
                  minimum: 0
                auctionItemsCount:
                  type: integer
                  minimum: 0
                guestCount:
                  type: integer
                  minimum: 0
              required:
                - eventId
                - mediaCount
                - linksCount
                - foodOptionsCount
                - sponsorsCount
                - auctionItemsCount
                - guestCount
            example:
              eventId: "550e8400-e29b-41d4-a716-446655440000"
              mediaCount: 5
              linksCount: 3
              foodOptionsCount: 4
              sponsorsCount: 12
              auctionItemsCount: 45
              guestCount: 87
      '401':
        $ref: '#/components/responses/Unauthorized'
      '403':
        $ref: '#/components/responses/Forbidden'
      '404':
        $ref: '#/components/responses/NotFound'
      '500':
        $ref: '#/components/responses/InternalServerError'
```

### Modified Event List Endpoint

```yaml
/api/v1/events:
  get:
    summary: List events with optional search
    description: Returns a list of events the user has access to, optionally filtered by NPO and/or search query.
    tags:
      - Events
    security:
      - BearerAuth: []
    parameters:
      - name: npo_id
        in: query
        required: false
        schema:
          type: string
          format: uuid
        description: Filter events by NPO
      - name: search
        in: query
        required: false
        schema:
          type: string
          maxLength: 100
        description: Case-insensitive substring search on event name (NEW)
      - name: status
        in: query
        required: false
        schema:
          type: string
          enum: [active, upcoming, past]
        description: Filter by event status
      - name: limit
        in: query
        required: false
        schema:
          type: integer
          minimum: 1
          maximum: 500
          default: 100
      - name: offset
        in: query
        required: false
        schema:
          type: integer
          minimum: 0
          default: 0
    responses:
      '200':
        description: Events retrieved successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                events:
                  type: array
                  items:
                    $ref: '#/components/schemas/Event'
                total:
                  type: integer
                limit:
                  type: integer
                offset:
                  type: integer
      '401':
        $ref: '#/components/responses/Unauthorized'
      '403':
        $ref: '#/components/responses/Forbidden'
```

---

## Testing Contract Compliance

### Unit Tests (Backend)

```python
# backend/app/tests/api/test_event_stats.py

async def test_get_event_stats_success(client, auth_headers, test_event):
    """Test successful retrieval of event stats"""
    response = await client.get(
        f"/api/v1/events/{test_event.id}/stats",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "eventId" in data
    assert "mediaCount" in data
    assert data["mediaCount"] >= 0

async def test_get_event_stats_unauthorized(client, test_event):
    """Test 401 when no auth token provided"""
    response = await client.get(f"/api/v1/events/{test_event.id}/stats")
    assert response.status_code == 401

async def test_get_event_stats_forbidden(client, auth_headers, other_npo_event):
    """Test 403 when user doesn't have access to event's NPO"""
    response = await client.get(
        f"/api/v1/events/{other_npo_event.id}/stats",
        headers=auth_headers
    )
    assert response.status_code == 403
```

### Integration Tests (Frontend)

```typescript
// frontend/fundrbolt-admin/src/services/__tests__/event-stats-service.test.ts

describe('EventStatsService', () => {
  it('fetches event stats successfully', async () => {
    const mockStats = {
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      mediaCount: 5,
      sponsorsCount: 12,
    }

    mockApiClient.get.mockResolvedValue({ data: mockStats })

    const result = await EventStatsService.getEventStats(mockStats.eventId)

    expect(result).toEqual(mockStats)
    expect(mockApiClient.get).toHaveBeenCalledWith(
      `/api/v1/events/${mockStats.eventId}/stats`
    )
  })
})
```

---

## Backward Compatibility

✅ **Fully Backward Compatible**

- Event list search parameter is optional - existing clients unaffected
- Event stats is a new endpoint - no existing dependencies
- No breaking changes to request/response formats
- No database schema changes required
