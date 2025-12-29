# Quickstart: Admin PWA UI Cleanup & Role-Based Access Control

**Feature**: 009-admin-pwa-ui
**Branch**: `009-admin-pwa-ui`
**Estimated Time**: 2-3 week sprint

## Overview

This feature removes unnecessary template components from the admin PWA and implements comprehensive role-based access control with four distinct dashboards, persistent profile access, editable profiles, NPO context selection, and cross-resource search.

## Prerequisites

- Backend running on `http://localhost:8000` (FastAPI)
- Frontend running on `http://localhost:5173` (Vite dev server)
- PostgreSQL database with seeded roles (SuperAdmin, NPO Admin, Event Coordinator, Staff, Donor)
- Redis running on `localhost:6379` for session management
- Test user accounts with different roles for testing

## Development Workflow

### Phase 1: Template Cleanup (Week 1, Days 1-2)

**Goal**: Remove unused template components and simplify navigation.

**Steps**:

1. **Identify and delete unused components**:
   ```bash
   cd frontend/fundrbolt-admin

   # Remove entire directories (Tasks, Chats, Apps, etc.)
   rm -rf src/pages/tasks
   rm -rf src/pages/chats
   rm -rf src/pages/apps
   rm -rf src/components/theme-toggle
   rm -rf src/components/hamburger-menu
   ```

2. **Update route definitions**:
   - Remove routes in `src/routes/` for deleted pages
   - Update `src/routes/_authenticated.tsx` layout to exclude deleted routes

3. **Update navigation** (`src/components/layout/Sidebar.tsx`):
   - Remove nav items: Tasks, Chats, Apps, Settings, Appearance, Help Center
   - Add placeholders for: NPOs, Events, Users (will implement full pages later)

4. **Update layout** (`src/components/layout/AppShell.tsx`):
   - Remove hamburger menu button
   - Ensure header structure is ready for ProfileDropdown (next phase)

5. **Test**: Run `pnpm dev` and verify no broken imports/routes, navigation renders cleanly.

---

### Phase 2: Persistent Profile Dropdown (Week 1, Days 3-4)

**Goal**: Make profile dropdown accessible from all pages, not just dashboard.

**Steps**:

1. **Modify ProfileDropdown component** (`src/components/layout/ProfileDropdown.tsx`):
   - Simplify menu to only show: "Profile" and "Logout"
   - Remove: Billing, Settings, New Team options

2. **Move ProfileDropdown to AppShell** (`src/components/layout/AppShell.tsx`):
   - Place in header/topbar (top-right corner)
   - Ensure it renders on all authenticated pages, not just dashboard

3. **Test**:
   - Navigate to different pages (NPOs, Events, Users)
   - Verify dropdown appears consistently
   - Click "Profile" → should navigate to `/profile`
   - Click "Logout" → should clear session and redirect to login

---

### Phase 3: Role-Based Dashboard Routing (Week 1, Day 5 - Week 2, Day 1)

**Goal**: Route users to role-specific dashboards on login.

**Steps**:

1. **Create placeholder dashboard components**:
   ```tsx
   // src/components/dashboards/SuperAdminDashboard.tsx
   export const SuperAdminDashboard = () => (
     <div className="p-6">
       <h1 className="text-2xl font-bold">SuperAdmin Dashboard</h1>
       <p>Coming soon: Platform-wide analytics and management</p>
     </div>
   )

   // Repeat for: NpoAdminDashboard, AuctioneerDashboard, EventDashboard
   ```

2. **Update DashboardPage** (`src/pages/DashboardPage.tsx`):
   - Use `useAuth()` hook to get current user role
   - Lazy load appropriate dashboard component based on role
   - Add Suspense fallback skeleton

3. **Add route guard** (`src/routes/_authenticated.tsx`):
   ```tsx
   export const Route = createFileRoute('/_authenticated')({
     beforeLoad: async ({ context }) => {
       const { user } = context.auth
       if (user.role === 'Donor') {
         throw redirect({ to: '/unauthorized' })
       }
     },
   })
   ```

4. **Test**:
   - Log in as SuperAdmin → see SuperAdminDashboard
   - Log in as NPO Admin → see NpoAdminDashboard
   - Log in as Event Coordinator → see AuctioneerDashboard
   - Log in as Staff → see EventDashboard
   - Log in as Donor → redirect to /unauthorized

---

### Phase 4: Profile Page Editing (Week 2, Days 2-3)

**Goal**: Allow users to update their profile information.

**Steps**:

1. **Create Zod validation schema** (`src/schemas/profile.ts`):
   ```tsx
   import { z } from 'zod'

   export const profileSchema = z.object({
     first_name: z.string().min(1).max(100),
     last_name: z.string().min(1).max(100),
     email: z.string().email(),
     phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional().or(z.literal('')),
     organization_name: z.string().max(255).optional().or(z.literal('')),
     address_line1: z.string().max(255).optional().or(z.literal('')),
     // ... other address fields
   })
   ```

2. **Create ProfileForm component** (`src/components/profile/ProfileForm.tsx`):
   - Use React Hook Form with zodResolver
   - Integrate with Radix UI form components (Label, Input, Button)
   - Display validation errors inline
   - Submit via `PATCH /api/v1/users/{id}/profile`

3. **Update ProfilePage** (`src/pages/ProfilePage.tsx`):
   - Fetch current user data via TanStack Query
   - Render ProfileForm with prefilled values
   - Handle success/error states

4. **Backend**: Add profile update endpoint (`backend/app/api/v1/users.py`):
   - See `contracts/profile-update.yaml` for spec
   - Validate with Pydantic schema
   - Ensure users can only update their own profile (or SuperAdmin can update any)

5. **Test**:
   - Edit each field, verify client-side validation
   - Submit valid data → verify DB update and UI refresh
   - Submit invalid data (e.g., bad email) → verify error messages
   - Test phone regex (E.164 format)

---

### Phase 5: NPO Context Selector (Week 2, Days 4-5)

**Goal**: Add NPO selector to top-left, filter data by selected NPO.

**Steps**:

1. **Create Zustand store** (`src/stores/npo-context.ts`):
   - See `research.md` section 4 for implementation
   - Use `persist` middleware for localStorage
   - Export `useNpoContextStore` hook

2. **Create useNpoContext hook** (`src/hooks/useNpoContext.ts`):
   - Wrap store with query client invalidation logic
   - Fetch available NPOs on mount based on user role

3. **Create NpoSelector component** (`src/components/layout/NpoSelector.tsx`):
   - Render dropdown with available NPOs
   - SuperAdmin: Show "Fundrbolt Platform" + all NPOs
   - NPO Admin/Staff: Show only assigned NPO (disabled if single NPO)
   - Event Coordinator: Show registered NPOs
   - On selection change: Call `selectNpo(npoId)` → invalidates queries

4. **Add to AppShell** (`src/components/layout/AppShell.tsx`):
   - Place in top-left corner (replacing Teams icon)
   - Display selected NPO name or "Fundrbolt Platform"

5. **Update data fetching queries**:
   - Modify `useQuery` calls in NPO, Event, User list pages
   - Add `npoId` parameter from `useNpoContext()`
   - Backend applies filtering (see `contracts/npo-context-filtering.yaml`)

6. **Backend**: Update list endpoints (`backend/app/api/v1/npos.py`, `events.py`, `users.py`):
   - Accept `npoId` query parameter
   - Apply role-based filtering logic (see `data-model.md` for rules)

7. **Test**:
   - Log in as SuperAdmin → select "Fundrbolt Platform" → see all NPOs/events/users
   - Select specific NPO → see only that NPO's data
   - Log in as NPO Admin → selector shows only assigned NPO
   - Change NPO selection → verify data refetches and updates

---

### Phase 6: Search Implementation (Week 3, Days 1-3)

**Goal**: Make search bar functional with cross-resource search.

**Steps**:

1. **Backend: Create search endpoint** (`backend/app/api/v1/search.py`):
   - See `contracts/search.yaml` for API spec
   - Implement PostgreSQL tsvector search (see `research.md` section 3)
   - Create database indexes:
     ```sql
     CREATE INDEX idx_users_search ON users USING gin(
       to_tsvector('english', first_name || ' ' || last_name || ' ' || email)
     );
     CREATE INDEX idx_npos_search ON npos USING gin(
       to_tsvector('english', name || ' ' || email)
     );
     CREATE INDEX idx_events_search ON events USING gin(
       to_tsvector('english', title)
     );
     ```
   - Apply role-based filtering per `data-model.md` table
   - Return top 20 results per entity type

2. **Frontend: Create search service** (`src/services/search.ts`):
   - Export `searchResources(query: string)` function
   - Call `GET /api/v1/search?q={query}&npoId={selectedNpoId}`

3. **Frontend: Update SearchBar component** (`src/components/search/SearchBar.tsx`):
   - Add debounced input (300ms delay)
   - Only trigger search with 2+ characters
   - Use TanStack Query with debounced value

4. **Frontend: Create SearchResults component** (`src/components/search/SearchResults.tsx`):
   - Render grouped results (Users, NPOs, Events)
   - Display entity-specific info (name, email, role, status)
   - Click result → navigate to detail page

5. **Test**:
   - Search "john" → see matching users
   - Search "food bank" → see matching NPO
   - Search "gala" → see matching events
   - Verify role filtering: NPO Admin only sees own NPO results
   - Verify NPO context filtering: SuperAdmin with NPO selected sees filtered results
   - Test debouncing: Type quickly, verify single API call after 300ms

---

### Phase 7: Role-Based Navigation (Week 3, Day 4)

**Goal**: Show/hide navigation items based on user role.

**Steps**:

1. **Create useRoleBasedNav hook** (`src/hooks/useRoleBasedNav.ts`):
   ```tsx
   export const useRoleBasedNav = () => {
     const { user } = useAuth()

     const navItems = [
       { name: 'Dashboard', path: '/dashboard', roles: ['SuperAdmin', 'NPO Admin', 'Event Coordinator', 'Staff'] },
       { name: 'NPOs', path: '/npos', roles: ['SuperAdmin', 'NPO Admin'] },
       { name: 'Events', path: '/events', roles: ['SuperAdmin', 'NPO Admin', 'Event Coordinator', 'Staff'] },
       { name: 'Users', path: '/users', roles: ['SuperAdmin', 'NPO Admin'] },
       // ... other items
     ]

     return navItems.filter(item => item.roles.includes(user.role))
   }
   ```

2. **Update Sidebar component** (`src/components/layout/Sidebar.tsx`):
   - Use `useRoleBasedNav()` hook
   - Render only items matching user's role

3. **Test**:
   - Log in as each role
   - Verify only appropriate nav items appear

---

### Phase 8: Testing & Polish (Week 3, Day 5)

**Goal**: Comprehensive testing and bug fixes.

**Steps**:

1. **Unit tests**:
   - Backend: Test role filtering logic in search/list endpoints
   - Frontend: Test ProfileForm validation, NpoSelector state changes

2. **Integration tests**:
   - Login → dashboard routing for each role
   - Profile update full flow
   - NPO selection → data refetch
   - Search with role filtering

3. **Manual testing checklist**:
   - [ ] SuperAdmin sees all NPOs in selector
   - [ ] NPO Admin sees only assigned NPO (selector disabled)
   - [ ] Event Coordinator sees dashboards for assigned events
   - [ ] Staff cannot access NPO list
   - [ ] Profile dropdown appears on all pages
   - [ ] Profile editing validates and saves correctly
   - [ ] Search returns relevant results with role filtering
   - [ ] Navigation shows only role-appropriate items

4. **Performance testing**:
   - Verify dashboard load < 2s
   - Verify search results < 300ms
   - Check bundle size (lazy loading working)

5. **Accessibility audit**:
   - Keyboard navigation works
   - Screen reader announces errors
   - Focus management on modals/dropdowns

---

## API Endpoints Reference

See `contracts/` directory for full OpenAPI specs:

- `profile-update.yaml`: PATCH /api/v1/users/{id}/profile
- `search.yaml`: GET /api/v1/search
- `npo-context-filtering.yaml`: GET /api/v1/npos, /events, /users (with role filtering)

---

## Common Issues & Troubleshooting

### Issue: "NPO selector not updating data"

**Solution**: Verify `selectNpo()` calls `queryClient.invalidateQueries()`. Check React DevTools → TanStack Query to see cache invalidation.

### Issue: "Search returns too many results"

**Solution**: Check backend limit (20 per entity type). Verify indexes exist on tsvector columns. Check `EXPLAIN ANALYZE` query plan.

### Issue: "Profile form validation not working"

**Solution**: Ensure Zod schema matches backend Pydantic schema exactly. Check browser console for validation errors.

### Issue: "Role-based dashboard shows wrong component"

**Solution**: Verify JWT token has correct role claim. Check `useAuth()` hook returns expected role string.

---

## Success Criteria

✅ Template cleanup: No Tasks, Chats, Apps, theme toggle, or hamburger menu visible
✅ Profile dropdown: Appears on all authenticated pages (not just dashboard)
✅ Dashboards: Each role sees appropriate dashboard on login
✅ Profile editing: All User model fields editable with validation
✅ NPO selector: SuperAdmin can switch contexts, others see assigned NPO(s)
✅ Search: Returns relevant results in <300ms with role filtering
✅ Navigation: Only role-appropriate items visible
✅ Tests: 80%+ backend coverage, key frontend components tested
✅ Performance: Dashboard <2s, page navigation <500ms, profile save <1s

---

## Next Steps (Post-Implementation)

1. **Phase 2 (speckit.tasks)**: Break down into granular tasks
2. **Phase 3 (speckit.implement)**: Execute tasks with test-driven development
3. **Phase 4 (PR review)**: Submit PR with contract tests, screenshot proof
4. **Phase 5 (Deployment)**: Merge to main, deploy to staging, smoke test, deploy to prod

---

**Questions?** See `research.md` for technical decisions, `data-model.md` for entity details, and `spec.md` for user stories and acceptance criteria.
