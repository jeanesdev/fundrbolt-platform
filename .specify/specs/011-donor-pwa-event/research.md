# Research: Donor PWA Event Homepage

**Feature**: 011-donor-pwa-event
**Date**: December 9, 2025
**Status**: Complete

## Research Tasks

### 1. Infinite Scroll Implementation in React

**Decision**: Use `@tanstack/react-virtual` with Intersection Observer for infinite scroll

**Rationale**:
- TanStack Virtual is already a dependency pattern in the project (TanStack Router, React Query)
- Intersection Observer API is well-supported and performant
- Virtualization prevents DOM bloat with 100+ auction items
- Works seamlessly with React Query's `useInfiniteQuery`

**Alternatives Considered**:
- `react-infinite-scroll-component`: Heavier, less control over virtualization
- `react-window`: Good but TanStack Virtual has better React 18 integration
- Manual Intersection Observer: Reinventing the wheel

**Implementation Pattern**:
```typescript
// Use useInfiniteQuery from @tanstack/react-query
// Combine with Intersection Observer for trigger
// Virtualize list for performance with large datasets
```

---

### 2. Real-Time Countdown Timer in React

**Decision**: Custom hook using `useEffect` with `setInterval` and `requestAnimationFrame`

**Rationale**:
- Simple implementation, no external dependencies needed
- `requestAnimationFrame` for smooth 1-second updates
- Cleanup on unmount prevents memory leaks
- Can easily handle timezone-aware calculations

**Alternatives Considered**:
- `react-countdown`: External dependency, overkill for simple countdown
- `date-fns` intervals: Good for complex date math but not real-time display
- Web Workers: Unnecessary complexity for 1-second intervals

**Implementation Pattern**:
```typescript
// useCountdown(targetDate: Date) => { days, hours, minutes, seconds, isExpired }
// Uses setInterval with 1000ms
// Clears interval on unmount or when expired
```

---

### 3. CSS Custom Properties for Dynamic Theming

**Decision**: Extend existing `useEventBranding` hook to inject CSS variables for background and accent colors

**Rationale**:
- Project already uses CSS variables for event branding (`--event-primary`, `--event-secondary`)
- Tailwind CSS 4 supports CSS variable consumption natively
- No runtime performance cost after initial injection
- Supports instant theme switching when event changes

**Existing Infrastructure**:
- `EventBrandingContext.tsx` already manages branding state
- `use-event-branding.ts` applies CSS variables to `:root`
- Need to add: `--event-background`, `--event-accent` variables

**Fallback Chain**: Event colors → NPO colors → System defaults

---

### 4. Collapsible Sections with Radix UI

**Decision**: Use existing `@radix-ui/react-collapsible` via shadcn/ui `Collapsible` component

**Rationale**:
- Already available in the project's UI component library
- Accessible out-of-the-box (ARIA attributes, keyboard navigation)
- Smooth animations with CSS transitions
- Controlled component pattern fits React state management

**Implementation Pattern**:
```typescript
// Use <Collapsible> with defaultOpen based on event timing
// const isUpcoming = new Date(event.event_datetime) > new Date()
// defaultOpen={isUpcoming && withinDays(event.event_datetime, 30)}
```

---

### 5. Event Switcher Dropdown

**Decision**: Use Radix UI `DropdownMenu` component with custom styling

**Rationale**:
- Accessible dropdown with keyboard navigation
- Already in shadcn/ui component library
- Supports conditional rendering (no dropdown for single event)
- Custom trigger allows event name + thumbnail layout

**Implementation Pattern**:
```typescript
// <DropdownMenu>
//   <DropdownMenuTrigger> Event name + thumbnail </DropdownMenuTrigger>
//   <DropdownMenuContent>
//     {events.map(event => <DropdownMenuItem />)}
//   </DropdownMenuContent>
// </DropdownMenu>
```

---

### 6. Auction Items API - Sorting Enhancement

**Decision**: Extend existing `/api/v1/events/{event_id}/auction-items` endpoint with sort parameter

**Rationale**:
- Endpoint already exists with filtering by `auction_type` and `status`
- Adding `sort_by` query parameter is backward-compatible
- Database index on `event_id` already exists
- Default sort: highest current bid first (items without bids use starting_bid)

**Current API**:
```
GET /api/v1/events/{event_id}/auction-items?auction_type=silent&page=1&limit=50
```

**Enhanced API**:
```
GET /api/v1/events/{event_id}/auction-items?auction_type=all&sort_by=highest_bid&page=1&limit=20
```

---

### 7. Registered Events with Branding API

**Decision**: Add new endpoint `GET /api/v1/registrations/events-with-branding`

**Rationale**:
- Current `/api/v1/registrations` returns registrations but not full event details with branding
- Need event branding (colors, images) + NPO fallback in single call
- Reduces frontend API calls from N+1 to 1
- Sorted by event date (upcoming first, then past)

**Response Shape**:
```json
{
  "events": [
    {
      "id": "uuid",
      "name": "Gala 2025",
      "slug": "gala-2025",
      "event_datetime": "2025-12-20T18:00:00Z",
      "thumbnail_url": "https://...",
      "primary_color": "#FF5733",
      "secondary_color": "#33FF57",
      "background_color": "#FFFFFF",
      "accent_color": "#3357FF",
      "npo_logo_url": "https://...",
      "npo_primary_color": "#000000",
      "is_past": false
    }
  ]
}
```

---

### 8. Mobile-First Responsive Grid

**Decision**: CSS Grid with `auto-fill` and `minmax()` for responsive columns

**Rationale**:
- Native CSS, no JavaScript calculations needed
- Automatically adjusts column count based on viewport
- Minimum 2 columns on mobile (320px), up to 4-5 on desktop
- Consistent gap spacing

**Implementation**:
```css
.auction-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}
```

---

## Dependencies Identified

### Frontend (npm packages - already installed)
- `@tanstack/react-query` - Infinite query support
- `@radix-ui/react-collapsible` - Collapsible sections
- `@radix-ui/react-dropdown-menu` - Event switcher
- No new dependencies required

### Backend (Python packages - already installed)
- `FastAPI` - API routing
- `SQLAlchemy` - ORM queries with joins
- No new dependencies required

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Auction items missing `ending_time` field | Sort accuracy | Use `created_at` for MVP; add field in future |
| Large image thumbnails slow load | Performance | Ensure Azure Blob thumbnails are pre-generated (existing) |
| Branding colors with poor contrast | Accessibility | Use CSS `color-contrast()` or provide dark/light text variants |
| Infinite scroll performance with 500+ items | Memory | Virtualize with TanStack Virtual if needed |

---

## Clarifications Resolved

From spec clarification session:
1. **Default auction filter**: Show all items (combined silent + live)
2. **Pagination strategy**: Infinite scroll with lazy loading
3. **Sort order**: Ending soonest first, highest current bid secondary
