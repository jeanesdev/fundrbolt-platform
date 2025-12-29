# fundrbolt-platform Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-25

## Active Technologies
- Python 3.11+ (Backend), TypeScript (Frontend) + FastAPI, SQLAlchemy, Pydantic, React, Zustand
- Authentication: OAuth2 + JWT, bcrypt password hashing, Redis sessions (001-user-authentication-role)
- Monitoring: Prometheus metrics, structured logging, health checks (001-user-authentication-role)
- Legal Compliance: GDPR consent tracking, cookie consent management, versioned legal documents (005-legal-documentation)
- Python 3.11+ (Backend), TypeScript (Frontend) + FastAPI, SQLAlchemy, Pydantic (Backend); React, Vite, Zustand, React Router (Frontend) (006-landing-page)
- PostgreSQL (contact submissions, testimonials), Redis (rate limiting) (006-landing-page)
- Python 3.11+ (Backend), TypeScript (Frontend) + FastAPI, SQLAlchemy, Pydantic, Alembic (Backend); React, Vite, Zustand, React Router (Frontend) (003-event-creation-ability)
- Azure Database for PostgreSQL (event data, audit logs), Azure Blob Storage (media files: logos, images, flyers), Azure Cache for Redis (rate limiting, caching) (003-event-creation-ability)
- Azure Database for PostgreSQL (sponsor data), Azure Blob Storage (sponsor logos), Azure Cache for Redis (optional caching) (007-sponsors)
- Python 3.11+ + FastAPI, SQLAlchemy 2.0, Pydantic 2.0, Azure Blob Storage SDK, Pillow (image processing) (008-auction-items)
- Azure Database for PostgreSQL (auction item data, metadata), Azure Blob Storage (images/videos) (008-auction-items)
- TypeScript 5.x (frontend) + Python 3.11+ (backend) + React 18 + Vite + TanStack Router + Radix UI + Tailwind 4 (frontend); FastAPI 0.120 + SQLAlchemy 2.0 + Pydantic 2.0 (backend) (009-admin-pwa-ui)
- PostgreSQL 15 (users, roles, npos, events, user_role_assignments) + Redis 7 (sessions) (009-admin-pwa-ui)
- TypeScript 5.x (Frontend), Python 3.11+ (Backend) (010-donor-pwa-and)
- Azure Database for PostgreSQL (event registrations), Azure Cache for Redis (sessions) (010-donor-pwa-and)
- Python 3.11+ (Backend), TypeScript 5.x (Frontend) + FastAPI 0.120, SQLAlchemy 2.0, Pydantic 2.0, React 18, Vite, TanStack Router (010-donor-pwa-and)
- Azure Database for PostgreSQL (3 new tables: event_registrations, registration_guests, meal_selections) (010-donor-pwa-and)
- TypeScript 5.x (Frontend), Python 3.11+ (Backend) + React 18, Vite, TanStack Router, Radix UI, Tailwind CSS 4, FastAPI, SQLAlchemy 2.0 (011-donor-pwa-event)
- Azure Database for PostgreSQL (existing), Azure Blob Storage (images) (011-donor-pwa-event)
- Python 3.11+ (Backend), TypeScript 5.x (Frontend) + FastAPI 0.120, SQLAlchemy 2.0, Pydantic 2.0, Alembic (Backend); React 18, Vite, TanStack Router, Zustand, Radix UI (Frontend) (012-seating-assignment)
- Azure Database for PostgreSQL (existing event_registrations, registration_guests tables; new fields: table_number, bidder_number, table_count, max_guests_per_table) (012-seating-assignment)
- Embla Carousel with autoplay for sponsor carousels (011-donor-pwa-event)
- Python 3.11+ (backend), TypeScript 5.x (frontend), Bash/YAML (infrastructure) + FastAPI, React, Vite, SQLAlchemy, Pydantic, Azure CLI, Bicep, GitHub Actions (013-fundrbolt-to-fundrbolt)
- Azure Database for PostgreSQL, Azure Blob Storage (013-fundrbolt-to-fundrbolt)

## Project Structure
```
src/
tests/
```

## Commands

**Use Makefile for all common tasks**: Run `make help` to see all available commands.

### Quick Reference
- **Development**: `make dev-backend` or `make b`, `make dev-frontend` or `make f`, `make dev-fullstack`
- **Testing**: `make test` or `make t`, `make test-coverage`, `make test-watch`
- **Code Quality**: `make lint`, `make format`, `make type-check`, `make check-commits`
- **Database**: `make migrate` or `make m`, `make migrate-create NAME="description"`, `make db-seed`
- **Docker**: `make docker-up`, `make docker-down`, `make docker-logs`
- **Infrastructure**: `make validate-infra ENV=dev`, `make deploy-backend ENV=dev TAG=v1.0.0`
- **Secrets**: `make configure-secrets ENV=dev`, `make update-app-settings ENV=dev`
- **Cleanup**: `make clean`, `make clean-docker`

### Backend (Python)
**CRITICAL**: Always use Poetry for Python commands. Never use pip, venv, or virtualenv directly.

- Run tests: `make test-backend` or `cd backend && poetry run pytest`
- Run linter: `make lint-backend` or `cd backend && poetry run ruff check .`
- Run formatter: `make format-backend` or `cd backend && poetry run black .`
- Install dependencies: `make install-backend` or `cd backend && poetry install`
- Add package: `cd backend && poetry add <package>`
- Run any Python command: `cd backend && poetry run <command>`

### Frontend
- Install: `make install-frontend` or `cd frontend/fundrbolt-admin && pnpm install`
- Dev server: `make dev-frontend` or `cd frontend/fundrbolt-admin && pnpm dev`
- Build: `cd frontend/fundrbolt-admin && pnpm build`
- Test: `make test-frontend` or `cd frontend/fundrbolt-admin && pnpm test`

## Development Environment

### Python Environment
- **Package Manager**: Poetry (ALWAYS use `poetry run` for all Python commands)
- **Virtual Environment**: Managed by Poetry at `~/.cache/pypoetry/virtualenvs/`
- **Never use**: pip install, venv/bin/activate, python -m commands directly
- **Always use**: `poetry run python`, `poetry run pytest`, etc.

## Code Style
Python 3.11+ (Backend), TypeScript (Frontend): Follow standard conventions

## Git Workflow

### Committing Changes
**CRITICAL**: Always run pre-commit hooks before committing to ensure code quality.

**Recommended workflow**:
```bash
make check-commits              # Run pre-commit hooks with auto-retry
git commit -m "your message"    # Commit when hooks pass
```

**Alternative using script directly**:
```bash
./scripts/safe-commit.sh        # Run pre-commit hooks with auto-retry
git commit -m "your message"    # Commit when hooks pass
```

**Why use make check-commits / safe-commit.sh**: The script:
- Runs pre-commit hooks to completion
- Auto-stages formatting changes (ruff, black, trailing whitespace, etc.)
- Re-runs hooks after auto-fixes to verify (up to 3 attempts)
- Exits successfully when all checks pass
- Prevents committing code that fails linting/formatting

**Manual pre-commit workflow** (if not using make/script):
```bash
git add -A
pre-commit run --all-files
# If changes were made, re-stage and re-run:
git add -A
pre-commit run --all-files
# Then commit:
git commit -m "message"
```

## Recent Changes
- 013-fundrbolt-to-fundrbolt: Added Python 3.11+ (backend), TypeScript 5.x (frontend), Bash/YAML (infrastructure) + FastAPI, React, Vite, SQLAlchemy, Pydantic, Azure CLI, Bicep, GitHub Actions
- 012-seating-assignment: Added Python 3.11+ (Backend), TypeScript 5.x (Frontend) + FastAPI 0.120, SQLAlchemy 2.0, Pydantic 2.0, Alembic (Backend); React 18, Vite, TanStack Router, Zustand, Radix UI (Frontend)
- 011-donor-pwa-event: Added TypeScript 5.x (Frontend), Python 3.11+ (Backend) + React 18, Vite, TanStack Router, Radix UI, Tailwind CSS 4, FastAPI, SQLAlchemy 2.0
  - ✅ Password change page: `/settings/password` route with PasswordChangeForm component
  - ✅ Settings menu: Added Password menu item with KeyRound icon
  - ✅ User list pagination: Server-side pagination with proper page count from API
  - ✅ NPO filtering: Filter users by active NPO membership (not just npo_id field)
  - ✅ API param fix: Transform `page_size` to `per_page` for backend compatibility
  - ✅ NPO memberships display: Shows NPO name and role in users table
  - ✅ Azure Bicep templates for 9 Azure resources (App Service, Static Web Apps, PostgreSQL, Redis, Key Vault, etc.)
  - ✅ Environment configurations for dev/staging/production
  - ✅ GitHub Actions workflows: pr-checks, backend-deploy, frontend-deploy, infrastructure-deploy
  - ✅ Deployment scripts: deploy-backend.sh, deploy-frontend.sh, run-migrations.sh, rollback.sh
  - ✅ Blue-green deployment for production with automatic rollback
  - ✅ CI/CD documentation and rollback procedures
  - ✅ DNS Zone module with Azure DNS for custom domain fundrbolt.com
  - ✅ Communication Services module for email with SPF/DKIM/DMARC
  - ✅ DNS and email configuration documentation
  - ✅ Secrets management scripts: configure-secrets.sh, update-app-settings.sh
  - ✅ Secret rotation procedures and security checklist documentation
  - ✅ Storage module: Blob versioning, soft delete (30-day prod, 7-day dev/staging), change feed (90-day)
  - ✅ Disaster recovery testing: test-disaster-recovery.sh with PostgreSQL PITR, Redis export, RTO/RPO validation
  - ✅ DR runbooks: 4 disaster scenarios (database, Redis, regional outage, accidental deletion)
  - ✅ DR drills: Quarterly procedures with Q1-Q4 schedules
  - ✅ Application Insights: Sampling (10% prod, 100% dev/staging), daily cap (5GB prod, 1GB staging)
  - ✅ Alert rules: High error rate (>5%), high latency (P95 >500ms), availability failures
  - ✅ Action groups: Email notifications (ops@fundrbolt.com, engineering@fundrbolt.com)
  - ✅ Availability tests: Backend /health and frontend homepage (5-min intervals, 3 locations)
  - ✅ Dashboards: System health (10 tiles), infrastructure health (4 sections) with KQL queries
  - ✅ Monitoring guide: 551-line comprehensive guide with alert procedures and troubleshooting
  - ✅ Cost Budget: Monthly budgets ($100 dev, $300 staging, $1000 prod) with 80%/90%/100% alerts
  - ✅ Auto-scaling: CPU-based (>70% scale out, <30% scale in), capacity limits (dev 1-2, staging 1-5, prod 2-10)
  - ✅ Resource Tagging: Environment, Project, Owner, CostCenter, ManagedBy tags on all resources
  - ✅ Resource Locks: CanNotDelete locks on production PostgreSQL, Redis, Key Vault, Storage
  - ✅ App Service: Always-on enabled (staging/prod), health check endpoint (/health)
  - ✅ Network Security: PostgreSQL/Redis firewall rules (Azure services only), VNet integration notes
  - ✅ Cost Optimization Docs: 500+ line guide with budgets, auto-scaling, reserved instances, cost queries
  - ✅ Quick Reference: 550+ line guide with common operations, deployment, rollback, logs, scaling, troubleshooting
  - ✅ Architecture Updates: Monitoring, cost optimization, safeguards, all 9 phases complete
  - ✅ Root README: Complete project overview with quickstart, architecture, operations
  - ✅ OpenAPI documentation enhanced with contact, license, and tags
  - ✅ Comprehensive health checks: /health, /health/detailed, /health/ready, /health/live
  - ✅ Prometheus metrics: /metrics endpoint with HTTP counters, failure tracking, up/down gauge
  - ✅ Error handling: Database, Redis, and email retry logic with exponential backoff
  - ✅ Request ID tracing: X-Request-ID header for distributed tracing
  - ✅ CORS configuration for cross-origin requests
  - ✅ Backend and frontend READMEs updated with complete setup instructions
  - ✅ Legal document versioning with semantic versioning (major.minor)
  - ✅ GDPR compliance: consent tracking, data export, data deletion (7-year audit retention)
  - ✅ Cookie consent management with granular categories (Essential, Analytics, Marketing)
  - ✅ 4 new database tables: legal_documents, user_consents, cookie_consents, consent_audit_logs
  - ✅ 15+ API endpoints for legal documents, consent management, and cookie preferences
  - ✅ Immutable audit trail with database triggers preventing modifications
  - ✅ Middleware-based consent enforcement (409 Conflict on outdated consent)
  - ✅ Hybrid cookie storage: localStorage (anonymous) + PostgreSQL (authenticated) + Redis (cache)
  - ✅ EU Cookie Law compliance (strictest standard for global deployment)
  - ✅ Event routing: Migrated from `/events/$eventId` to `/events/$eventSlug` for SEO-friendly URLs
  - ✅ EventSwitcher component: Always-visible dropdown on event homepage (single/multiple events)
  - ✅ Event list sync: Sidebar EventSelector and homepage EventSwitcher use same `availableEvents` source
  - ✅ Navigation fixes: All event navigation uses slug-based URLs instead of IDs
  - ✅ Error handling: Prevents infinite redirect loops by clearing selectedEvent on load failure
  - ✅ Sponsors carousel: Auto-playing carousel with 3-second transitions, transparent background
  - ✅ Responsive layout: 1 sponsor (mobile), 3 sponsors (tablet), 4 sponsors (desktop)
  - ✅ Sponsor logos: Increased sizes (xsmall: 64px, small: 96px, medium: 128px, large: 160px, xlarge: 192px)
  - ✅ Shield icon: Indicates admin access in event selectors
  - ✅ API client: `/api/v1/events/{event_id}/sponsors` endpoint integration

## API Endpoints (001-user-authentication-role)

### Authentication
- `POST /api/v1/auth/register` - Register new user (with email verification)
- `POST /api/v1/auth/login` - Login (rate-limited: 5 attempts/15min)
- `POST /api/v1/auth/logout` - Logout and revoke session
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/verify-email` - Verify email address
- `POST /api/v1/auth/verify-email/resend` - Resend verification email

### Password Management
- `POST /api/v1/auth/password/reset/request` - Request password reset
- `POST /api/v1/auth/password/reset/confirm` - Confirm password reset with token
- `POST /api/v1/auth/password/change` - Change password (authenticated)

### User Management (Admin only)
- `GET /api/v1/users` - List users with pagination/filtering
- `POST /api/v1/users` - Create user
- `GET /api/v1/users/{id}` - Get user details
- `PATCH /api/v1/users/{id}` - Update user
- `DELETE /api/v1/users/{id}` - Soft delete user
- `PATCH /api/v1/users/{id}/role` - Update user role
- `POST /api/v1/users/{id}/activate` - Reactivate user

### Health & Monitoring
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed service status (DB, Redis, email)
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe
- `GET /metrics` - Prometheus metrics

## Authentication & Authorization

### Session Management
- Access tokens: 15-minute expiry (JWT)
- Refresh tokens: 7-day expiry (stored in Redis)
- Session tracking: Device info (user-agent, IP) stored in PostgreSQL
- Automatic token refresh: Frontend axios interceptor handles 401s
- Session expiration warning: Modal appears 2 minutes before expiry

### Role-Based Access Control
- **Roles**: Super Admin, NPO Admin, NPO Staff, Check-in Staff, Donor
- **Permission Service**: Centralized authorization logic in `PermissionService`
- **Middleware**: `@require_role()` and `@require_permission()` decorators
- **Audit Logging**: All auth events tracked in `audit_logs` table

### Rate Limiting
- Login endpoint: 5 attempts per 15 minutes (per IP)
- Password reset: 3 attempts per hour
- Redis-backed with sorted sets for distributed rate limiting
- Custom decorator: `@rate_limit()` in `app/middleware/rate_limit.py`

## Monitoring & Observability

### Metrics (Prometheus)
- `fundrbolt_http_requests_total` - HTTP requests by method/path/status
- `fundrbolt_db_failures_total` - Database connection failures
- `fundrbolt_redis_failures_total` - Redis connection failures
- `fundrbolt_email_failures_total` - Email send failures
- `fundrbolt_up` - Application up/down status (1=up, 0=down)

### Structured Logging
- JSON format with request IDs for distributed tracing
- X-Request-ID header in all responses
- Context propagation via ContextVar
- Log levels: DEBUG, INFO, WARNING, ERROR

### Health Checks
- Basic: Quick liveness check
- Detailed: DB ping, Redis ping, email config validation
- Ready: Kubernetes readiness probe
- Live: Kubernetes liveness probe

## Testing (001-user-authentication-role)
- **224 tests** with 40% coverage
- Contract tests: API endpoint validation
- Integration tests: Full auth flows (login, registration, password reset, token refresh)
- Unit tests: Security, permissions, password hashing, JWT blacklist
- Test fixtures: Authenticated clients, test users with different roles
- Coverage: `poetry run pytest --cov=app --cov-report=html`

## API Endpoints (005-legal-documentation)

### Legal Documents
- `GET /api/v1/legal/documents` - List all current published legal documents (public)
- `GET /api/v1/legal/documents/:type` - Get current version of Terms of Service or Privacy Policy (public)
- `GET /api/v1/legal/documents/:type/version/:version` - Get specific document version (public)
- `POST /api/v1/legal/documents` - Create new legal document draft (admin)
- `PATCH /api/v1/legal/documents/:id` - Update draft document (admin)
- `POST /api/v1/legal/documents/:id/publish` - Publish draft (admin)

### Consent Management
- `POST /api/v1/consent/accept` - Accept legal documents (required for registration/updates)
- `GET /api/v1/consent/status` - Get user's current consent status
- `GET /api/v1/consent/history` - Get user's consent history with pagination
- `POST /api/v1/consent/data-export` - Request GDPR data export (async job)
- `POST /api/v1/consent/data-deletion` - Request GDPR account deletion (30-day grace period)
- `POST /api/v1/consent/withdraw` - Withdraw consent (triggers account deactivation)

### Cookie Consent
- `GET /api/v1/cookies/consent` - Get cookie consent status (user or anonymous session)
- `POST /api/v1/cookies/consent` - Set cookie preferences (essential, analytics, marketing)
- `PUT /api/v1/cookies/consent` - Update cookie preferences
- `DELETE /api/v1/cookies/consent` - Revoke cookie consent (default to reject all)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
