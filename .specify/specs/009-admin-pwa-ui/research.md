# Research: Admin PWA UI Cleanup & Role-Based Access Control

**Feature**: 009-admin-pwa-ui
**Date**: 2025-11-17
**Status**: Complete

## Overview

This document consolidates research findings for unknowns identified in the Technical Context during plan creation. All NEEDS CLARIFICATION items have been resolved through investigation of the existing codebase, constitution, and technology best practices.

## Research Tasks

### 1. Role-Based Access Control in React

**Decision**: Use TanStack Router navigation guards + TanStack Query role-based data fetching

**Rationale**:
- TanStack Router is already in the project dependencies (`package.json`)
- Supports `beforeLoad` hooks for route-level authorization checks
- TanStack Query (also in dependencies) allows per-query role-based filtering
- Separates concerns: Router handles navigation, Query handles data access
- Backend still enforces authorization (defense in depth)

**Alternatives considered**:
- **React Context + manual route guarding**: More boilerplate, harder to maintain across many routes
- **Higher-Order Components (HOCs)**: Legacy pattern, less type-safe with TypeScript
- **Middleware in custom router**: Would require replacing TanStack Router (violates constitution - no new tech)

**Implementation approach**:
```typescript
// Route guard example
export const Route = createFileRoute('/_authenticated/npos')({
  beforeLoad: async ({ context }) => {
    const { user } = context.auth
    if (!['SuperAdmin', 'NPO Admin', 'Event Coordinator'].includes(user.role)) {
      throw redirect({ to: '/unauthorized' })
    }
  },
})

// Query with role-based filtering
const { data: npos } = useQuery({
  queryKey: ['npos', user.role, npoContextId],
  queryFn: () => api.getNpos({ role: user.role, contextId: npoContextId }),
})
```

**Best practices applied**:
- Role information stored in JWT claims (already implemented in backend)
- Frontend guards are UX optimization, not security enforcement
- Backend API validates every request independently
- Use React Suspense boundaries for loading states

---

### 2. Profile Page Form Validation

**Decision**: React Hook Form + Zod schema validation (matching backend Pydantic schemas)

**Rationale**:
- React Hook Form already in dependencies (`@hookform/resolvers` in package.json)
- Zod provides TypeScript-first schema validation
- Can mirror backend Pydantic validation rules exactly
- Reduces server round-trips for validation errors
- Radix UI components (already in use) integrate well with React Hook Form

**Alternatives considered**:
- **Formik**: More verbose, slower performance with large forms
- **Plain controlled components**: No validation framework, manual error handling
- **Backend-only validation**: Poor UX (requires server round-trip for every error)

**Implementation approach**:
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const profileSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  organization_name: z.string().max(255).optional(),
  address_line1: z.string().max(255).optional(),
  // ... other fields matching backend User model
})

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(profileSchema),
})
```

**Best practices applied**:
- Client-side validation for UX (fast feedback)
- Server-side validation for security (untrusted client)
- Consistent error messages between frontend/backend
- Accessible error announcements (Radix UI Label + error text)

---

### 3. Search Implementation Strategy

**Decision**: Backend full-text search with PostgreSQL `tsvector` + frontend debounced input

**Rationale**:
- PostgreSQL is already the database (no new tech)
- Full-text search via `tsvector` columns supports fuzzy matching
- Can search across users, npos, events in single query with `UNION`
- Role-based filtering applied at query level (joins with user_role_assignments)
- Debouncing on frontend prevents excessive API calls

**Alternatives considered**:
- **Elasticsearch/Algolia**: Over-engineered for 1000 record search goal, violates YAGNI
- **Client-side filtering**: Won't scale, doesn't work with role-based filtering
- **SQLAlchemy ORM `ilike`**: Works but slower than tsvector for text search

**Implementation approach**:

Backend (SQLAlchemy):
```python
from sqlalchemy import select, union_all, func

# Create tsvector index (migration):
# CREATE INDEX idx_users_search ON users USING gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || email));

def search(db: AsyncSession, query: str, user_role: str, npo_id: int):
    ts_query = func.plainto_tsquery('english', query)

    # Union search across entities with role filtering
    users_query = select(...).where(func.to_tsvector(...).match(ts_query))
    npos_query = select(...).where(func.to_tsvector(...).match(ts_query))
    events_query = select(...).where(func.to_tsvector(...).match(ts_query))

    # Apply role-based filtering...
    return await db.execute(union_all(users_query, npos_query, events_query))
```

Frontend (React):
```typescript
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const [searchTerm, setSearchTerm] = useState('')
const debouncedSearch = useDebouncedValue(searchTerm, 300) // 300ms delay

const { data: results } = useQuery({
  queryKey: ['search', debouncedSearch],
  queryFn: () => api.search(debouncedSearch),
  enabled: debouncedSearch.length >= 2, // Only search with 2+ chars
})
```

**Best practices applied**:
- Search latency target: <300ms (per Technical Context)
- Add database index on tsvector columns
- Return top 20 results per entity type (limit 1000 total)
- Include result type (user/npo/event) for UI rendering

---

### 4. NPO Context Selector State Management

**Decision**: Zustand global store + React Context for consumption

**Rationale**:
- Zustand already in dependencies (lightweight, 1KB)
- Simpler API than Redux (no actions/reducers boilerplate)
- Persists to localStorage automatically (survives page refresh)
- Can be consumed via hooks (`useNpoContext()`) anywhere in component tree
- Integrates with TanStack Query to refetch data on NPO change

**Alternatives considered**:
- **React Context alone**: Causes full subtree re-renders on change (performance issue)
- **Redux**: Over-engineered for single state slice (violates YAGNI)
- **URL state (search params)**: Good for shareable links but NPO context shouldn't be in URL (security: users might share links with wrong NPO context)

**Implementation approach**:
```typescript
// stores/npo-context.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NpoContextStore {
  selectedNpoId: number | null
  availableNpos: Array<{ id: number; name: string }>
  setSelectedNpo: (npoId: number | null) => void
  setAvailableNpos: (npos: Array<{ id: number; name: string }>) => void
}

export const useNpoContextStore = create<NpoContextStore>()(
  persist(
    (set) => ({
      selectedNpoId: null,
      availableNpos: [],
      setSelectedNpo: (npoId) => set({ selectedNpoId: npoId }),
      setAvailableNpos: (npos) => set({ availableNpos: npos }),
    }),
    { name: 'npo-context-storage' }
  )
)

// hooks/useNpoContext.ts
export const useNpoContext = () => {
  const { selectedNpoId, availableNpos, setSelectedNpo } = useNpoContextStore()
  const queryClient = useQueryClient()

  const selectNpo = (npoId: number | null) => {
    setSelectedNpo(npoId)
    // Invalidate all queries to refetch with new NPO context
    queryClient.invalidateQueries()
  }

  return { selectedNpoId, availableNpos, selectNpo }
}
```

**Best practices applied**:
- Persist NPO selection across sessions (better UX)
- Clear selection on logout (security)
- Invalidate TanStack Query cache on NPO change (data consistency)
- Load available NPOs from backend on login (role-based list)

---

### 5. Dashboard Component Architecture

**Decision**: Role-specific dashboard components with shared layout + lazy loading

**Rationale**:
- Four distinct dashboards per spec (SuperAdmin, NPO, Auctioneer, Event)
- Dashboards are placeholders initially (no complex logic yet)
- Lazy load with React `lazy()` and Suspense (performance)
- Share common layout/header components (DRY principle)
- Route to correct dashboard based on JWT role claim

**Alternatives considered**:
- **Single dashboard with conditional rendering**: Becomes unmaintainable with 4+ roles
- **Eager loading all dashboards**: Wastes bandwidth, slower initial load
- **Backend-driven UI composition**: Over-engineered, violates separation of concerns

**Implementation approach**:
```typescript
// pages/DashboardPage.tsx
import { lazy, Suspense } from 'react'
import { useAuth } from '@/hooks/useAuth'

const SuperAdminDashboard = lazy(() => import('@/components/dashboards/SuperAdminDashboard'))
const NpoAdminDashboard = lazy(() => import('@/components/dashboards/NpoAdminDashboard'))
const AuctioneerDashboard = lazy(() => import('@/components/dashboards/AuctioneerDashboard'))
const EventDashboard = lazy(() => import('@/components/dashboards/EventDashboard'))

export const DashboardPage = () => {
  const { user } = useAuth()

  const dashboardMap = {
    'SuperAdmin': SuperAdminDashboard,
    'NPO Admin': NpoAdminDashboard,
    'Event Coordinator': AuctioneerDashboard,
    'Staff': EventDashboard,
  }

  const DashboardComponent = dashboardMap[user.role] || EventDashboard

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardComponent />
    </Suspense>
  )
}
```

**Best practices applied**:
- Code splitting reduces initial bundle size
- Fallback loading state (skeleton) for better perceived performance
- TypeScript ensures role keys match exactly
- Placeholder components are ~20 lines each (minimal overhead)

---

### 6. Removing Template Components

**Decision**: Delete unused components + update route definitions + remove from navigation

**Rationale**:
- Template components (Tasks, Chats, Apps, Settings panel) are not in spec
- Violates YAGNI to keep unused code
- Reduces bundle size and cognitive load
- Clear separation: Admin PWA is for NPO/event management, not task tracking

**Alternatives considered**:
- **Comment out instead of delete**: Git history preserves deleted code, comments clutter codebase
- **Feature flags**: Over-engineered for permanent removal

**Implementation approach**:
1. **Identify components to remove** (via grep search):
   - `src/pages/tasks/`
   - `src/pages/chats/`
   - `src/pages/apps/`
   - `src/components/theme-toggle/` (no dark mode per spec)
   - `src/components/hamburger-menu/`

2. **Update route definitions**:
   - Remove routes from `src/routes/` directory
   - Update `_authenticated.tsx` layout to exclude deleted routes

3. **Update navigation** (`src/components/layout/Sidebar.tsx`):
   - Remove nav items: Tasks, Chats, Apps, Settings, Appearance, Help Center
   - Add role-based nav items: NPOs, Events, Users, Sponsors, Auction Items

4. **Update layout** (`src/components/layout/AppShell.tsx`):
   - Remove hamburger menu button
   - Add ProfileDropdown to header (persistent across all pages)
   - Add NpoSelector to top-left

**Best practices applied**:
- Delete unused code (don't comment out)
- Update TypeScript types to remove deleted component references
- Run lint + type-check after deletion to catch broken imports

---

## Summary of Decisions

| Unknown | Decision | Technology/Pattern |
|---------|----------|-------------------|
| Role-based access in React | TanStack Router guards + Query filters | TanStack Router `beforeLoad`, TanStack Query `queryFn` |
| Profile form validation | React Hook Form + Zod schemas | `@hookform/resolvers` + `zod` |
| Search implementation | PostgreSQL tsvector + debounced input | `tsvector` index, `plainto_tsquery`, Zustand debounce |
| NPO context state | Zustand global store | `zustand` with `persist` middleware |
| Dashboard architecture | Role-specific lazy-loaded components | React `lazy()` + Suspense |
| Template cleanup | Delete unused components/routes | File deletion + route/nav updates |

**All NEEDS CLARIFICATION resolved**. Proceeding to Phase 1 (data-model.md, contracts/).
