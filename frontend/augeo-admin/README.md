# Augeo Admin Dashboard

Admin web application for nonprofit auction management with authentication, user management, and role-based access control.

## Features

- **User Authentication**: Login, registration, logout with JWT tokens
- **Password Management**: Reset and change password with email verification
- **Email Verification**: Email verification flow before login
- **User Management**: List, create, update, delete users (admin only)
- **Role Assignment**: Assign roles to users (Super Admin, NPO Admin, NPO Manager, Event Staff, Donor)
- **Session Management**: Automatic token refresh, session expiration warning
- **Legal Compliance**: Terms of Service, Privacy Policy, Cookie Consent (GDPR)
- **Consent Management**: View consent history, export data, withdraw consent, delete account
- **Dark/Light Mode**: Theme switcher with system preference support
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
cd frontend/augeo-admin
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
frontend/augeo-admin/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── ui/           # Shadcn UI components
│   │   ├── layout/       # Layout components (header, sidebar)
│   │   ├── legal/        # Legal components (TOS modal, cookie banner, consent)
│   │   └── custom/       # Custom shared components
│   ├── features/         # Feature-based modules
│   │   ├── auth/         # Authentication (login, register, password reset)
│   │   ├── users/        # User management
│   │   └── settings/     # Settings and account
│   ├── hooks/            # Custom React hooks
│   │   ├── use-users.ts  # User management hooks (React Query)
│   │   └── use-tos.ts    # Terms of Service hooks
│   ├── lib/              # Utilities and configurations
│   │   ├── axios.ts      # Axios configuration with interceptors
│   │   ├── api/          # API service layer
│   │   └── utils.ts      # Helper functions
│   ├── pages/            # Full-page components
│   │   └── legal/        # Legal pages (TOS, Privacy, Cookies, Consent)
│   ├── routes/           # TanStack Router routes
│   │   ├── __root.tsx    # Root route layout
│   │   ├── _authenticated/ # Protected routes
│   │   └── (auth)/       # Auth routes (login, register)
│   ├── stores/           # Zustand state management
│   │   ├── auth-store.ts # Auth state (user, tokens, login/logout)
│   │   └── tos-store.ts  # TOS consent state
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
   - Paginated table view
   - Search and filter
   - Role badges
   - Quick actions (edit, delete, change role)

2. **Create User**:
   - Invite dialog with form
   - Role selection
   - NPO assignment (for NPO roles)
   - Password generation

3. **Update User**:
   - Edit user details
   - Change role
   - Activate/deactivate account

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

- Primary color: Augeo brand blue
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
  cd augeo-platform/frontend/augeo-admin
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

- Email: support@augeo.app
- Backend API: http://localhost:8000/docs
