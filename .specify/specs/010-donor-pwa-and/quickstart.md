# Quickstart: Donor PWA Development

**Feature**: 010-donor-pwa-and
**Purpose**: Get donor PWA running locally with event registration capabilities
**Time**: ~10 minutes (assuming Docker, Node.js, Python already installed)

---

## Prerequisites

Before starting, ensure you have:

- ✅ Docker & Docker Compose (PostgreSQL, Redis)
- ✅ Node.js 22.x (managed via nvm)
- ✅ pnpm 9.x (package manager)
- ✅ Python 3.11+ (managed via Poetry)
- ✅ Azure CLI (optional, for cloud storage testing)

---

## 1. Clone & Setup Monorepo

```bash
# If not already cloned
git clone https://github.com/your-org/fundrbolt-platform.git
cd fundrbolt-platform

# Switch to feature branch
git checkout 010-donor-pwa-and

# Install pre-commit hooks
make install-hooks
```

---

## 2. Start Infrastructure Services

Start PostgreSQL and Redis in Docker:

```bash
# Start all infrastructure services
make docker-up

# Verify services are running
docker ps
# Should see: postgres:15-alpine, redis:7-alpine
```

**Verify connectivity**:

```bash
# PostgreSQL (should connect without error)
docker exec -it fundrbolt-postgres psql -U fundrbolt_user -d fundrbolt_db -c "SELECT 1;"

# Redis (should return PONG)
docker exec -it fundrbolt-redis redis-cli ping
```

---

## 3. Backend Setup

### Install Dependencies

```bash
# Navigate to backend
cd backend

# Install Python dependencies with Poetry
poetry install

# Verify installation
poetry run python --version
# Should show: Python 3.11.x
```

### Run Database Migrations

```bash
# Run all migrations (includes Migration 011 with 3 new tables)
poetry run alembic upgrade head

# Verify migration
poetry run alembic current
# Should show: 011_add_guest_meal_tables (head)
```

**Migration 011 creates**:

- `event_registrations` - User event registrations with guest count
- `registration_guests` - Optional guest information (name, email, phone)
- `meal_selections` - Meal choices for registrants and guests

### Seed Test Data

```bash
# Seed NPO, events, food options, and test users
poetry run python seed_npo_demo_data.py

# Seed event food options (required for meal selections)
poetry run python seed_food_options.py

# Verify data
docker exec -it fundrbolt-postgres psql -U fundrbolt_user -d fundrbolt_db -c "SELECT slug, name FROM events LIMIT 5;"
# Should show events with slugs like "spring-gala-2025"

docker exec -it fundrbolt-postgres psql -U fundrbolt_user -d fundrbolt_db -c "SELECT name FROM event_food_options WHERE event_id IN (SELECT id FROM events LIMIT 1);"
# Should show meal options: Chicken Marsala, Vegetarian Pasta, Salmon Fillet
```

### Start Backend Server

```bash
# From backend/ directory
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or use Makefile shortcut (from project root)
cd ..
make dev-backend
```

**Verify backend**:

- Health check: http://localhost:8000/health
- API docs: http://localhost:8000/docs
- Metrics: http://localhost:8000/metrics

---

## 4. Frontend Setup

### Install Shared Dependencies

```bash
# From project root
cd frontend

# Install shared workspace dependencies
pnpm install
```

This installs:

- `@fundrbolt/shared` - Shared components, hooks, utilities
- All dependencies for `fundrbolt-admin`, `donor-pwa`, `landing-site`

### Start Donor PWA

```bash
# Navigate to donor PWA
cd donor-pwa

# Start dev server
pnpm dev
```

**Or use Makefile shortcut** (from project root):

```bash
make dev-donor-pwa
```

**Verify frontend**:

- Donor PWA: http://localhost:5174 (Vite default port + 1 for second app)
- Admin PWA: http://localhost:5173 (if running)

---

## 5. Test Event Registration with Guest & Meal Selection

### Register a New Donor

1. Open donor PWA: <http://localhost:5174/register>
2. Fill in registration form:
   - Email: `donor@example.com`
   - Password: `SecurePass123!`
   - First Name: `John`
   - Last Name: `Doe`
3. Click "Register" → Should redirect to `/events`

### Register for Event with Guests

1. Navigate to: <http://localhost:5174/events>
2. Click on "Spring Gala 2025" event card
3. Should redirect to: <http://localhost:5174/events/spring-gala-2025>
4. Verify event page shows:
   - ✅ Event branding (logo, colors)
   - ✅ Event details (date, location, description)
   - ✅ "Register for Event" button
5. Click "Register for Event"
6. **Registration Wizard Steps**:
   - **Step 1 - Guest Count**: Select "3 guests" (including registrant)
   - **Step 2 - Meal Selection**: Select "Chicken Marsala" for self
   - **Step 3 - Guest Details** (optional):
     - Guest 1: Name "Jane Smith", Email "jane@example.com" → Select "Vegetarian Pasta"
     - Guest 2: Name "Bob Johnson" (no email) → Select "Salmon Fillet"
   - **Step 4 - Confirm**: Review registration summary → Click "Complete Registration"
7. Confirmation page should show:
   - ✅ "Registration Confirmed"
   - ✅ Primary registrant meal: Chicken Marsala
   - ✅ 2 guests listed with meal selections
   - ✅ "Add Guest Details" button for updating guest info

### Manage Guest Information

1. From confirmation page, click "Manage Guests"
2. Should redirect to: <http://localhost:5174/registrations/{id}/guests>
3. Guest list should show:
   - Guest 1: Jane Smith (jane@example.com) - Vegetarian Pasta
   - Guest 2: Bob Johnson (no email) - Salmon Fillet
4. Click "Edit" on Guest 2:
   - Add email: `bob@example.com`
   - Add phone: `+1-555-0200`
   - Click "Save" → Guest details updated
5. Click "Send Invitation" for Guest 1:
   - Email sent to `jane@example.com` with registration link
   - Icon appears: "Invitation sent 2 minutes ago"

### View My Events

1. Navigate to: <http://localhost:5174/profile/events>
2. Should see "Spring Gala 2025" in confirmed registrations list
3. Click event card to expand details:
   - Total attendees: 3 (you + 2 guests)
   - Meal selections: 1 Chicken, 1 Vegetarian, 1 Salmon
4. Click "Cancel Registration" → Confirmation modal appears
5. Cancel → Event moves to cancelled section, all guests/meals deleted

---

## 6. Verify API Endpoints

### Get Public Event by Slug

```bash
curl http://localhost:8000/api/v1/events/public/spring-gala-2025 | jq
```

**Expected response**:

```json
{
  "id": "550e8400-...",
  "slug": "spring-gala-2025",
  "name": "Spring Gala 2025",
  "event_datetime": "2025-04-15T18:00:00-05:00",
  "primary_color": "#1E40AF",
  "logo_url": "https://storage.fundrbolt.app/events/logos/spring-gala.png",
  "npo_name": "Children's Foundation",
  "registration_status": "not_registered",
  "confirmed_attendees": 0
}
```

### Register for Event (Authenticated)

```bash
# 1. Login to get access token
ACCESS_TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "donor@example.com", "password": "SecurePass123!"}' \
  | jq -r '.access_token')

# 2. Get event ID
EVENT_ID=$(curl http://localhost:8000/api/v1/events/public/spring-gala-2025 | jq -r '.id')

# 3. Create registration
curl -X POST http://localhost:8000/api/v1/registrations \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"event_id\": \"$EVENT_ID\", \"number_of_guests\": 1}" \
  | jq
```

**Expected response**:

```json
{
  "id": "770e8400-...",
  "user_id": "880e8400-...",
  "event_id": "550e8400-...",
  "status": "confirmed",
  "number_of_guests": 1,
  "created_at": "2025-01-20T14:32:00Z",
  "event": {
    "slug": "spring-gala-2025",
    "name": "Spring Gala 2025"
  }
}
```

### List User Registrations

```bash
curl http://localhost:8000/api/v1/registrations \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | jq
```

---

## 7. Run Tests

### Backend Tests

```bash
cd backend

# Run all tests
poetry run pytest

# Run registration-specific tests
poetry run pytest app/tests/test_api/test_v1/test_registrations.py -v

# Run with coverage
poetry run pytest --cov=app --cov-report=html
open htmlcov/index.html
```

**Expected**: All tests pass, coverage > 80%

### Frontend Tests

```bash
cd frontend/donor-pwa

# Run unit tests
pnpm test

# Run E2E tests (requires backend running)
pnpm test:e2e

# Run specific test file
pnpm test src/features/event-registration/event-registration.test.tsx
```

---

## 8. Common Issues & Troubleshooting

### Backend won't start

**Error**: `sqlalchemy.exc.OperationalError: could not connect to server`

**Solution**:

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Restart Docker services
make docker-down
make docker-up

# Verify connection
docker exec -it fundrbolt-postgres psql -U fundrbolt_user -d fundrbolt_db -c "SELECT 1;"
```

### Frontend can't reach backend

**Error**: `Network Error` or `ERR_CONNECTION_REFUSED`

**Solution**:

1. Verify backend is running: http://localhost:8000/health
2. Check CORS configuration in `backend/app/core/config.py`:
   ```python
   CORS_ORIGINS = ["http://localhost:5173", "http://localhost:5174"]
   ```
3. Restart backend server

### Migrations fail

**Error**: `Target database is not up to date`

**Solution**:

```bash
cd backend

# Check current migration
poetry run alembic current

# Rollback one revision
poetry run alembic downgrade -1

# Re-run migrations
poetry run alembic upgrade head
```

### Event slugs not working

**Error**: `Event with slug 'spring-gala-2025' not found`

**Solution**:

1. Verify events have slugs in database:
   ```bash
   docker exec -it fundrbolt-postgres psql -U fundrbolt_user -d fundrbolt_db -c "SELECT id, slug, name FROM events;"
   ```
2. If slugs are missing, re-run seed script:
   ```bash
   cd backend
   poetry run python seed_npo_demo_data.py
   ```

### pnpm workspace issues

**Error**: `Cannot find module '@fundrbolt/shared'`

**Solution**:

```bash
# From project root
cd frontend

# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Verify shared package is linked
ls -la node_modules/@fundrbolt
# Should show symlink to ../shared
```

---

## 9. Development Workflow

### Make Code Changes

```bash
# 1. Create feature branch (already on 010-donor-pwa-and)
git checkout -b 010-donor-pwa-and

# 2. Make changes to code

# 3. Run pre-commit hooks
make check-commits

# 4. Commit changes
git commit -m "feat(donor-pwa): add event registration flow"

# 5. Push to remote
git push origin 010-donor-pwa-and
```

### Hot Reload Development

- **Backend**: Uvicorn auto-reloads on file changes (--reload flag)
- **Frontend**: Vite HMR updates instantly (no page refresh needed)
- **Shared components**: Changes in `@fundrbolt/shared` auto-update in donor-pwa

### Database Schema Changes

```bash
cd backend

# 1. Create new migration
poetry run alembic revision --autogenerate -m "add_event_capacity_field"

# 2. Review generated migration
cat alembic/versions/012_add_event_capacity_field.py

# 3. Apply migration
poetry run alembic upgrade head

# 4. Test in dev
# ... verify changes ...

# 5. Commit migration file
git add alembic/versions/012_add_event_capacity_field.py
git commit -m "chore(db): add event capacity field migration"
```

---

## 10. Next Steps

✅ **Basic setup complete!** You can now:

1. **Implement components**: Build event cards, registration forms, profile pages
2. **Add branding**: Implement CSS custom property injection for dynamic colors
3. **Test edge cases**: Duplicate registrations, cancelled events, rate limiting
4. **Add analytics**: Track registration conversions, page views
5. **Deploy to Azure**: Use Bicep templates to provision Static Web Apps

### Recommended Reading

- [Backend API Documentation](http://localhost:8000/docs) - Interactive OpenAPI docs
- [React Router Docs](https://tanstack.com/router/latest) - TanStack Router guide
- [Zustand State Management](https://zustand.docs.pmnd.rs/) - Global state patterns
- [Tailwind CSS 4](https://tailwindcss.com/docs) - Styling reference

---

## Appendix: Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://fundrbolt_user:fundrbolt_pass@localhost:5432/fundrbolt_db

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15

# CORS
CORS_ORIGINS=["http://localhost:5173","http://localhost:5174"]

# Azure (optional for local dev)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
AZURE_STORAGE_CONTAINER_NAME=uploads
```

### Frontend (.env.local)

```bash
# API endpoint
VITE_API_URL=http://localhost:8000/api/v1

# Environment
VITE_ENV=development
```

---

## Quick Commands Reference

| Task | Command |
|------|---------|
| Start all services | `make dev-fullstack` |
| Start backend only | `make dev-backend` |
| Start donor PWA only | `make dev-donor-pwa` |
| Run backend tests | `make test-backend` |
| Run frontend tests | `cd frontend/donor-pwa && pnpm test` |
| Database migrations | `make migrate` or `cd backend && poetry run alembic upgrade head` |
| Check code quality | `make check-commits` |
| View logs | `make docker-logs` |
| Stop all services | `make docker-down` |

---

**Need help?** Check the [full documentation](../../README.md) or open an issue on GitHub.
