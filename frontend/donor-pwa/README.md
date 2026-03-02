# Fundrbolt Donor PWA

Progressive Web App (PWA) for donors to browse events, register as guests, manage profiles, and participate in nonprofit auctions.

## Features

- **Public Event Discovery**: Browse events by slug-based URLs (e.g., `/events/spring-gala-2025`)
- **Event Registration**: Multi-step wizard for donor registration with guest management
- **Meal Selection**: Per-guest meal preferences with dietary restrictions
- **Branded Event Pages**: Custom logos, banners, colors per event
- **Donor Authentication**: Login, registration, logout with JWT tokens
- **Session Management**: Auto-login, token refresh, session expiry warnings (2-min countdown)
- **Mobile-First Design**: Optimized for phones/tablets with navy theme
- **Legal Compliance**: Terms of Service, Privacy Policy, Cookie Consent (GDPR)
- **Responsive Design**: Fluid layouts with Tailwind v4
- **Accessibility**: ARIA labels, keyboard navigation

## Technology Stack

**UI:** [ShadcnUI](https://ui.shadcn.com) (TailwindCSS + RadixUI)

**Build Tool:** [Vite](https://vitejs.dev/) 6.0+

**Framework:** [React](https://react.dev/) 18+

**Routing:** [TanStack Router](https://tanstack.com/router/latest) v1

**State Management:** [Zustand](https://github.com/pmndrs/zustand) 5.0+

**Data Fetching:** [TanStack Query](https://tanstack.com/query/latest) v5

**HTTP Client:** [Axios](https://axios-http.com/) 1.7+

**Type Checking:** [TypeScript](https://www.typescriptlang.org/) 5.6+

**Linting:** [ESLint](https://eslint.org/) 9+

**Icons:** [Lucide Icons](https://lucide.dev/icons/)

## Prerequisites

- **Node.js**: 22+ (managed with NVM)
- **pnpm**: 9+ for package management
- **Backend API**: Running on http://localhost:8000

### Quick Start

```bash
cd frontend/donor-pwa
pnpm install
pnpm dev
```

Application runs at <http://localhost:5174>

## Architecture

### Technology Stack (Shared with Admin PWA)

Both Donor PWA and Admin PWA use identical technology stacks and configurations to ensure consistency:

**UI Framework:** [React](https://react.dev/) 19+ with TypeScript 5.6+

**Build Tool:** [Vite](https://vitejs.dev/) 7.0+ with identical plugin configuration

**Routing:** [TanStack Router](https://tanstack.com/router/latest) v1 (file-based routes)

**Styling:** [Tailwind CSS](https://tailwindcss.com/) v4 (CSS-first, no config file)

**Components:** [shadcn/ui](https://ui.shadcn.com) (New York style, slate base color)

**State Management:** [Zustand](https://github.com/pmndrs/zustand) 5.0+

**Data Fetching:** [TanStack Query](https://tanstack.com/query/latest) v5 + [Axios](https://axios-http.com/) 1.7+

**Icons:** [Lucide Icons](https://lucide.dev/icons/)

**Linting:** [ESLint](https://eslint.org/) 9+ (shared config)

### Configuration Consistency

Both PWAs share identical configurations for maximum consistency:

**`vite.config.ts`**:

```typescript
export default defineConfig({
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    react(),
    tailwindcss()
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})
```

**`components.json`** (shadcn/ui):

```json
{
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": { "config": "", "css": "src/styles/index.css", "baseColor": "slate", "cssVariables": true }
}
```

**`tsconfig.json`**:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@fundrbolt/shared": ["../shared/src/index.ts"],
      "@fundrbolt/shared/*": ["../shared/src/*"]
    }
  }
}
```

### Design System

**Color Theme**:

- **Donor PWA**: Navy blue theme (OKLCH hue 250°) for visual differentiation
- **Admin PWA**: Black/neutral theme (default shadcn/ui)
- **Shared**: Both use OKLCH color space for perceptual uniformity

**Typography** (Identical):

- Font families: Inter, Manrope (defined in `theme.css`)
- Base text sizing via Tailwind utilities (`text-base`, `text-sm`, etc.)
- Consistent heading hierarchy (`h1`-`h6`)

**Spacing Patterns** (Identical):

- Container padding: `p-4`, `p-6` (mobile/desktop)
- Vertical spacing: `space-y-4`, `space-y-6`, `gap-4`, `gap-6`
- Horizontal gaps: `gap-4`, `gap-6`
- Margins: `m-4`, `m-6` for standalone elements

**Border Radius** (Identical):

- Base radius: `0.625rem` (10px)
- Variants: `radius-sm`, `radius-md`, `radius-lg`, `radius-xl`

### Component Library

Both PWAs use identical **shadcn/ui** components from `src/components/ui/`:

- **Forms**: Button, Input, Textarea, Label, Checkbox, Radio, Select
- **Layout**: Card, Separator, Sheet, Sidebar, Collapsible
- **Overlays**: Dialog, Alert Dialog, Popover, Dropdown Menu
- **Feedback**: Toast, Alert, Badge, Progress, Skeleton
- **Data**: Table, Pagination, Calendar, Avatar
- **Navigation**: Command, Tabs, Scroll Area

**Usage Example**:

```tsx
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function RegistrationForm() {
  return (
    <Card className="space-y-6">
      <CardHeader>
        <CardTitle>Register for Event</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input placeholder="Full Name" />
        <Button>Submit</Button>
      </CardContent>
    </Card>
  )
}
```

### Session Management Architecture

**Token Storage Strategy**:

- **Access Tokens**: Memory-only (Zustand store, not persisted) - expires in 15 minutes
- **Refresh Tokens**: `localStorage` with 7-day expiry
- **Rationale**: Balance security (access token not persisted) with UX (auto-login via refresh token)

**Flow**:

1. **Login**: Store access token in memory, refresh token in `localStorage`
2. **App Load**: Check `localStorage` for valid refresh token → auto-login
3. **401 Error**: Axios interceptor uses refresh token to get new access token
4. **Session Expiry**: Show modal 2 minutes before expiry with countdown
5. **Logout**: Clear both tokens from memory and `localStorage`

**Implementation**:

```typescript
// Token storage utilities
export const saveRefreshToken = (token: string, expiryTimestamp: number) => {
  localStorage.setItem('refresh_token', token)
  localStorage.setItem('refresh_token_expiry', expiryTimestamp.toString())
}

export const getRefreshToken = (): string | null => {
  const token = localStorage.getItem('refresh_token')
  const expiry = localStorage.getItem('refresh_token_expiry')
  if (!token || !expiry) return null
  if (Date.now() >= parseInt(expiry)) {
    clearRefreshToken()
    return null
  }
  return token
}
```

**Files**:

- `src/lib/storage/tokens.ts` - Token storage utilities
- `src/stores/auth-store.ts` - Auth state (access token in memory only)
- `src/lib/axios.ts` - Token refresh interceptor
- `src/components/SessionExpiryWarning.tsx` - 2-minute countdown modal
- `src/components/ProtectedRoute.tsx` - Auth wrapper for routes

### Route Protection

**Pattern**: Use TanStack Router `beforeLoad` hook for authentication checks

```tsx
// Protected registration route
export const Route = createFileRoute('/events/$slug/register')({
  beforeLoad: async ({ context }) => {
    const { isAuthenticated } = useAuthStore.getState()
    const hasRefreshToken = hasValidRefreshToken()

    if (!isAuthenticated && !hasRefreshToken) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.pathname }
      })
    }
  }
})
```

### Shared Package Pattern

**Purpose**: Share types, utilities, and components between Admin and Donor PWAs

**Structure**:

```text
frontend/shared/
├── src/
│   ├── components/  # Shared UI components
│   ├── hooks/       # Shared React hooks
│   ├── utils/       # Shared utilities
│   ├── types/       # Shared TypeScript types
│   └── index.ts     # Main export
├── package.json
└── tsconfig.json
```

**Import Pattern**:

```typescript
import { SharedButton } from '@fundrbolt/shared/components'
import { useSharedHook } from '@fundrbolt/shared/hooks'
import type { SharedType } from '@fundrbolt/shared/types'
```

**Current Status**: Package exists but not yet populated (planned for future use)

### File-Based Routing

Both PWAs use **TanStack Router** with identical route patterns:

**Public Routes** (Donor PWA):

- `/` - Landing page
- `/events/:slug` - Event detail page
- `/sign-in`, `/sign-up` - Auth pages

**Protected Routes** (Donor PWA):

- `/events/:slug/register` - Event registration (requires auth)
- `/profile` - Donor profile

**Layout Hierarchy**:

```text
routes/
├── __root.tsx              # Root layout (theme, font, direction)
├── index.tsx               # Landing page
├── sign-in.tsx             # Login
├── sign-up.tsx             # Registration
└── events/
    ├── $slug.tsx           # Event layout
    ├── $slug.index.tsx     # Event details (public)
    └── $slug.register.tsx  # Registration (protected)
```

### State Management Patterns

**Zustand Stores**:

- **Auth Store**: User, tokens, login/logout methods
- **Event Branding Store**: Dynamic event colors/logos
- **Form State**: React Hook Form (ephemeral, component-level)

**React Query Caching**:

- Event data: `['event', slug]`
- Registration data: `['registration', eventId, userId]`
- Stale time: 5 minutes for event data
- Cache time: 10 minutes

### API Integration

**Axios Configuration**:

```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' }
})

// Request interceptor: Add auth token
api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// Response interceptor: Refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = getRefreshToken()
      if (refreshToken) {
        const { data } = await axios.post('/api/v1/auth/refresh', { refresh_token: refreshToken })
        useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
        // Retry original request
        return api(error.config)
      }
    }
    throw error
  }
)
```

### PWA Features (Future)

**Planned**:

- Service Worker for offline support
- Web App Manifest (`manifest.json`)
- Install prompt for "Add to Home Screen"
- Push notifications for event updates
- Background sync for registration submissions

**Current**: Standard SPA (not yet PWA-enabled)

### Accessibility

**Keyboard Navigation**:

- All interactive elements focusable
- Logical tab order
- Visible focus indicators

**ARIA Labels**:

- Form inputs labeled
- Buttons descriptive
- Dialog roles and properties

**Screen Readers**:

- Semantic HTML (`<nav>`, `<main>`, `<header>`)
- `aria-live` regions for dynamic content
- `aria-label` for icon-only buttons

### Performance

**Code Splitting**:

- TanStack Router auto-code-splitting enabled
- Route-level lazy loading
- Component-level dynamic imports

**Optimization**:

- Vite dev server with HMR
- Production build with tree-shaking
- Image optimization via Azure Blob CDN

**Bundle Size**:

- Target: < 300KB initial bundle
- Lazy routes: < 50KB each

### Development Workflow

**Local Development**:

```bash
pnpm dev              # Start dev server (port 5174)
pnpm build            # Production build
pnpm preview          # Preview production build
pnpm lint             # ESLint
pnpm type-check       # TypeScript validation
```

**Pre-Commit Hooks**:

```bash
./scripts/safe-commit.sh    # Run hooks with auto-retry
```

Hooks run: ESLint auto-fix, TypeScript check, trailing whitespace removal

**Environment Variables**:

```bash
VITE_API_URL=http://localhost:8000  # Backend API
```

### Deployment

**Target**: Azure Static Web Apps

**Build Command**: `pnpm build`

**Output Directory**: `dist/`

**API Integration**: Azure Functions proxy to FastAPI backend

**CI/CD**: GitHub Actions workflow (`.github/workflows/frontend-deploy.yml`)

---

## Differences from Admin PWA

While both PWAs share architecture, they differ in:

1. **Theme Colors**: Donor (navy), Admin (black/neutral)
2. **Routes**: Donor (public event pages), Admin (user management, NPO context)
3. **Features**: Donor (event registration), Admin (admin dashboards, search)
4. **Port**: Donor (5174), Admin (5173)

---

## Quick Start

### 1. Setup Node Environment

```bash
# Install NVM (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash

# Install and use Node 22
nvm install 22
nvm use 22
```

### 2. Install Dependencies

```bash
cd frontend/fundrbolt-admin
pnpm install
```

### 3. Configure Environment

Create `.env.local` file:

```bash
# Backend API URL
VITE_API_URL=http://localhost:8000
```

### 4. Start Development Server

```bash
pnpm dev
```

Application now running at:

- **App**: http://localhost:5173
- **Hot Reload**: Enabled

## Development Commands

### Running the App

```bash
# Development mode with hot reload
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Type check
pnpm type-check
```

### Code Quality

```bash
# Lint with ESLint
pnpm lint

# Auto-fix linting issues
pnpm lint:fix

# Format with Prettier (via ESLint)
pnpm format
```

### Testing

```bash
# Run unit tests (if configured)
pnpm test

# Run E2E tests with Playwright
pnpm test:e2e

# Open Playwright UI
pnpm playwright show-report
```

## Project Structure

```
frontend/fundrbolt-admin/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── ui/           # Shadcn UI components
│   │   ├── layout/       # Layout components (header, sidebar, NPO selector)
│   │   ├── legal/        # Legal components (TOS modal, cookie banner, consent)
│   │   ├── search/       # Search bar and results components
│   │   ├── dashboards/   # Role-based dashboard components
│   │   └── custom/       # Custom shared components
│   ├── features/         # Feature-based modules
│   │   ├── auth/         # Authentication (login, register, password reset)
│   │   ├── users/        # User management with pagination and NPO filtering
│   │   ├── settings/     # Settings, account, and password change
│   │   └── events/       # Event management
│   ├── hooks/            # Custom React hooks
│   │   ├── use-users.ts  # User management hooks (React Query)
│   │   ├── use-npo-context.ts  # NPO context hook
│   │   ├── use-role-based-nav.ts  # Role-based navigation
│   │   └── use-tos.ts    # Terms of Service hooks
│   ├── lib/              # Utilities and configurations
│   │   ├── axios.ts      # Axios configuration with interceptors
│   │   ├── api/          # API service layer
│   │   └── utils.ts      # Helper functions
│   ├── pages/            # Full-page components
│   │   └── legal/        # Legal pages (TOS, Privacy, Cookies, Consent)
│   ├── routes/           # TanStack Router routes
│   │   ├── __root.tsx    # Root route layout
│   │   ├── _authenticated/ # Protected routes with NPO context
│   │   └── (auth)/       # Auth routes (login, register)
│   ├── stores/           # Zustand state management
│   │   ├── auth-store.ts # Auth state (user, tokens, login/logout)
│   │   ├── npo-context.ts # NPO context state with localStorage
│   │   └── tos-store.ts  # TOS consent state
│   ├── services/         # API service layer
│   │   └── search.ts     # Search API client
│   ├── types/            # TypeScript type definitions
│   │   ├── api.ts        # API request/response types
│   │   ├── auth.ts       # Auth types
│   │   └── consent-history.ts # Consent history types
│   └── main.tsx          # Application entry point
├── public/               # Static assets
├── index.html            # HTML template
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
├── eslint.config.js      # ESLint configuration
└── package.json          # Dependencies and scripts
```

## Key Features Implementation

### Authentication Flow

1. **Login** (`/sign-in`):
   - Email/password validation
   - JWT token storage (localStorage)
   - Automatic redirect to dashboard
   - Remember me option

2. **Registration** (`/sign-up`):
   - Form validation (email, password strength)
   - Email verification required
   - Automatic login after verification

3. **Email Verification** (`/verify-email`):
   - Token-based verification
   - Resend verification email
   - Auto-login on success

4. **Password Reset**:
   - Request reset (`/password-reset`)
   - Confirm reset (`/password-reset-confirm`)
   - Token validation
   - Secure password update

5. **Session Management**:
   - Automatic token refresh (401 handling)
   - Session expiration warning (2 minutes before expiry)
   - "Stay Logged In" extend session
   - Auto-logout on expiration

### User Management (Admin)

1. **User List** (`/users`):
   - Server-side paginated table view
   - Search and filter by NPO membership
   - NPO memberships display (shows all active NPO affiliations)
   - Role badges
   - Quick actions (edit, delete, change role)
   - Proper page count based on total results

2. **Create User**:
   - Invite dialog with form
   - Role selection
   - NPO assignment (for NPO roles)
   - Password generation

3. **Update User**:
   - Edit user details
   - Change role
   - Activate/deactivate account

4. **Password Change** (`/settings/password`):
   - Change password page with current password verification
   - Password strength validation
   - Accessible from Settings menu

### NPO Context Management

1. **NPO Selector** (top-left corner):
   - Role-based NPO list (SuperAdmin sees all, others see assigned NPOs)
   - "Fundrbolt Platform" option for SuperAdmin (view all data)
   - Auto-selection for single-NPO users
   - Disabled for users with only one NPO (shows name only)
   - LocalStorage persistence across sessions

2. **Data Filtering**:
   - All list pages filter by selected NPO context
   - User list shows only users from selected NPO
   - Event list shows only events from selected NPO
   - NPO list shows only selected NPO or all NPOs

### Search Functionality

1. **Cross-Resource Search** (top-right corner):
   - Search across Users, NPOs, and Events
   - 300ms debounced input for performance
   - Minimum 2 characters required
   - Role-based filtering (NPO Admin sees only own NPO results)
   - NPO context awareness (respects selected NPO)
   - Grouped results display
   - Clickable results navigate to detail pages
   - "No results found" message

### Role-Based Dashboards

1. **SuperAdmin Dashboard**: Platform-wide statistics and management
2. **NPO Admin Dashboard**: NPO-specific analytics and tools
3. **Event Coordinator Dashboard**: Event management and coordination
4. **Staff Dashboard**: Operational tasks and check-in features

Each dashboard shows role-appropriate data and actions.

### Authorization

- Protected routes with `ProtectedRoute` component
- Role-based access control
- Automatic redirect to login for unauthenticated users
- Permission checks at component level

### Legal Compliance & GDPR

1. **Terms of Service Modal** (`/sign-up`, `/settings/account`):
   - Mandatory acceptance on registration
   - Auto-detect outdated consent (409 Conflict)
   - Modal with scrollable content
   - Checkbox confirmation required

2. **Privacy Policy** (`/privacy-policy`):
   - Standalone page with full policy text
   - Versioned documents
   - Accessible from footer and settings

3. **Cookie Consent Banner**:
   - First-visit banner with granular preferences
   - 3 categories: Essential (always on), Analytics, Marketing
   - LocalStorage for anonymous sessions
   - PostgreSQL for authenticated users
   - Redis cache for performance

4. **Cookie Preferences** (`/settings/cookies`):
   - Update cookie preferences anytime
   - Toggle categories on/off
   - Consent audit trail

5. **Consent History** (`/settings/consent`):
   - Paginated table (10 items per page)
   - Status badges (Active, Superseded, Withdrawn)
   - Document versions with timestamps
   - Previous/Next navigation

6. **Data Rights Form** (`/settings/consent`):
   - **Export Data**: GDPR Article 20 (Portability)
   - **Withdraw Consent**: GDPR Article 7 (with confirmation)
   - **Delete Account**: 30-day grace period (GDPR Article 17)
   - Toast notifications for all actions

7. **Legal Footer**:
   - Present on all pages (auth + authenticated)
   - Links to Terms, Privacy Policy
   - Copyright with dynamic year

**Components**:
- `components/legal/tos-modal.tsx` - Terms acceptance modal
- `components/legal/cookie-banner.tsx` - First-visit cookie consent
- `components/legal/consent-history.tsx` - History table
- `components/legal/data-rights-form.tsx` - Export/Delete/Withdraw
- `components/legal/legal-footer.tsx` - Footer with legal links

**Pages**:
- `pages/legal/terms-of-service.tsx` - Full TOS document
- `pages/legal/privacy-policy.tsx` - Full privacy policy
- `pages/legal/cookie-policy.tsx` - Cookie preferences
- `pages/legal/consent-settings.tsx` - Consent history + data rights

**Hooks**:
- `hooks/use-tos.ts` - TOS loading, acceptance, versioning
- `hooks/use-cookies.ts` - Cookie consent, preferences

**Stores**:
- `stores/tos-store.ts` - TOS state (current version, user acceptance)

**Routes**:
- `/terms-of-service` - Public TOS page
- `/privacy-policy` - Public privacy page
- `/settings/cookies` - Cookie preferences (authenticated)
- `/settings/consent` - Consent management (authenticated)

### Event Sponsors Management

**Features**:

- Create, edit, and delete event sponsors
- Upload sponsor logos with automatic thumbnail generation
- Drag-and-drop reordering within logo size groups
- Display sponsors grouped by prominence (xlarge, large, medium, small, xsmall)
- Clickable sponsor logos/names with external website links
- Read-only sponsor displays for public event pages

**Components**:

- `features/events/components/SponsorList.tsx` - List view with drag-and-drop reordering
- `features/events/components/SponsorCard.tsx` - Individual sponsor card with logo, name, website
- `features/events/components/SortableSponsorCard.tsx` - Draggable wrapper for SponsorCard
- `features/events/components/SponsorDialog.tsx` - Create/edit sponsor form modal

**Logo Upload**:

- Supported formats: PNG, JPEG, WebP
- Max file size: 5MB
- Auto-generated 300x300px thumbnails for list views
- Stored in Azure Blob Storage with automatic cleanup on delete
- Progress indicator during upload
- Client-side validation (file type, size)

**Logo Sizes** (Prominence):

- **xlarge** - Title Sponsors (largest display, top billing)
- **large** - Platinum Sponsors
- **medium** - Gold Sponsors
- **small** - Silver Sponsors
- **xsmall** - Bronze Sponsors

**Drag-and-Drop Reordering**:

- Powered by [@dnd-kit](https://dndkit.com/)
- Sortable within same logo size group
- Mouse and touch device support
- Visual feedback during drag (opacity, cursor, ghost overlay)
- Optimistic UI updates with automatic rollback on error
- Disabled in read-only mode

**Permissions**:

- **View**: Public (anyone can see sponsors on event pages)
- **Create/Edit/Delete**: NPO Admin, NPO Staff
- **Reorder**: NPO Admin, NPO Staff
- Permission checks enforced at API and UI levels

**State Management**:

- `stores/sponsorStore.ts` - Zustand store for sponsor data
- Actions: `fetchSponsors`, `createSponsor`, `updateSponsor`, `deleteSponsor`, `reorderSponsors`
- Optimistic updates for better UX
- Automatic cache invalidation

**Services**:

- `services/sponsorService.ts` - API client for sponsor endpoints
- Type-safe with TypeScript interfaces
- Error handling with user-friendly messages

**Usage Example**:

```typescript
import { useSponsorStore } from '@/stores/sponsorStore'

function EventSponsorsTab({ eventId }: { eventId: string }) {
  const { sponsors, isLoading, error, fetchSponsors, createSponsor, reorderSponsors } =
    useSponsorStore()

  useEffect(() => {
    fetchSponsors(eventId)
  }, [eventId])

  const handleReorder = async (sponsorIds: string[]) => {
    await reorderSponsors(eventId, { sponsor_ids_ordered: sponsorIds })
  }

  return (
    <SponsorList
      sponsors={sponsors}
      isLoading={isLoading}
      error={error}
      onAdd={() => {/* Open create dialog */}}
      onEdit={(sponsor) => {/* Open edit dialog */}}
      onDelete={(sponsorId) => deleteSponsor(eventId, sponsorId)}
      onReorder={handleReorder}
    />
  )
}
```

**Routes**:

- `/events/:eventId/sponsors` - Sponsors management tab (authenticated)
- Public sponsor display integrated into event detail pages

**Testing**:

- 28 comprehensive tests in `SponsorList.test.tsx`
- 8 tests for drag-and-drop functionality
- Component rendering tests (empty state, loading, error, cards)
- Interaction tests (add, edit, delete buttons)
- Accessibility tests (keyboard navigation, screen reader support)

### State Management

**Auth Store** (Zustand):

```typescript
{
  user: User | null,
  accessToken: string | null,
  refreshToken: string | null,
  login: (email, password) => Promise<void>,
  logout: () => void,
  setUser: (user: User) => void,
  clearAuth: () => void
}
```

**React Query**:

- `useUsers()` - List users with pagination
- `useCreateUser()` - Create new user
- `useUpdateUser()` - Update user details
- `useUpdateUserRole()` - Change user role
- `useDeleteUser()` - Delete user
- `useActivateUser()` - Reactivate user

### API Integration

**Axios Configuration** (`lib/axios.ts`):

- Base URL configuration
- Authorization header injection
- Automatic token refresh on 401
- Error handling and toast notifications
- Request/response interceptors

**API Service Layer** (`lib/api/`):

- `auth-api.ts` - Authentication endpoints
- `users-api.ts` - User management endpoints
- Type-safe request/response with Zod schemas

## Environment Variables

Required in `.env.local`:

```bash
# Backend API
VITE_API_URL=http://localhost:8000

# Optional: Enable debug logs
VITE_DEBUG=true
```

## Styling

### Tailwind CSS

Custom theme in `tailwind.config.js`:

- Primary color: Fundrbolt brand blue
- Dark mode support
- Custom spacing and typography
- Component utilities

### Shadcn UI Components

Installed components:

- Button, Input, Label, Textarea
- Dialog, Sheet, Dropdown Menu
- Table, Badge, Avatar
- Card, Separator, Skeleton
- Toast, Alert, Alert Dialog
- Command, Popover, Select
- Sidebar, Pagination

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 5173
lsof -i :5173

# Kill process
kill -9 <PID>

# Or use different port
pnpm dev --port 5174
```

### Backend Connection Errors

```bash
# Check if backend is running
curl http://localhost:8000/health

# Check environment variable
echo $VITE_API_URL

# Restart backend
cd ../../backend
poetry run uvicorn app.main:app --reload
```

### TypeScript Errors

```bash
# Clear type cache
rm -rf node_modules/.vite

# Reinstall dependencies
pnpm install

# Run type check
pnpm type-check
```

### Build Errors

```bash
# Clear dist folder
rm -rf dist

# Rebuild
pnpm build

# Check for type errors
pnpm type-check
```

## Contributing

1. Create feature branch from `001-user-authentication-role` (or current feature branch)
2. Develop feature with hot reload
3. Test manually in browser
4. Run linting: `pnpm lint`
5. Run type check: `pnpm type-check`
6. Commit with safe-commit: `./scripts/safe-commit.sh "message"`
7. Submit PR for review

### Code Style

- Use functional components with hooks
- Follow React best practices
- Use TypeScript for type safety
- Extract reusable logic into custom hooks
- Keep components small and focused
- Use Shadcn UI components when available

## Run Locally

Clone the project

```bash
  git clone <repository-url>
```

Go to the project directory

```bash
  cd fundrbolt-platform/frontend/donor-pwa
```

Install dependencies

```bash
  pnpm install
```

Start the server

```bash
  pnpm run dev
```

## License

Proprietary

## Support

For issues and questions:

- Email: support@fundrbolt.com
- Backend API: http://localhost:8000/docs
