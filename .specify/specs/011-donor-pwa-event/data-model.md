# Data Model: Donor PWA Event Homepage

**Feature**: 011-donor-pwa-event
**Date**: December 9, 2025
**Status**: Complete

## Overview

This feature primarily consumes existing data models. No new database tables are required. The focus is on efficient querying and response shaping for the frontend.

## Existing Entities Used

### Event

**Table**: `events`

**Relevant Fields for This Feature**:

| Field | Type | Usage |
|-------|------|-------|
| `id` | UUID | Primary identifier |
| `npo_id` | UUID | FK to NPO for fallback branding |
| `name` | String(255) | Display in event switcher and header |
| `slug` | String(255) | URL routing |
| `tagline` | String(500) | Subheading display |
| `description` | Text | Event details section |
| `event_datetime` | Timestamp | Countdown timer, sorting |
| `timezone` | String(50) | Timezone-aware countdown |
| `venue_name` | String(255) | Event details section |
| `venue_address` | String(500) | Event details section |
| `venue_city` | String(100) | Event details section |
| `venue_state` | String(50) | Event details section |
| `venue_zip` | String(20) | Event details section |
| `attire` | String(100) | Event details section |
| `primary_contact_name` | String(200) | Event details section |
| `primary_contact_email` | String(255) | Event details section |
| `primary_contact_phone` | String(20) | Event details section |
| `primary_color` | String(7) | Branding - buttons, headers |
| `secondary_color` | String(7) | Branding - accents |
| `background_color` | String(7) | Branding - page background |
| `accent_color` | String(7) | Branding - highlights |
| `status` | Enum | Filter active events only |

**Relationships**:

- `npo` (many-to-one): NPO → provides fallback branding
- `auction_items` (one-to-many): AuctionItem[] → displayed in gallery
- `registrations` (one-to-many): EventRegistration[] → determines user access
- `media` (one-to-many): EventMedia[] → banner/logo images

---

### NPO

**Table**: `npos`

**Relevant Fields for This Feature**:

| Field | Type | Usage |
|-------|------|-------|
| `id` | UUID | Primary identifier |
| `name` | String(255) | Display as event organizer |

**Relationships**:

- `branding` (one-to-one): NPOBranding → fallback colors and logo

---

### NPOBranding

**Table**: `npo_brandings`

**Relevant Fields for This Feature**:

| Field | Type | Usage |
|-------|------|-------|
| `npo_id` | UUID | FK to NPO |
| `logo_url` | String(500) | Fallback event thumbnail |
| `primary_color` | String(7) | Fallback primary color |
| `secondary_color` | String(7) | Fallback secondary color |
| `background_color` | String(7) | Fallback background color |
| `accent_color` | String(7) | Fallback accent color |

---

### EventRegistration

**Table**: `event_registrations`

**Relevant Fields for This Feature**:

| Field | Type | Usage |
|-------|------|-------|
| `id` | UUID | Primary identifier |
| `user_id` | UUID | FK to User |
| `event_id` | UUID | FK to Event |
| `status` | Enum | Filter confirmed/pending only |
| `created_at` | Timestamp | Registration timestamp |

**Business Rules**:

- Only show events where user has registration with status IN ('pending', 'confirmed')
- Exclude 'cancelled' and 'waitlisted' registrations from event switcher

---

### AuctionItem

**Table**: `auction_items`

**Relevant Fields for This Feature**:

| Field | Type | Usage |
|-------|------|-------|
| `id` | UUID | Primary identifier |
| `event_id` | UUID | FK to Event |
| `title` | String(255) | Item card title |
| `description` | Text | Item card description (truncated) |
| `auction_type` | Enum | Filter: 'silent', 'live' |
| `starting_bid` | Decimal | Display if no current bid |
| `bid_increment` | Decimal | Future: bidding UI |
| `buy_now_price` | Decimal | Optional: display buy now |
| `status` | Enum | Filter: only 'published' items |
| `display_priority` | Integer | Secondary sort option |
| `created_at` | Timestamp | Default sort field |

**Note**: Model currently lacks `ending_time` field. For MVP, sort by `created_at` DESC.

**Relationships**:

- `media` (one-to-many): AuctionItemMedia[] → thumbnail images

---

### AuctionItemMedia

**Table**: `auction_item_media`

**Relevant Fields for This Feature**:

| Field | Type | Usage |
|-------|------|-------|
| `auction_item_id` | UUID | FK to AuctionItem |
| `thumbnail_path` | String(500) | Gallery thumbnail URL |
| `display_order` | Integer | Primary image = order 0 |
| `media_type` | Enum | Filter: 'image' only |

---

### EventMedia

**Table**: `event_media`

**Relevant Fields for This Feature**:

| Field | Type | Usage |
|-------|------|-------|
| `event_id` | UUID | FK to Event |
| `file_url` | String(500) | Event banner/thumbnail |
| `display_order` | Integer | Primary image = order 0 |
| `media_type` | Enum | Filter: 'image' only |

---

## New Response Schemas

### RegisteredEventWithBranding

**Purpose**: Single API response with event data + resolved branding (event or NPO fallback)

```python
class RegisteredEventWithBranding(BaseModel):
    """Event with resolved branding for donor PWA."""

    # Identity
    id: UUID
    name: str
    slug: str

    # Timing
    event_datetime: datetime
    timezone: str
    is_past: bool  # Computed: event_datetime < now()
    is_upcoming: bool  # Computed: event_datetime within 30 days

    # Display
    thumbnail_url: str | None  # Event media[0] or NPO logo

    # Branding (resolved: event → NPO → defaults)
    primary_color: str  # Default: #3B82F6
    secondary_color: str  # Default: #9333EA
    background_color: str  # Default: #FFFFFF
    accent_color: str  # Default: #3B82F6

    # NPO Info
    npo_name: str
    npo_logo_url: str | None
```

### RegisteredEventsResponse

**Purpose**: List of registered events sorted for event switcher

```python
class RegisteredEventsResponse(BaseModel):
    """List of events user is registered for."""

    events: list[RegisteredEventWithBranding]
    # Sorted: upcoming events first (by date ASC), then past (by date DESC)
```

### AuctionItemGalleryItem

**Purpose**: Minimal auction item data for gallery cards

```python
class AuctionItemGalleryItem(BaseModel):
    """Auction item for gallery display."""

    id: UUID
    title: str
    description: str | None  # Truncated to ~100 chars
    auction_type: AuctionType  # 'silent' | 'live'
    thumbnail_url: str | None
    starting_bid: Decimal
    current_bid: Decimal | None  # Future: from bids table
    bid_count: int  # Future: count from bids table
```

---

## Query Patterns

### Get Registered Events with Branding

```sql
SELECT
    e.id, e.name, e.slug, e.event_datetime, e.timezone,
    e.primary_color, e.secondary_color, e.background_color, e.accent_color,
    n.name as npo_name,
    nb.logo_url as npo_logo_url,
    nb.primary_color as npo_primary_color,
    nb.secondary_color as npo_secondary_color,
    nb.background_color as npo_background_color,
    nb.accent_color as npo_accent_color,
    (SELECT em.file_url FROM event_media em
     WHERE em.event_id = e.id AND em.media_type = 'image'
     ORDER BY em.display_order LIMIT 1) as thumbnail_url
FROM event_registrations er
JOIN events e ON er.event_id = e.id
JOIN npos n ON e.npo_id = n.id
LEFT JOIN npo_brandings nb ON n.id = nb.npo_id
WHERE er.user_id = :user_id
  AND er.status IN ('pending', 'confirmed')
  AND e.status = 'active'
ORDER BY
    CASE WHEN e.event_datetime >= NOW() THEN 0 ELSE 1 END,
    CASE WHEN e.event_datetime >= NOW() THEN e.event_datetime END ASC,
    CASE WHEN e.event_datetime < NOW() THEN e.event_datetime END DESC;
```

### Get Auction Items for Gallery (Infinite Scroll)

```sql
SELECT
    ai.id, ai.title, ai.description, ai.auction_type,
    ai.starting_bid, ai.created_at,
    (SELECT aim.thumbnail_path FROM auction_item_media aim
     WHERE aim.auction_item_id = ai.id AND aim.media_type = 'image'
     ORDER BY aim.display_order LIMIT 1) as thumbnail_url
FROM auction_items ai
WHERE ai.event_id = :event_id
  AND ai.status = 'published'
  AND (:auction_type IS NULL OR ai.auction_type = :auction_type)
ORDER BY ai.created_at DESC, ai.starting_bid DESC
LIMIT :limit OFFSET :offset;
```

---

## Index Recommendations

Existing indexes should be sufficient. Verify these exist:

| Table | Index | Columns |
|-------|-------|---------|
| `event_registrations` | `idx_reg_user_status` | `(user_id, status)` |
| `auction_items` | `idx_auction_event_status` | `(event_id, status)` |
| `auction_item_media` | `idx_aim_item_type` | `(auction_item_id, media_type)` |
| `event_media` | `idx_em_event_type` | `(event_id, media_type)` |

---

## State Management (Frontend)

### EventContextStore Extensions

```typescript
interface EventContextStore {
  // Existing
  selectedEventId: string | null
  selectedEventName: string
  selectedEventSlug: string | null
  availableEvents: EventContextOption[]

  // New for branding
  selectedEventBranding: EventBranding | null

  // Actions
  setSelectedEventWithBranding: (event: RegisteredEventWithBranding) => void
}

interface EventBranding {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  accentColor: string
  thumbnailUrl: string | null
  npoLogoUrl: string | null
}
```
