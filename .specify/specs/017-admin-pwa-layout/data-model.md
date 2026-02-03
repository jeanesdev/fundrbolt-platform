# Data Model: Admin PWA Layout Redesign

**Feature**: 017-admin-pwa-layout
**Date**: 2026-01-22
**Status**: Complete

## Overview

This feature is primarily a UI/UX redesign with **no database schema changes**. All data models are frontend state management structures (Zustand stores, React hooks) that consume existing backend APIs.

---

## Frontend State Models

### EventContext (Zustand Store)

**Purpose**: Manages selected event state across the admin PWA, similar to existing NPO context.

**Location**: `frontend/fundrbolt-admin/src/stores/event-context-store.ts`

**Shape**:
```typescript
interface EventContextState {
  // Selected event
  selectedEventId: string | null
  selectedEventName: string | null
  selectedEventSlug: string | null
  isManualSelection: boolean // User manually picked vs auto-selected

  // Available events for current NPO
  availableEvents: Event[]
  eventsLoading: boolean
  eventsError: string | null

  // Actions
  selectEvent: (eventId: string, eventName: string, eventSlug: string, isManual: boolean) => void
  clearEvent: () => void
  loadEventsForNpo: (npoId: string | null) => Promise<void>

  // Smart default logic
  applySmartDefault: () => void
}
```

**Validation Rules**:
- `selectedEventId` must exist in `availableEvents` array
- `isManualSelection` = `true` when user clicks dropdown item
- `isManualSelection` = `false` when `applySmartDefault()` runs
- Manual selection persists across navigation until NPO changes

**State Transitions**:
```
1. Initial load → applySmartDefault() → sets selectedEventId (isManual=false)
2. User selects event → selectEvent(..., isManual=true) → persists selection
3. User changes NPO → clearEvent() → loadEventsForNpo() → applySmartDefault()
4. Page navigation → state persists (no change)
```

**Persistence**:
- Store in localStorage: `fundrbolt-selected-event` → `{eventId, eventName, eventSlug, npoId}`
- Clear on NPO change or logout

---

### NavigationGroupState (localStorage)

**Purpose**: Persists collapsed/expanded state of sidebar navigation groups (Admin, Event).

**Location**: `localStorage` keys

**Shape**:
```typescript
// localStorage keys (per group)
'fundrbolt-nav-group-admin-collapsed': boolean
'fundrbolt-nav-group-event-collapsed': boolean
'fundrbolt-nav-group-dashboard-collapsed': boolean // if applicable
```

**Validation Rules**:
- Keys are boolean only (`true` = collapsed, `false` = expanded)
- Default to `false` (expanded) if key doesn't exist
- Clear all nav group keys on logout

**State Transitions**:
```
1. Page load → read localStorage → set initial collapse state
2. User toggles group → write localStorage → update UI
3. Logout → localStorage.clear() → all groups reset to expanded
```

---

### InitialAvatarConfig (computed, no storage)

**Purpose**: Generates initial-based avatar for NPOs/events without uploaded logos.

**Location**: `frontend/fundrbolt-admin/src/hooks/use-initial-avatar.ts`

**Shape**:
```typescript
interface InitialAvatarConfig {
  initials: string // e.g., "FG" from "Fall Gala"
  bgColor: string // Hex color from branding or default
  textColor: string // Computed for WCAG contrast (white or navy)
  hasBorder: boolean // True if contrast cannot be achieved
  fontSize: string // Responsive size based on container
}
```

**Validation Rules**:
- `initials` = first letter of first 2 words, max 2 chars, uppercase
- `bgColor` = branding primary color or fallback to #1e3a8a (navy)
- `textColor` computed via WCAG relative luminance formula
- Contrast ratio must meet WCAG AA (4.5:1 minimum)
- If no valid text color achieves contrast, set `hasBorder=true` and reduce bg opacity

**Generation Algorithm**:
```typescript
function generateInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function calculateContrast(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(color1) // WCAG formula
  const l2 = getRelativeLuminance(color2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function selectTextColor(bgColor: string): { textColor: string, hasBorder: boolean } {
  const whiteContrast = calculateContrast(bgColor, '#FFFFFF')
  const navyContrast = calculateContrast(bgColor, '#1e3a8a')

  if (whiteContrast >= 4.5) return { textColor: '#FFFFFF', hasBorder: false }
  if (navyContrast >= 4.5) return { textColor: '#1e3a8a', hasBorder: false }

  // Fallback: use border + reduced opacity
  return { textColor: '#FFFFFF', hasBorder: true }
}
```

---

### EventStats (API response, cached in React Query)

**Purpose**: Badge counts for event-specific navigation items.

**Location**: React Query cache, fetched from `GET /api/v1/events/:eventId/stats`

**Shape**:
```typescript
interface EventStats {
  mediaCount: number // event_media table count
  linksCount: number // event_links table count
  foodOptionsCount: number // event_food_options table count
  sponsorsCount: number // sponsors table count
  auctionItemsCount: number // auction_items table count
  guestCount: number // registration_guests table count (approved only)
}
```

**Validation Rules**:
- All counts must be non-negative integers
- Counts are real-time from database (no caching beyond React Query)
- Cache invalidated on navigation (5-minute stale time)

**API Contract**:
- Endpoint: `GET /api/v1/events/{event_id}/stats`
- Auth: Requires valid JWT, user must have access to event's NPO
- Response: `200 OK` with JSON body
- Error: `403 Forbidden` if user doesn't have access, `404 Not Found` if event doesn't exist

---

## Existing Backend Models (No Changes)

### Event (Read-only)

**Purpose**: Event list for selector dropdown, already exists in backend.

**Location**: `backend/app/models/event.py` (existing)

**Relevant Fields**:
```python
class Event(Base):
    __tablename__ = "events"

    id: UUID
    npo_id: UUID  # Filter events by NPO
    name: str     # Display in selector
    slug: str     # URL-friendly identifier
    status: str   # For smart default logic: 'active', 'upcoming', 'past'
    start_date: datetime  # For sorting upcoming events
    logo_url: str | None  # For selector visual, fallback to initials if None
```

**API Changes**:
- Add optional `search` query param to `GET /api/v1/events`:
  ```
  GET /api/v1/events?npo_id={npo_id}&search={query}
  ```
- Filters: `WHERE name ILIKE '%{query}%'` (case-insensitive substring match)

---

### NPO (Read-only, existing)

**Purpose**: NPO data for initial avatar generation (branding colors, logo).

**Location**: `backend/app/models/npo.py` (existing)

**Relevant Fields**:
```python
class NPO(Base):
    __tablename__ = "npos"

    id: UUID
    name: str  # For initial generation
    logo_url: str | None  # Display in selector, fallback to initials if None
    branding_primary_color: str | None  # Hex color for avatars
    branding_text_color: str | None  # Not used (we compute contrast)
```

**No Changes**: Use existing NPO branding API.

---

## API Endpoints (New)

### GET /api/v1/events/:eventId/stats

**Purpose**: Fetch badge counts for event navigation items.

**Request**:
```http
GET /api/v1/events/550e8400-e29b-41d4-a716-446655440000/stats HTTP/1.1
Authorization: Bearer {jwt_token}
```

**Response** (200 OK):
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

**Error Responses**:
- `403 Forbidden`: User doesn't have access to event's NPO
- `404 Not Found`: Event doesn't exist
- `500 Internal Server Error`: Database error

**Implementation** (FastAPI):
```python
from sqlalchemy import select, func

@router.get("/events/{event_id}/stats")
async def get_event_stats(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Authorization check (existing middleware)
    event = await db.get(Event, event_id)
    if not event or not has_access_to_npo(current_user, event.npo_id):
        raise HTTPException(403, "Access denied")

    # Efficient subqueries
    media_count = await db.scalar(
        select(func.count()).select_from(EventMedia).where(EventMedia.event_id == event_id)
    )
    links_count = await db.scalar(
        select(func.count()).select_from(EventLink).where(EventLink.event_id == event_id)
    )
    # ... repeat for other counts

    return EventStatsResponse(
        eventId=event_id,
        mediaCount=media_count,
        linksCount=links_count,
        foodOptionsCount=food_count,
        sponsorsCount=sponsor_count,
        auctionItemsCount=auction_count,
        guestCount=guest_count
    )
```

**Caching**: Optional Redis caching with 5-minute TTL, invalidate on data changes.

---

## Data Flow Diagrams

### Event Selection Flow

```
User opens admin PWA
  ↓
[Load NPO context] (existing)
  ↓
[Load events for NPO] → GET /api/v1/events?npo_id={npo_id}
  ↓
[applySmartDefault()]
  ├─ Active events exist? → Select first by start_date
  ├─ Upcoming events exist? → Select next by start_date ASC
  └─ Past events only? → Select most recent by start_date DESC
  ↓
[Set selectedEventId in Zustand]
  ↓
[Render EventSelector + Event Nav Group in sidebar]
  ↓
User clicks event section → Navigate to /events/{eventId}/{section}
  ↓
[Invalidate React Query cache] → Refetch badge counts
  ↓
[Update badge numbers in sidebar]
```

### Initial Avatar Generation Flow

```
Render EventSelector
  ↓
For each event in dropdown:
  ├─ Has logo_url? → Display logo image
  └─ No logo_url?
      ↓
      [generateInitials(event.name)] → e.g., "FG"
      ↓
      [Get branding color or default navy]
      ↓
      [calculateContrast with white and navy]
      ↓
      [Select text color with WCAG AA compliance]
      ↓
      [Render circular avatar with initials]
```

---

## Relationships

```
EventContext (Zustand)
  ├─ depends on → NPO Context (current NPO ID)
  ├─ fetches → Event[] from API
  └─ persists → localStorage

NavigationGroupState (localStorage)
  └─ independent (no dependencies)

InitialAvatarConfig (computed)
  ├─ input → NPO/Event name
  ├─ input → NPO branding colors (optional)
  └─ output → Avatar props for rendering

EventStats (React Query)
  ├─ depends on → selectedEventId (from EventContext)
  ├─ fetched via → GET /api/v1/events/:eventId/stats
  └─ cached → 5-minute stale time, invalidate on navigation
```

---

## Migration Notes

**No Database Migrations Required**: This feature only adds frontend state and one new read-only API endpoint. All data structures already exist in the database.

**API Version**: Uses existing `v1` API, no breaking changes.

**Backward Compatibility**: New event selector and sidebar navigation are additive. If feature flag is off, old tab navigation still works.
