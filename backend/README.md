# Augeo Platform - Backend API

FastAPI-based backend API for the Augeo nonprofit auction platform, featuring authentication, role-based access control, and multi-tenant data isolation.

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Docker & Docker Compose
- Poetry (Python dependency manager)

### Installation

1. **Start infrastructure services**:
   ```bash
   docker-compose up -d
   ```

2. **Install dependencies**:
   ```bash
   cd backend
   poetry install
   poetry shell
   ```

3. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run migrations**:
   ```bash
   alembic upgrade head
   ```

5. **Start development server**:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

API will be available at:
- **API**: http://localhost:8000
- **API Docs (Swagger)**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health
- **Detailed Health**: http://localhost:8000/health/detailed
- **Readiness**: http://localhost:8000/health/ready
- **Liveness**: http://localhost:8000/health/live

## 🏗️ Project Structure

```
backend/
├── app/
│   ├── api/              # API routes
│   │   └── v1/           # API version 1
│   ├── core/             # Core utilities (config, security, database)
│   ├── middleware/       # Custom middleware (auth, rate limiting)
│   ├── models/           # SQLAlchemy database models
│   ├── schemas/          # Pydantic request/response schemas
│   ├── services/         # Business logic services
│   └── tests/            # Test suite
├── alembic/              # Database migrations
│   └── versions/         # Migration files
├── pyproject.toml        # Poetry dependencies
├── alembic.ini           # Alembic configuration
└── pytest.ini            # Pytest configuration
```

## 🧪 Testing

```bash
# Run all tests with coverage
pytest

# Run specific test types
pytest -m unit          # Unit tests only
pytest -m integration   # Integration tests only
pytest -m contract      # Contract tests (API validation)

# Run with verbose output
pytest -v

# Generate coverage report
pytest --cov=app --cov-report=html
```

## 🔧 Development

### Code Quality

```bash
# Lint with Ruff
ruff check .

# Format with Black
black .

# Type check with mypy
mypy app --strict --ignore-missing-imports

# Run all checks
pre-commit run --all-files
```

### Database Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "Description of changes"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View migration history
alembic history
```

## 🔐 Environment Variables

See `.env.example` for all required environment variables.

**Critical settings**:
- `JWT_SECRET_KEY`: Generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`: Initial admin credentials

## 📚 API Documentation

Interactive API documentation is automatically generated:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

### Main Endpoints

**Authentication**:
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login with email/password
- `POST /api/v1/auth/logout` - Logout current session
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/verify-email` - Verify email with token
- `POST /api/v1/auth/verify-email/resend` - Resend verification email

**Password Management**:
- `POST /api/v1/auth/password/reset/request` - Request password reset
- `POST /api/v1/auth/password/reset/confirm` - Confirm password reset
- `POST /api/v1/auth/password/change` - Change password (authenticated)

**User Management** (Admin only):
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user
- `GET /api/v1/users/{user_id}` - Get user
- `PATCH /api/v1/users/{user_id}` - Update user
- `DELETE /api/v1/users/{user_id}` - Delete user
- `PATCH /api/v1/users/{user_id}/role` - Update user role
- `POST /api/v1/users/{user_id}/activate` - Reactivate user

**Health Checks**:
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed service status (DB, Redis, email)
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe

**Legal & Compliance** (GDPR):

- `GET /api/v1/legal/documents` - List all published legal documents (public)
- `GET /api/v1/legal/documents/{type}` - Get current Terms or Privacy Policy (public)
- `GET /api/v1/legal/documents/{type}/version/{version}` - Get specific document version (public)
- `POST /api/v1/consent/accept` - Accept Terms of Service and Privacy Policy (authenticated)
- `GET /api/v1/consent/status` - Get current consent status (authenticated)
- `GET /api/v1/consent/history` - Get consent history with pagination (authenticated)
- `POST /api/v1/consent/withdraw` - Withdraw consent (GDPR Article 7)
- `POST /api/v1/consent/data-export` - Request GDPR data export (async)
- `POST /api/v1/consent/data-deletion` - Request account deletion (30-day grace)
- `GET /api/v1/cookies/consent` - Get cookie consent status
- `POST /api/v1/cookies/consent` - Set cookie preferences (Essential, Analytics, Marketing)
- `PUT /api/v1/cookies/consent` - Update cookie preferences
- `DELETE /api/v1/cookies/consent` - Revoke cookie consent
- `POST /api/v1/legal/admin/documents` - Create draft legal document (super admin)
- `PATCH /api/v1/legal/admin/documents/{id}` - Update draft document (super admin)
- `POST /api/v1/legal/admin/documents/{id}/publish` - Publish document (super admin)
- `GET /api/v1/legal/admin/documents` - List all documents with filters (super admin)

**Event Sponsors**:

- `GET /api/v1/events/{event_id}/sponsors` - List all sponsors for an event (public)
- `POST /api/v1/events/{event_id}/sponsors` - Create a new sponsor (NPO admin/staff)
- `GET /api/v1/events/{event_id}/sponsors/{sponsor_id}` - Get sponsor details (public)
- `PATCH /api/v1/events/{event_id}/sponsors/{sponsor_id}` - Update sponsor (NPO admin/staff)
- `DELETE /api/v1/events/{event_id}/sponsors/{sponsor_id}` - Delete sponsor (NPO admin/staff)
- `PATCH /api/v1/events/{event_id}/sponsors/reorder` - Reorder sponsors via drag-and-drop (NPO admin/staff)

**Sponsor Logo Management**:

- Sponsors require logo upload with automatic thumbnail generation
- Supported formats: PNG, JPEG, WebP
- Max file size: 5MB
- Thumbnails: Auto-generated at 300x300px for list views
- Logos stored in Azure Blob Storage with automatic cleanup on delete
- Logo sizes: xlarge, large, medium, small, xsmall (controls display size/prominence)

**Seating Assignment** (Admin):

- `PATCH /api/v1/admin/events/{event_id}/seating/config` - Configure event seating (table count, max guests per table)
- `GET /api/v1/admin/events/{event_id}/seating/bidder-numbers/available` - Get available bidder numbers (100-999 range)
- `PATCH /api/v1/admin/events/{event_id}/registrations/{registration_id}/bidder-number` - Assign bidder number to registration
- `PATCH /api/v1/admin/events/{event_id}/registrations/{registration_id}/table` - Assign table number to registration
- `DELETE /api/v1/admin/events/{event_id}/registrations/{registration_id}/table` - Remove table assignment
- `GET /api/v1/admin/events/{event_id}/seating/guests` - List all guests with seating info (paginated)
- `GET /api/v1/admin/events/{event_id}/seating/tables` - Get table occupancy data
- `POST /api/v1/admin/events/{event_id}/seating/auto-assign` - Auto-assign bidder numbers to unassigned registrations

**Seating Features**:

- **Event Configuration**: Set table count and max guests per table
- **Bidder Numbers**: Automatic assignment (100-999 range), manual override, duplicate prevention
- **Table Assignment**: Manual assignment with capacity validation, drag-and-drop UI support
- **Auto-Assignment**: Party-aware algorithm keeps groups together, respects table capacity
- **Guest Tracking**: Distinguishes between primary registrants and accompanying guests
- **Check-in Integration**: Bidder numbers visible to donors only after check-in
- **Donor View**: Donors can see their seating info, tablemates, and bidder number (after check-in)

**Seating Assignment** (Donor):

- `GET /api/v1/donor/events/{event_id}/my-seating` - Get donor's seating information, tablemates, and bidder number (gated by check-in)

**Metrics** (Prometheus):

- `GET /metrics` - Prometheus-formatted metrics
  - `augeo_http_requests_total` - HTTP requests by method/path/status
  - `augeo_db_failures_total` - Database connection failures
  - `augeo_redis_failures_total` - Redis connection failures
  - `augeo_email_failures_total` - Email send failures
  - `augeo_up` - Application up/down status (1=up, 0=down)

## 🛠️ Tech Stack

- **Framework**: FastAPI 0.104+
- **ORM**: SQLAlchemy 2.0+ (async)
- **Database**: PostgreSQL 15+ with Row-Level Security
- **Cache**: Redis 7+
- **Validation**: Pydantic 2.x
- **Authentication**: OAuth2 + JWT (python-jose)
- **Password Hashing**: bcrypt (passlib)
- **Migrations**: Alembic
- **Testing**: pytest, factory_boy
- **Linting**: Ruff, Black, mypy

## 📖 Documentation

For detailed documentation, see:
- [Quickstart Guide](../.specify/specs/001-user-authentication-role/quickstart.md)
- [API Contracts](../.specify/specs/001-user-authentication-role/contracts/)
- [Data Model](../.specify/specs/001-user-authentication-role/data-model.md)
- [Implementation Plan](../.specify/specs/001-user-authentication-role/plan.md)

## 🤝 Contributing

1. Create a feature branch from `001-user-authentication-role` (or current feature branch)
2. Write tests first (TDD approach)
3. Implement feature
4. Run code quality checks: `poetry run ruff check . && poetry run black . && poetry run mypy app`
5. **ALWAYS commit with safe-commit script**: `./scripts/safe-commit.sh "message"`
6. Submit PR for review

### Commit Guidelines

**CRITICAL**: Always use the safe-commit script to ensure pre-commit hooks pass:

```bash
./scripts/safe-commit.sh "feat: add user export feature"
```

This script:
- Runs pre-commit hooks to completion
- Auto-fixes formatting issues (ruff, black, trailing whitespace)
- Re-runs hooks after auto-fixes to verify
- Only commits if all checks pass

**Never use** `git commit -m` directly - it bypasses verification.

## 📄 License

See [LICENSE](../LICENSE) file.
