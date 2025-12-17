# Event Slug-Based Routing Migration

## Overview

Migrated donor PWA event routing from ID-based URLs to slug-based URLs for better UX and SEO.

**Before:** `/events/550e8400-e29b-41d4-a716-446655440000`
**After:** `/events/spring-gala-2024`

## Completed Changes

### Route Structure

- ✅ Renamed route directory: `$eventId` → `$eventSlug`
- ✅ Updated route files:
  - `/routes/_authenticated/events/$eventSlug/route.tsx`
  - `/routes/_authenticated/events/$eventSlug/index.tsx`

### Navigation Updates

- ✅ `/routes/_authenticated/home.tsx` - Uses `selectedEventSlug` from context
- ✅ `/routes/_authenticated/events/index.tsx` - Uses `selectedEventSlug` from context
- ✅ `/features/events/EventHomePage.tsx`:
  - Changed `useParams()` to get `eventSlug` instead of `eventId`
  - Uses `loadEventBySlug(eventSlug)` to fetch event data
  - Event switcher navigates with `event.slug`
  - Component internals use `currentEvent.id` for API calls (IDs still used for API endpoints)

### Layout Updates

- ✅ `/components/layout/authenticated-layout.tsx` - Updated route detection to use `$eventSlug`

## Architecture Notes

### Slug vs ID Usage

- **URL Routing:** Uses slugs (user-friendly, SEO-friendly)
- **API Calls:** Still uses IDs (backend APIs expect IDs)
- **Data Flow:**
  1. URL param: `eventSlug` (e.g., "spring-gala-2024")
  2. Store method: `loadEventBySlug(slug)` fetches event by slug
  3. Store state: `currentEvent` object contains both `id` and `slug`
  4. API calls: Use `currentEvent.id` for backend requests

### Event Store Methods

Both methods available in `event-store.ts`:

- `loadEventById(id: string)` - Fetch by UUID
- `loadEventBySlug(slug: string)` - Fetch by slug

### Event Context Hook

Returns both identifiers from `use-event-context.ts`:

- `selectedEventId` - UUID for API calls
- `selectedEventSlug` - Slug for URL navigation

## Known Limitations (Requires Backend Updates)

### Search Results

Search functionality in `/components/search/SearchResults.tsx` needs backend API changes:

#### Event Search Results

Currently links to: `/events/$eventSlug` but only has `event.id`
**Needed:** Add `slug` field to `EventSearchResult` interface
**Backend API:** `/api/v1/search` should include event slugs

```typescript
// Current (missing slug)
export interface EventSearchResult {
  id: string
  name: string
  npo_id: string
  npo_name: string
  event_type: string
  status: string
  start_date: string | null
  end_date: string | null
  created_at: string
}

// Needed (add slug)
export interface EventSearchResult {
  id: string
  slug: string  // ← ADD THIS
  name: string
  // ... rest of fields
}
```

#### Auction Item Search Results

Currently links to: `/events/$eventSlug/auction-items/$itemId`
But only has `item.event_id` (no `event_slug`)

**Needed:** Add `event_slug` field to `AuctionItemSearchResult`
**Backend API:** `/api/v1/search` should include event slugs for auction items

```typescript
// Current (missing event_slug)
export interface AuctionItemSearchResult {
  id: string
  name: string
  event_id: string
  event_name: string
  category: string
  status: string
  starting_bid: number | null
  created_at: string
}

// Needed (add event_slug)
export interface AuctionItemSearchResult {
  id: string
  name: string
  event_id: string
  event_slug: string  // ← ADD THIS
  event_name: string
  // ... rest of fields
}
```

### Workaround Options (Until Backend Updated)

1. **Option A:** Keep search using ID-based URLs temporarily
2. **Option B:** Fetch event details on search result click (adds latency)
3. **Option C:** Update backend search API to include slugs (recommended)

## Testing Checklist

- [ ] Navigate to event via home page redirect
- [ ] Switch events using event switcher dropdown
- [ ] Direct URL navigation with slug works
- [ ] Auction gallery loads correctly
- [ ] Auction item modal opens correctly
- [ ] Profile dropdown works in event page
- [ ] Invalid slug shows error/redirects appropriately
- [ ] Search results (after backend update)

## Related Files

- `/frontend/donor-pwa/src/stores/event-store.ts` - Event loading logic
- `/frontend/donor-pwa/src/hooks/use-event-context.ts` - Context hook
- `/frontend/donor-pwa/src/services/search.ts` - Search type definitions
- `/backend/app/api/v1/search.py` - Backend search endpoint (needs update)

## Migration Commit

See PR #XX for complete changeset.
