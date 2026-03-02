# Quickstart: Admin PWA Layout Redesign

**Feature**: 017-admin-pwa-layout
**Date**: 2026-01-22
**Estimated Time**: 8-12 hours

## Overview

This guide walks through implementing the admin PWA layout redesign from scratch. Follow these steps in order for a smooth implementation.

---

## Prerequisites

- [ ] Feature branch checked out: `017-admin-pwa-layout`
- [ ] Backend dev server running: `make dev-backend` or `make b`
- [ ] Frontend dev server running: `make dev-frontend` or `make f`
- [ ] Database migrations up to date: `make migrate`
- [ ] Read [spec.md](./spec.md) and [research.md](./research.md) for context

---

## Implementation Phases

### Phase 1: Event Context State Management (2-3 hours)

**Goal**: Create event selection state management (Zustand store + React hook) with smart default logic.

**Files to Create**:
1. `frontend/fundrbolt-admin/src/stores/event-context-store.ts`
2. `frontend/fundrbolt-admin/src/hooks/use-event-context.tsx`

**Steps**:

1. **Create Zustand Store** (30 min)
   ```typescript
   // Pattern to follow: src/stores/npo-context-store.ts (existing)
   // Add: selectedEventId, availableEvents, selectEvent(), loadEventsForNpo()
   ```

2. **Implement Smart Default Logic** (1 hour)
   ```typescript
   function applySmartDefault(events: Event[]) {
     // Priority 1: Active events (status = 'active')
     // Priority 2: Upcoming events (start_date > now, sorted ASC)
     // Priority 3: Past events (start_date < now, sorted DESC)
   }
   ```

3. **Add localStorage Persistence** (30 min)
   ```typescript
   // Save: { eventId, eventName, npoId } on selection
   // Load: On mount, validate event still exists in availableEvents
   // Clear: On NPO change or logout
   ```

4. **Write Unit Tests** (1 hour)
   ```typescript
   // Test smart default logic with different event scenarios
   // Test persistence (save/load/clear)
   // Test manual selection overrides auto-selection
   ```

**Verification**:
- [ ] `pnpm test -- event-context` passes
- [ ] Manual testing: Select different NPOs, verify smart default works
- [ ] localStorage key `fundrbolt-selected-event` persists correctly

---

### Phase 2: Event Selector Component (2-3 hours)

**Goal**: Create EventSelector dropdown component matching NpoSelector pattern.

**Files to Create**:
1. `frontend/fundrbolt-admin/src/components/layout/EventSelector.tsx`
2. `frontend/fundrbolt-admin/src/hooks/use-initial-avatar.ts`
3. `frontend/fundrbolt-admin/src/components/ui/initial-avatar.tsx`

**Steps**:

1. **Create Initial Avatar Utility** (1 hour)
   ```typescript
   // Generate 2-letter initials from name
   // Calculate WCAG contrast (bgColor vs white/navy)
   // Return { initials, bgColor, textColor, hasBorder }
   ```

2. **Build EventSelector Component** (1.5 hours)
   ```typescript
   // Copy structure from NpoSelector.tsx
   // Use Radix UI DropdownMenu + SidebarMenuButton
   // Display event logo or InitialAvatar fallback
   // Show search input when events.length >= 10 (use Radix Command)
   ```

3. **Write Component Tests** (30 min)
   ```typescript
   // Test: Renders event list filtered by NPO
   // Test: Shows search input at 10+ events
   // Test: Initial avatar displays when no logo
   // Test: WCAG contrast compliance for avatars
   ```

**Verification**:
- [ ] EventSelector appears in sidebar below NpoSelector
- [ ] Search input appears when 10+ events exist
- [ ] Initial avatars render with proper contrast
- [ ] Clicking event updates selectedEventId

---

### Phase 3: Sidebar Navigation Updates (2-3 hours)

**Goal**: Add event-specific navigation group to sidebar, update AppSidebar structure.

**Files to Modify**:
1. `frontend/fundrbolt-admin/src/components/layout/app-sidebar.tsx`
2. `frontend/fundrbolt-admin/src/components/layout/nav-group.tsx`
3. `frontend/fundrbolt-admin/src/hooks/use-role-based-nav.ts`

**Steps**:

1. **Add EventSelector to AppSidebar** (15 min)
   ```tsx
   <SidebarHeader>
     <NpoSelector />
     <EventSelector /> {/* NEW */}
   </SidebarHeader>
   ```

2. **Create Event Navigation Group** (1 hour)
   ```typescript
   // In use-role-based-nav.ts, add dynamic event group
   if (selectedEventId) {
     navGroups.push({
       title: `Event: ${selectedEventName}`,
       items: [
         { title: 'Details', href: `/events/${eventId}/details`, icon: FileText },
         { title: 'Media', href: `/events/${eventId}/media`, badge: mediaCount, icon: Image },
         // ... all other event sections
       ]
     })
   }
   ```

3. **Add Collapsibility with Persistence** (1 hour)
   ```typescript
   // In NavGroup component:
   const [isCollapsed, setIsCollapsed] = useLocalStorage(
     `fundrbolt-nav-group-${title}-collapsed`,
     false // default expanded
   )
   ```

4. **Write Navigation Tests** (30 min)
   ```typescript
   // Test: Event group appears when event selected
   // Test: Event group hidden when no event selected
   // Test: Collapse state persists in localStorage
   // Test: NPO link hidden when not on "All Organizations"
   ```

**Verification**:
- [ ] Sidebar shows 3 groups: Dashboard, Admin, Event: [Name]
- [ ] Event group appears/disappears based on event selection
- [ ] Collapsing groups persists across page refresh
- [ ] All badges display correctly

---

### Phase 4: Backend API Endpoint (1-2 hours)

**Goal**: Add `GET /api/v1/events/:eventId/stats` endpoint for badge counts.

**Files to Modify/Create**:
1. `backend/app/api/v1/events.py`
2. `backend/app/schemas/event.py`
3. `backend/app/tests/api/test_events.py`

**Steps**:

1. **Create Pydantic Response Schema** (15 min)
   ```python
   class EventStatsResponse(BaseModel):
       eventId: UUID
       mediaCount: int
       linksCount: int
       # ... other counts
   ```

2. **Implement Stats Endpoint** (45 min)
   ```python
   @router.get("/events/{event_id}/stats", response_model=EventStatsResponse)
   async def get_event_stats(event_id: UUID, db: AsyncSession, current_user: User):
       # Check authorization
       # Use efficient subqueries for counts
       # Return stats
   ```

3. **Add Search Parameter to Event List** (15 min)
   ```python
   @router.get("/events")
   async def list_events(
       npo_id: UUID | None = None,
       search: str | None = None,  # NEW
       db: AsyncSession = Depends(get_db)
   ):
       query = select(Event)
       if search:
           query = query.where(Event.name.ilike(f"%{search}%"))
   ```

4. **Write API Tests** (30 min)
   ```python
   # Test: Stats endpoint returns correct counts
   # Test: 403 when user doesn't have access to event's NPO
   # Test: Search parameter filters events correctly
   ```

**Verification**:
- [ ] `make test-backend` passes
- [ ] `curl` test: `GET /api/v1/events/{id}/stats` returns counts
- [ ] `curl` test: `GET /api/v1/events?search=gala` filters correctly
- [ ] OpenAPI docs updated: http://localhost:8000/docs

---

### Phase 5: Frontend API Integration (1 hour)

**Goal**: Create React Query hooks for event stats API.

**Files to Create/Modify**:
1. `frontend/fundrbolt-admin/src/services/event-stats-service.ts`
2. `frontend/fundrbolt-admin/src/hooks/use-event-stats.ts`

**Steps**:

1. **Create Service** (20 min)
   ```typescript
   export class EventStatsService {
     static async getEventStats(eventId: string): Promise<EventStatsResponse> {
       const response = await apiClient.get(`/api/v1/events/${eventId}/stats`)
       return response.data
     }
   }
   ```

2. **Create React Query Hook** (20 min)
   ```typescript
   export function useEventStats(eventId: string | null) {
     return useQuery({
       queryKey: ['eventStats', eventId],
       queryFn: () => EventStatsService.getEventStats(eventId!),
       enabled: !!eventId,
       staleTime: 5 * 60 * 1000, // 5 min
     })
   }
   ```

3. **Integrate into Navigation** (20 min)
   ```typescript
   // In use-role-based-nav.ts, fetch stats and add badges
   const { data: stats } = useEventStats(selectedEventId)
   // Use stats.mediaCount, stats.sponsorsCount, etc. for badges
   ```

**Verification**:
- [ ] Badge counts display in event navigation items
- [ ] Counts update when navigating between pages
- [ ] Network tab shows single API call for all counts

---

### Phase 6: Routing & Tab Removal (1-2 hours)

**Goal**: Update routing to use sidebar navigation, remove horizontal tabs from EventEditPage.

**Files to Modify**:
1. `frontend/fundrbolt-admin/src/features/events/EventEditPage.tsx`
2. `frontend/fundrbolt-admin/src/routes/events/$eventId.tsx`

**Steps**:

1. **Create Nested Routes** (30 min)
   ```typescript
   // routes/events/$eventId/details.tsx
   // routes/events/$eventId/media.tsx
   // ... create route file for each section
   ```

2. **Remove Tabs from EventEditPage** (30 min)
   ```tsx
   // BEFORE: <Tabs><TabsList>...</TabsList></Tabs>
   // AFTER: <Outlet /> (renders section based on route)
   ```

3. **Update Navigation** (30 min)
   ```tsx
   // Change from: onClick={setActiveTab('media')}
   // Change to: <Link to={`/events/${eventId}/media`}>
   ```

**Verification**:
- [ ] All event sections accessible via sidebar
- [ ] URLs are RESTful: `/events/:eventId/media`
- [ ] Back button works correctly
- [ ] No horizontal tabs visible on event pages

---

### Phase 7: Top Bar Event Display (30 min)

**Goal**: Show selected event name prominently in top bar.

**Files to Modify**:
1. `frontend/fundrbolt-admin/src/components/layout/header.tsx`

**Steps**:

1. **Add Event Name Display** (20 min)
   ```tsx
   const { selectedEventName } = useEventContext()
   return (
     <Header>
       {selectedEventName && (
         <div className="font-semibold text-lg">
           Event: {selectedEventName}
         </div>
       )}
       {/* ... existing header content */}
     </Header>
   )
   ```

2. **Add Truncation for Long Names** (10 min)
   ```tsx
   <div className="max-w-md truncate" title={selectedEventName}>
     Event: {selectedEventName}
   </div>
   ```

**Verification**:
- [ ] Event name displays in top bar when event selected
- [ ] Name truncates with ellipsis if too long
- [ ] Tooltip shows full name on hover

---

### Phase 8: Settings Page Cleanup (30 min)

**Goal**: Remove duplicate hamburger menu and search bar from settings pages.

**Files to Modify**:
1. `frontend/fundrbolt-admin/src/features/settings/index.tsx`

**Steps**:

1. **Remove Duplicate Header** (15 min)
   ```tsx
   // BEFORE:
   <Header><Search /></Header>
   // AFTER: Remove this (main layout already has header)
   ```

2. **Simplify Layout** (15 min)
   ```tsx
   // Use <Main> without redundant header wrapper
   ```

**Verification**:
- [ ] Settings pages show no duplicate hamburger menu
- [ ] Settings pages show no duplicate search bar
- [ ] Layout remains clean and functional

---

### Phase 9: Testing & Polish (1-2 hours)

**Goal**: Comprehensive testing and bug fixes.

**Steps**:

1. **E2E Tests** (45 min)
   ```typescript
   // tests/e2e/navigation.spec.ts
   test('sidebar navigation flow', async ({ page }) => {
     await login(page)
     await selectNpo(page, 'Test NPO')
     // Verify event auto-selected
     await clickSidebarItem(page, 'Media')
     // Verify URL changed, badge counts visible
   })
   ```

2. **Manual Testing Checklist** (30 min)
   - [ ] Login as different roles (Super Admin, NPO Admin, Staff)
   - [ ] Switch between NPOs with different event counts
   - [ ] Verify smart default selects correct event
   - [ ] Test search with 10+ events
   - [ ] Test initial avatars with/without branding colors
   - [ ] Collapse/expand nav groups, refresh page
   - [ ] Navigate all event sections via sidebar
   - [ ] Check responsiveness (mobile, tablet, desktop)

3. **Bug Fixes & Polish** (30 min)
   - Fix any issues found in manual testing
   - Adjust spacing, alignment, colors
   - Add loading skeletons for badge counts

**Verification**:
- [ ] All automated tests pass: `make test`
- [ ] Manual testing checklist complete
- [ ] No console errors or warnings
- [ ] Performance: Sidebar renders <50ms

---

## Deployment Checklist

Before merging to main:

- [ ] All tests pass (unit + integration + E2E)
- [ ] No TypeScript errors: `pnpm type-check`
- [ ] No ESLint errors: `pnpm lint`
- [ ] Backend OpenAPI docs updated
- [ ] Feature tested on staging environment
- [ ] Database indexes verified (if stats endpoint slow)
- [ ] Screenshots/video demo for PR description

---

## Rollback Plan

If critical bugs found in production:

1. **Feature Flag**: Toggle off `enable-new-sidebar-nav` (if implemented)
2. **Revert Commit**: `git revert <commit-hash>`
3. **Hotfix**: Keep old EventEditPage tabs for 1 sprint as fallback
4. **Communicate**: Notify users of temporary revert

---

## Common Pitfalls

⚠️ **Pitfall 1**: Forgetting to invalidate React Query cache on navigation
- **Solution**: Use TanStack Router's `useNavigate` with `preload` option

⚠️ **Pitfall 2**: WCAG contrast failures with dark branding colors
- **Solution**: Always test with navy background + white text as fallback

⚠️ **Pitfall 3**: Badge counts don't update after adding items
- **Solution**: Invalidate `eventStats` query key after mutations

⚠️ **Pitfall 4**: localStorage conflicts between users on shared devices
- **Solution**: Clear all localStorage keys on logout

⚠️ **Pitfall 5**: Slow stats endpoint with large events (1000+ items)
- **Solution**: Add database indexes, consider Redis caching

---

## Performance Optimization Tips

1. **Lazy Load Event Sections**: Use code splitting for large components
2. **Prefetch on Hover**: Use TanStack Router's `preload="intent"`
3. **Debounce Search**: Wait 300ms before filtering events
4. **Virtual Scrolling**: If 100+ events, use `react-virtuoso`
5. **Optimize Avatars**: Cache generated SVG avatars in memory

---

## Next Steps

After merging this feature:

1. **Monitor Metrics**: Track sidebar navigation usage in analytics
2. **User Feedback**: Gather feedback from beta users
3. **Iterate**: Adjust based on real-world usage patterns
4. **Future Enhancements**:
   - Keyboard shortcuts for navigation (Cmd+K menu)
   - Recent events list
   - Pin favorite events to top
   - Drag-and-drop nav item reordering

---

## Questions or Issues?

- Review [spec.md](./spec.md) for requirements
- Check [research.md](./research.md) for technical decisions
- See [data-model.md](./data-model.md) for state structures
- Read [contracts/api-contracts.md](./contracts/api-contracts.md) for API details
