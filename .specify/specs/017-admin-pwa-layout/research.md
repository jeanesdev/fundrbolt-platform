# Research: Admin PWA Layout Redesign

**Feature**: 017-admin-pwa-layout
**Date**: 2026-01-22
**Status**: Complete

## Research Questions & Decisions

### Q1: Event Selector Implementation Pattern

**Question**: How should the EventSelector component mirror the existing NpoSelector pattern while adding smart default logic?

**Decision**: Follow NpoSelector architecture exactly - use Radix UI DropdownMenu within SidebarMenu, integrate with custom hook (useEventContext), implement similar visual structure with logo/initials fallback.

**Rationale**:
- Consistency with existing codebase reduces learning curve
- NpoSelector already handles similar concerns (filtering, selection persistence, role-based visibility)
- Radix UI DropdownMenu provides accessibility out-of-the-box (keyboard navigation, ARIA labels, focus management)
- Zustand store pattern (similar to NPO context) ensures state persistence across navigation

**Alternatives Considered**:
- **Custom dropdown component**: Rejected - would require rebuilding accessibility features, keyboard navigation, and ARIA compliance
- **Native select element**: Rejected - insufficient styling control, poor mobile UX, can't display logos/avatars inline
- **Combobox pattern**: Rejected - overkill for event selection (search needed only at 10+ events threshold)

**Implementation Notes**:
- Create `useEventContext` hook mirroring `useNpoContext` structure
- Smart default logic runs in `useEffect` when `availableEvents` changes
- Prioritize: active events → upcoming events → recent events (use event.start_date for sorting)
- Store selection in Zustand with `{eventId, eventName, isManualSelection}` shape

---

### Q2: Badge Count Update Mechanism

**Question**: What's the optimal strategy for updating badge counts (media, links, sponsors, auction items, guest count) on sidebar navigation items?

**Decision**: Poll on navigation - refresh badge counts when user navigates between pages using TanStack Router's navigation lifecycle.

**Rationale**:
- Simplest implementation: leverage existing React Query cache invalidation on route change
- Aligns with user mental model: data refreshes when you navigate (expected behavior)
- Avoids WebSocket infrastructure for admin panel (overkill for non-real-time data)
- Polling every 30s would waste resources when admin isn't actively working
- Manual refresh would frustrate users who add an item and don't see count update

**Alternatives Considered**:
- **Real-time WebSocket updates**: Rejected - adds complexity, maintains persistent connections for infrequent updates, overkill for admin panel (donors need real-time, admins don't)
- **30-second polling**: Rejected - wastes API calls when user idle, doesn't update on user action
- **Manual refresh only**: Rejected - poor UX, users won't remember to refresh

**Implementation Notes**:
- Use TanStack Router `<Link>` with `preload="intent"` to prefetch badge data on hover
- Invalidate React Query keys on navigation: `queryClient.invalidateQueries(['eventStats', eventId])`
- Single API endpoint: `GET /api/v1/events/:eventId/stats` returns all counts in one call
- Cache for 5 minutes, invalidate on navigation or explicit actions (add/delete item)

---

### Q3: Initial Avatar Generation with WCAG Contrast

**Question**: How do we ensure generated initial avatars (fallback when no logo uploaded) meet WCAG AA contrast requirements (4.5:1 minimum)?

**Decision**: Implement contrast checking utility using WCAG relative luminance formula, auto-adjust text color (white or navy) based on background luminance.

**Rationale**:
- WCAG AA compliance is non-negotiable (accessibility requirement)
- Branding colors are user-provided (can't control contrast manually)
- Automatic adjustment prevents broken/illegible avatars
- Navy-on-white is the fallback when no branding colors configured

**Alternatives Considered**:
- **Always use fixed color pairs**: Rejected - defeats purpose of using branding colors for recognition
- **Warn admins to fix branding**: Rejected - pushes compliance burden to users, breaks immediately for non-compliant branding
- **Use overlay/shadow for readability**: Rejected - adds visual complexity, doesn't guarantee compliance

**Implementation Notes**:
- Use established color library: `tinycolor2` or implement WCAG formula directly (simple math)
- Algorithm:
  1. Get branding primary color or default to navy (#1e3a8a)
  2. Calculate relative luminance: L = 0.2126*R + 0.7152*G + 0.0722*B (sRGB)
  3. Contrast ratio = (L1 + 0.05) / (L2 + 0.05) where L1 is lighter color
  4. If contrast < 4.5:1, switch text color (white → navy or navy → white)
  5. If both fail, use border and reduce opacity of background
- Store decision in `useInitialAvatar` hook return: `{initials, bgColor, textColor, hasBorder}`

---

### Q4: Navigation Group Collapsibility State Persistence

**Question**: How should we persist the expanded/collapsed state of navigation groups (Dashboard, Admin, Event) across page refreshes?

**Decision**: Use localStorage with per-group keys (`nav-group-admin-collapsed`, `nav-group-event-collapsed`), default all groups to expanded, persist on toggle.

**Rationale**:
- Session persistence improves UX (user sets preference once, it sticks)
- localStorage is simpler than server-side user preferences (no DB changes)
- Per-user-device persistence is acceptable (admin users typically use one device)
- All expanded by default provides maximum discoverability for new users

**Alternatives Considered**:
- **No persistence (always expanded)**: Rejected - users can't minimize clutter if they only use certain sections
- **Server-side user preferences**: Rejected - overkill, requires DB migration, API changes, adds latency
- **sessionStorage (per-tab)**: Rejected - users expect preferences to persist across browser restarts

**Implementation Notes**:
- Extend existing `NavGroup` component to read/write localStorage on mount/toggle
- Key pattern: `fundrbolt-nav-group-${groupName}-collapsed` (boolean)
- Default: `false` (expanded) if key doesn't exist
- Clear localStorage keys on logout (prevent cross-user state leakage)

---

### Q5: Event Selector Search/Filter UI Pattern

**Question**: What's the best UX pattern for search/filter in the event selector when 10+ events are present?

**Decision**: Use Radix UI Combobox pattern (searchable dropdown) - renders as DropdownMenu with search input at top, filters list as user types.

**Rationale**:
- Combobox is standard pattern for searchable dropdowns (GitHub repo selector, VS Code command palette)
- Radix UI provides accessible combobox components (keyboard navigation, ARIA)
- Search-as-you-type is intuitive (no separate search button)
- Maintains visual consistency with NpoSelector (both use Radix UI)

**Alternatives Considered**:
- **Separate search field outside dropdown**: Rejected - requires more clicks (open search, type, select), breaks visual flow
- **Pagination**: Rejected - annoying for 10-30 events, search is faster
- **Grouped by status (active/upcoming/past)**: Considered - may add in addition to search if user testing shows need

**Implementation Notes**:
- Use Radix UI `<Command>` component (built-in search/filter)
- Show search input only when `events.length >= 10` (per clarification)
- Filter logic: case-insensitive substring match on event name
- Show "No events found" empty state when search yields no results
- Preserve last search term in local state (clear on close)

---

### Q6: Event-Specific Navigation Routing Strategy

**Question**: How should routing work when event-specific sections (Details, Media, Links, etc.) move from tabs to sidebar navigation?

**Decision**: Use nested routes with eventId slug: `/events/:eventId/:section` where section is `details`, `media`, `links`, `registrations`, `seating`, `tickets`, `sponsors`, `auction-items`.

**Rationale**:
- RESTful URL structure (event is parent resource, section is child)
- Deep-linkable (users can bookmark specific event sections)
- Aligns with TanStack Router file-based routing patterns
- Easy to add new event sections without routing refactor

**Alternatives Considered**:
- **Query params (`/events/:eventId?tab=media`)**: Rejected - non-standard, awkward with sidebar navigation, harder to deep-link
- **Hash routing (`/events/:eventId#media`)**: Rejected - loses server-side rendering benefits, breaks back button expectations
- **Flat routes (`/events/:eventId/media`)**: Selected - clean, RESTful, works with existing patterns

**Implementation Notes**:
- Create route file: `routes/events/$eventId/$section.tsx` (TanStack Router convention)
- Section loader validates section param against allowed values
- Redirect `/events/:eventId` → `/events/:eventId/details` (default section)
- Update EventEditPage to use TanStack Router navigation instead of tabs state
- Preserve existing EventEditPage components, just change navigation wrapper

---

### Q7: Backend API Changes Required

**Question**: Does the backend need modifications to support event search/filter and badge count updates?

**Decision**: Minimal changes - add optional `search` query param to existing `GET /api/v1/events` endpoint, create new `GET /api/v1/events/:eventId/stats` endpoint for badge counts.

**Rationale**:
- Event list API already exists, just needs search parameter
- Stats endpoint consolidates 6+ separate API calls into one (efficiency)
- No schema changes required (reads existing tables: events, media, links, food_options, sponsors, auction_items, registration_guests)
- Maintains backward compatibility (search param is optional)

**Alternatives Considered**:
- **No backend changes (client-side filtering)**: Rejected - inefficient for 100+ events, wastes bandwidth
- **GraphQL for badge counts**: Rejected - overkill, adds dependency, faster to add REST endpoint
- **Server-sent events for badge updates**: Rejected - adds complexity, polling on navigation is sufficient

**Implementation Notes**:
- `GET /api/v1/events?npo_id=X&search=gala` - returns events where name contains "gala" (case-insensitive)
- `GET /api/v1/events/:eventId/stats` - returns `{mediaCount, linksCount, foodOptionsCount, sponsorsCount, auctionItemsCount, guestCount}`
- Add to FastAPI router in `backend/app/api/v1/events.py`
- Use SQLAlchemy subqueries for efficient counting (avoid N+1)
- Cache stats response for 5 minutes in Redis (optional optimization)

---

## Technology Decisions Summary

| Component | Technology | Justification |
|-----------|------------|---------------|
| Event Selector | Radix UI DropdownMenu + Command | Accessibility, existing pattern consistency |
| State Management | Zustand | Existing pattern, simple, TypeScript-friendly |
| Badge Updates | Poll on navigation (React Query invalidation) | Simple, efficient, aligns with user expectations |
| Initial Avatars | Custom utility + tinycolor2 | WCAG compliance, branding color support |
| Collapse Persistence | localStorage | Simple, no server changes, per-device is acceptable |
| Routing | TanStack Router nested routes | RESTful, deep-linkable, existing pattern |
| Search UI | Radix UI Command component | Standard pattern, accessible, minimal code |

---

## Risk Assessment

### Low Risk
- ✅ Radix UI components are proven (used throughout app)
- ✅ No database schema changes
- ✅ Minimal backend API changes (backward compatible)
- ✅ No authentication/authorization changes

### Medium Risk
- ⚠️ **Routing refactor complexity**: Moving from tabs to routes requires careful migration
  - Mitigation: Test all event section routes thoroughly, maintain URL backward compatibility
- ⚠️ **Badge count performance**: Stats endpoint could be slow for events with 1000+ items
  - Mitigation: Add database indexes on foreign keys, use Redis caching if needed

### High Risk
- ⚠️ **WCAG contrast edge cases**: Some branding color combinations may be impossible to fix
  - Mitigation: Add border fallback, document branding guidelines for NPO admins

---

## Dependencies

### External Libraries (Existing)
- Radix UI Sidebar, DropdownMenu, Command components ✅ Already installed
- TanStack Router ✅ Already installed
- Zustand ✅ Already installed
- React Query ✅ Already installed

### New Libraries
- `tinycolor2` - Color manipulation and contrast calculation
  - Size: 7KB gzipped
  - License: MIT
  - Alternative: Implement WCAG formula manually (recommended - fewer dependencies)

### Backend Changes
- Modify `GET /api/v1/events` endpoint (add search param)
- Create `GET /api/v1/events/:eventId/stats` endpoint
- Estimated effort: 2-4 hours

---

## Performance Considerations

### Frontend
- Initial avatar generation: <10ms (simple string manipulation)
- Badge count API call: <100ms (single endpoint, indexed queries)
- Sidebar render: <50ms (virtual scrolling not needed for <20 nav items)
- Event selector dropdown: <100ms (Radix UI optimized)

### Backend
- Event search query: <50ms (indexed on event name)
- Stats aggregation: <100ms (subqueries with proper indexes)
- Consider adding indexes if slow:
  ```sql
  CREATE INDEX idx_event_media ON event_media(event_id);
  CREATE INDEX idx_event_links ON event_links(event_id);
  CREATE INDEX idx_sponsors ON sponsors(event_id);
  ```

---

## Testing Strategy

### Unit Tests (~10 tests)
- `useEventContext` smart default logic (active > upcoming > past)
- `useInitialAvatar` initial generation (2-letter max, uppercase)
- WCAG contrast calculation (various color combinations)
- Navigation group collapse state persistence (localStorage)

### Integration Tests (~5 tests)
- EventSelector filters events by NPO
- Badge counts update on navigation
- Event-specific nav items appear/disappear based on selection
- Settings pages don't show duplicate header elements

### E2E Tests (~3 flows)
- Login → select event → navigate all event sections via sidebar
- Select different NPO → event selector updates → badge counts refresh
- Collapse/expand nav groups → refresh page → state persists

---

## Rollout Strategy

### Phase 1: Core Navigation (P1 user stories)
1. EventSelector component with smart defaults
2. Event-specific sidebar navigation group
3. Update routing for event sections
4. Remove horizontal tabs from EventEditPage

### Phase 2: Visual Polish (P2 user stories)
5. Initial avatar generation with WCAG contrast
6. Event name display in top bar
7. Navigation group collapsibility with persistence

### Phase 3: Cleanup (P3 user stories)
8. Remove duplicate elements from settings pages

### Rollback Plan
- Feature flag: `enable-new-sidebar-nav` (default false)
- If critical bugs found, toggle off and revert to tabs
- Keep old EventEditPage tabs component for 1 sprint after release
