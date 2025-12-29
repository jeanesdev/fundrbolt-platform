# Fundrbolt Admin Dashboard

Admin web application for nonprofit auction management with authentication, user management, and role-based access control.

## Features

- **User Authentication**: Login, registration, logout with JWT tokens
- **Password Management**: Reset and change password with email verification
- **Email Verification**: Email verification flow before login
- **User Management**: List, create, update, delete users with server-side pagination and NPO filtering
- **NPO Context Selector**: Filter all data by selected NPO (top-left corner)
- **Role Assignment**: Assign roles to users (Super Admin, NPO Admin, NPO Manager, Event Staff, Donor)
- **Role-Based Dashboards**: Different dashboard views for each role
- **Session Management**: Automatic token refresh, session expiration warning
- **Legal Compliance**: Terms of Service, Privacy Policy, Cookie Consent (GDPR)
- **Consent Management**: View consent history, export data, withdraw consent, delete account
- **Search Bar**: Cross-resource search with role-based filtering (Users, NPOs, Events)
- **Responsive Design**: Mobile-first responsive layout
- **Accessibility**: Built with accessibility in mind (ARIA, keyboard navigation)

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

### Seating Assignment (Admin)

**Components**:

- `components/seating/SeatingTabContent.tsx` - Main seating tab container with event configuration and guest list
- `components/seating/EventSeatingConfig.tsx` - Event seating configuration form (table count, max guests per table)
- `components/seating/GuestSeatingList.tsx` - Paginated guest list table with sorting and filtering
- `components/seating/GuestCard.tsx` - Guest card with table/bidder assignment and guest-of-primary indicator
- `components/seating/AutoAssignButton.tsx` - Auto-assign bidder numbers button with confirmation dialog
- `components/seating/TableAssignmentDialog.tsx` - Modal for manual table assignment with capacity validation
- `components/seating/BidderNumberDialog.tsx` - Modal for manual bidder number assignment with duplicate prevention
- `components/seating/SeatingLayoutModal.tsx` - Event space layout image viewer with fullscreen support
- `components/seating/TableOccupancyView.tsx` - Visual table occupancy grid showing all tables and guests

**Features**:

- **Event Configuration**: Configure table count and max guests per table for the event
- **Auto-Assignment**: One-click auto-assign bidder numbers to all unassigned guests with party-aware algorithm
- **Manual Assignment**: Drag-and-drop table assignment, manual bidder number assignment with validation
- **Guest Management**: Paginated guest list with search, filter, and sort (by name, table, bidder number, check-in status)
- **Guest Indicators**: Visual indicator for accompanying guests (guest-of-primary) with UserCheck icon
- **Table Occupancy**: Grid view showing all tables, current occupancy, and capacity
- **Capacity Validation**: Real-time capacity checks prevent over-assignment, warning dialogs
- **Layout Upload**: Upload event space layout images (PNG, JPEG, WebP) with fullscreen viewer
- **Fullscreen Viewer**: Click-to-fullscreen image viewer for layout inspection

**State Management**:

- `stores/seatingStore.ts` - Zustand store for seating data
- Actions: `loadEventConfig`, `updateEventConfig`, `loadGuests`, `assignTable`, `assignBidderNumber`, `unassignTable`, `autoAssignBidders`
- Real-time updates on all assignment operations
- Automatic cache invalidation and refresh

**API Services**:

- `lib/api/admin-seating.ts` - Type-safe API client for seating endpoints
- Functions: `getEventSeatingConfig`, `updateEventSeatingConfig`, `getSeatingGuests`, `assignTableNumber`, `assignBidderNumber`, `unassignTableNumber`, `autoAssignBidders`, `getTableOccupancy`
- TypeScript interfaces for all request/response types

**Routes**:

- `/events/:eventId/seating` - Seating management tab (NPO Admin, NPO Staff)
- Integrated into event detail page with role-based access control

**Usage Example**:

```typescript
import { useSeatingStore } from '@/stores/seatingStore'
import { SeatingTabContent } from '@/components/seating/SeatingTabContent'

function EventSeatingTab({ eventId }: { eventId: string }) {
  const { eventConfig, guests, isLoading, loadEventConfig, loadGuests, assignTable } =
    useSeatingStore()

  useEffect(() => {
    loadEventConfig(eventId)
    loadGuests(eventId)
  }, [eventId])

  const handleTableAssign = async (guestId: string, tableNumber: number) => {
    await assignTable(eventId, guestId, tableNumber)
  }

  return (
    <SeatingTabContent
      eventId={eventId}
      eventConfig={eventConfig}
      guests={guests}
      isLoading={isLoading}
      onTableAssign={handleTableAssign}
    />
  )
}
```

**Key Features**:

- **Party-Aware Auto-Assignment**: Keeps accompanying guests with primary registrant
- **Real-Time Validation**: Prevents duplicate bidder numbers and table over-capacity
- **Guest-of-Primary Indicator**: Shows "Guest of [Name]" for accompanying guests with UserCheck icon
- **Fullscreen Layout Viewer**: Click event space layout image to view fullscreen with click-anywhere-to-close
- **Auto-Refresh**: Guest list auto-refreshes after auto-assign operation
- **Drag-and-Drop Ready**: Architecture supports future drag-and-drop table assignment

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
  cd fundrbolt-platform/frontend/fundrbolt-admin
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
