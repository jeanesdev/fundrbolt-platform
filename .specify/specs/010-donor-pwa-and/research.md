# Technical Research Document: Donor PWA and Event Page Implementation

**Feature**: 010-donor-pwa-and
**Date**: November 20, 2025
**Purpose**: Consolidated technical research for implementation decisions

---

## 1. Event Slug Generation Best Practices

### Decision

Use **python-slugify** library (backend) and manual slug generation (frontend) with database-level uniqueness constraints.

### Rationale

- **Existing implementation**: Backend already uses `python-slugify` in `event_service.py` (line 352-373)
- **Proven pattern**: Current implementation successfully handles uniqueness with counter suffixes (e.g., "spring-gala-2025", "spring-gala-2025-2")
- **Consistency**: Maintains existing slug generation patterns across the platform
- **Performance**: Database-level unique constraint on `slug` column prevents race conditions

### Alternatives Considered

1. **UUID-based slugs**: Rejected - Not human-readable, defeats purpose of shareable URLs
2. **Hash-based slugs**: Rejected - Harder to remember, loses SEO benefits
3. **Custom slug only**: Rejected - Requires manual uniqueness checking, error-prone

### Implementation Notes

**Backend (Python)** - Already implemented in `event_service.py`:

```python
from slugify import slugify  # python-slugify library

async def _generate_unique_slug(
    db: AsyncSession,
    event_name: str,
    custom_slug: str | None = None,
) -> str:
    """Generate a unique URL slug for the event."""
    base_slug = custom_slug if custom_slug else slugify(event_name)

    slug = base_slug
    counter = 1

    while counter <= 3:  # Max 3 attempts
        existing = await db.execute(select(Event).where(Event.slug == slug))
        if not existing.scalar_one_or_none():
            return slug

        counter += 1
        slug = f"{base_slug}-{counter}"

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Unable to generate unique slug after 3 attempts"
    )
```

**Frontend (TypeScript)** - For client-side preview:

```typescript
export function generateSlugPreview(eventName: string): string {
  return eventName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

**Validation Pattern**:

- Regex: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Min length: 3 characters
- Max length: 255 characters
- Allowed: lowercase letters, numbers, hyphens

**Database Constraint** (already exists in Event model):

```python
slug: Mapped[str] = mapped_column(
    String(255),
    unique=True,      # Enforces uniqueness at DB level
    nullable=False,
    index=True,       # Optimized for lookups
)
```

---

## 2. PWA Deployment Strategies on Azure Static Web Apps

### Decision

Deploy **two separate Azure Static Web Apps** from the monorepo using different `appLocation` configurations in Bicep templates, with custom routing via `staticwebapp.config.json`.

### Rationale

- **Isolation**: Donor PWA and Admin PWA have different audiences, security requirements, and domains
- **Cost efficiency**: Azure Static Web Apps Free tier supports custom domains and SSL
- **Scalability**: Independent scaling and deployment pipelines
- **Existing pattern**: Current Bicep template structure already configured for monorepo

### Alternatives Considered

1. **Single SWA with routing**: Rejected - Conflicting routes, harder to manage separate authentication
2. **Azure App Service**: Rejected - Overkill for static sites, higher cost
3. **GitHub Pages**: Rejected - Lacks Azure integration, no backend proximity

### Implementation Notes

**Bicep Configuration**:

```bicep
// infrastructure/bicep/modules/donor-static-web-app.bicep
resource donorStaticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: 'augeo-donor-${environment}'
  location: location
  sku: {
    name: skuConfig
    tier: skuConfig
  }
  properties: {
    repositoryUrl: repositoryUrl
    branch: branch
    buildProperties: {
      appLocation: '/frontend/donor-pwa'  // Different from admin
      apiLocation: ''
      outputLocation: 'dist'
    }
  }
}
```

**Routing Configuration** (`frontend/donor-pwa/public/staticwebapp.config.json`):

```json
{
  "routes": [
    {
      "route": "/events/*",
      "rewrite": "/index.html"
    },
    {
      "route": "/api/*",
      "allowedRoles": ["authenticated"]
    }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/images/*", "/*.{css,js,json,png,jpg,svg}"]
  },
  "responseOverrides": {
    "404": {
      "rewrite": "/index.html",
      "statusCode": 200
    }
  }
}
```

**Slug-Based URL Routing**:

- Azure SWA: Handles `/events/spring-gala-2025` → rewrites to `/index.html`
- TanStack Router: Parses `slug` parameter and fetches event data
- No special routing needed beyond standard SPA behavior

**Custom Domain Setup**:

- Admin PWA: `admin.augeo.app`
- Donor PWA: `events.augeo.app` (or `app.augeo.app`)

**Deployment Pipeline** (GitHub Actions):

```yaml
# .github/workflows/donor-pwa-deploy.yml
name: Deploy Donor PWA
on:
  push:
    branches: [main]
    paths: ['frontend/donor-pwa/**']

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Donor PWA
        run: |
          cd frontend/donor-pwa
          pnpm install
          pnpm build

      - name: Deploy to Azure SWA
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.DONOR_SWA_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/frontend/donor-pwa"
          output_location: "dist"
```

---

## 3. Shared Component Library Patterns in Monorepos

### Decision

Use **pnpm workspaces** with a dedicated `@augeo/shared` package for components and types, leveraging TypeScript path aliases and Vite's dependency optimization.

### Rationale

- **Existing structure**: Project already has `frontend/shared` with shared TypeScript types
- **Zero config**: pnpm workspaces auto-symlink packages without manual linking
- **Build performance**: Vite optimizes shared dependencies via pre-bundling
- **Type safety**: Centralized types prevent drift between PWAs

### Alternatives Considered

1. **npm workspaces**: Rejected - pnpm already in use, faster and more disk-efficient
2. **Lerna/Nx**: Rejected - Overkill for 2-3 frontend apps, adds complexity
3. **Copy-paste components**: Rejected - Violates DRY, creates maintenance burden
4. **Separate npm packages**: Rejected - Requires publishing, versioning overhead

### Implementation Notes

**Workspace Configuration** (`package.json` at repo root):

```json
{
  "name": "augeo-platform",
  "private": true,
  "workspaces": [
    "frontend/augeo-admin",
    "frontend/donor-pwa",
    "frontend/shared"
  ]
}
```

**Shared Package Structure**:

```text
frontend/shared/
├── package.json
├── tsconfig.json
├── components/
│   ├── ui/          # Shadcn components (Button, Input, Card, etc.)
│   ├── forms/       # Form components (EmailInput, PasswordInput, etc.)
│   └── layout/      # Layout components (Header, Footer, etc.)
├── lib/
│   ├── utils.ts
│   ├── axios.ts
│   └── cookies.ts
├── hooks/
│   ├── use-auth.ts
│   └── use-toast.ts
├── types/
│   ├── user.ts
│   ├── auth.ts
│   └── role.ts
└── styles/
    └── globals.css
```

**Shared Package `package.json`**:

```json
{
  "name": "@augeo/shared",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./index.ts",
  "exports": {
    "./components/*": "./components/*/index.ts",
    "./lib/*": "./lib/*.ts",
    "./hooks/*": "./hooks/*.ts",
    "./types": "./types/index.ts",
    "./styles/*": "./styles/*.css"
  },
  "peerDependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
```

**TypeScript Path Aliases** (both PWAs' `tsconfig.json`):

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@augeo/shared/*": ["../shared/*"]
    }
  }
}
```

**Vite Configuration** (prevent duplicate bundles):

```typescript
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@augeo/shared': path.resolve(__dirname, '../shared'),
    },
  },
  optimizeDeps: {
    include: ['@augeo/shared'],
  },
});
```

**Usage Example**:

```typescript
import { Button } from '@augeo/shared/components/ui/button';
import { useAuth } from '@augeo/shared/hooks/use-auth';
import { User } from '@augeo/shared/types';
```

---

## 4. Event Registration Association Patterns

### Decision

Create a **`event_registrations` join table** with unique constraint on `(user_id, event_id)` and indexed queries for user's events.

### Rationale

- **Flexibility**: Supports future features (ticket types, multiple registrations)
- **Performance**: Indexed foreign keys enable fast lookups
- **Data integrity**: Database-level unique constraint prevents duplicate registrations
- **Audit trail**: Timestamps track registration date for analytics

### Alternatives Considered

1. **Array field on User**: Rejected - No referential integrity, hard to query
2. **JSON field with event IDs**: Rejected - No foreign key constraints, poor performance
3. **Direct foreign key on User**: Rejected - Limits to one event per user

### Implementation Notes

**Database Schema** (new table):

```python
# backend/app/models/event_registration.py
class RegistrationStatus(str, enum.Enum):
    """Event registration status."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    WAITLISTED = "waitlisted"


class EventRegistration(Base, UUIDMixin, TimestampMixin):
    """User registration for an event."""

    __tablename__ = "event_registrations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[RegistrationStatus] = mapped_column(
        Enum(RegistrationStatus),
        nullable=False,
        default=RegistrationStatus.CONFIRMED,
        index=True,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="event_registrations")
    event: Mapped["Event"] = relationship("Event", back_populates="registrations")

    # Constraints
    __table_args__ = (
        UniqueConstraint("user_id", "event_id", name="uq_user_event_registration"),
        Index("idx_user_event_status", "user_id", "event_id", "status"),
    )
```

**Service Methods**:

```python
async def register_user_for_event(
    db: AsyncSession,
    user_id: uuid.UUID,
    event_id: uuid.UUID,
) -> EventRegistration:
    """Register user for event, preventing duplicates."""
    # Check for existing registration
    existing = await db.execute(
        select(EventRegistration).where(
            and_(
                EventRegistration.user_id == user_id,
                EventRegistration.event_id == event_id,
                EventRegistration.status != RegistrationStatus.CANCELLED,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already registered for this event",
        )

    registration = EventRegistration(
        user_id=user_id,
        event_id=event_id,
        status=RegistrationStatus.CONFIRMED,
    )
    db.add(registration)
    await db.commit()
    return registration
```

---

## 5. Dynamic Branding Application in React

### Decision

Use **CSS custom properties** (CSS variables) injected at runtime via JavaScript, combined with Tailwind's color system.

### Rationale

- **Runtime flexibility**: Colors change without rebuilding Tailwind
- **Performance**: CSS variables update instantly, no React re-renders needed
- **Existing pattern**: Admin PWA already uses this for theme switching
- **Accessibility**: Can calculate contrast ratios and provide fallbacks
- **SSR compatible**: Variables applied during page load

### Alternatives Considered

1. **Tailwind JIT dynamic classes**: Rejected - Requires `safelist`, bloats bundle
2. **Inline styles**: Rejected - Loses Tailwind utilities, harder to maintain
3. **Theme provider context**: Rejected - Causes unnecessary re-renders
4. **Styled-components**: Rejected - Runtime CSS-in-JS overhead

### Implementation Notes

**CSS Custom Properties Setup**:

```css
:root {
  --event-primary: 37 99 235;
  --event-secondary: 100 116 139;
  --event-background: 255 255 255;
  --event-accent: 249 115 22;
}
```

**Dynamic Branding Injection Hook**:

```typescript
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0 0 0';

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `${r} ${g} ${b}`;
}

export function useEventBranding(branding: EventBranding | null) {
  useEffect(() => {
    if (!branding) return;

    const root = document.documentElement;
    root.style.setProperty('--event-primary', hexToRgb(branding.primary_color));
    root.style.setProperty('--event-secondary', hexToRgb(branding.secondary_color));
    root.style.setProperty('--event-background', hexToRgb(branding.background_color));
    root.style.setProperty('--event-accent', hexToRgb(branding.accent_color));

    return () => {
      root.style.removeProperty('--event-primary');
      root.style.removeProperty('--event-secondary');
      root.style.removeProperty('--event-background');
      root.style.removeProperty('--event-accent');
    };
  }, [branding]);
}
```

**Usage in Components**:

```typescript
export function EventPage() {
  const { data: event } = useQuery(['event', slug]);
  useEventBranding(event?.branding);

  return (
    <div className="bg-[rgb(var(--event-background))]">
      <header className="bg-[rgb(var(--event-primary))] text-white">
        <h1>{event?.name}</h1>
      </header>
      <button className="bg-[rgb(var(--event-accent))]">
        Register Now
      </button>
    </div>
  );
}
```

**Image Loading Strategy**:

```typescript
<img
  src={event?.logo_url || '/images/default-logo.png'}
  alt={event?.name}
  loading="lazy"
  onError={(e) => {
    e.currentTarget.src = '/images/default-logo.png';
  }}
/>
```

---

## Summary of Key Decisions

| Topic | Decision | Key Library/Pattern |
|-------|----------|---------------------|
| **Event Slugs** | python-slugify with uniqueness check | `python-slugify`, DB unique constraint |
| **PWA Deployment** | Separate Azure SWAs with `staticwebapp.config.json` | Azure Static Web Apps, Bicep |
| **Shared Components** | pnpm workspaces with `@augeo/shared` package | pnpm, TypeScript path aliases |
| **Event Registration** | `event_registrations` join table | SQLAlchemy, composite indexes |
| **Dynamic Branding** | CSS custom properties at runtime | CSS variables, Tailwind v4 |

All decisions align with existing project architecture, minimize dependencies, and prioritize performance and maintainability.
