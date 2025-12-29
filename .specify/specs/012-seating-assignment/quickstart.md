# Developer Quickstart: Seating Assignment & Bidder Number Management

**Feature**: 012-seating-assignment
**Estimated Setup Time**: 30 minutes
**Prerequisites**: Fundrbolt platform running locally (see root README.md)

---

## Overview

This quickstart guide helps you set up your development environment to work on the seating assignment and bidder number management feature. By the end, you'll have:

- Database schema updated with seating fields
- Backend API endpoints running
- Frontend components integrated into Admin PWA and Donor PWA
- Sample data seeded for testing

---

## Phase 1: Database Setup (10 minutes)

### 1.1 Run Migrations

```bash
# Navigate to backend directory
cd backend

# Run Alembic migrations
poetry run alembic upgrade head

# Verify migrations applied
poetry run alembic current
# Should show: 015_bidder_number_uniqueness_trigger (head)
```

**What This Does**:
- Adds `table_count`, `max_guests_per_table` to `events` table
- Adds `bidder_number`, `table_number`, `bidder_number_assigned_at` to `registration_guests` table
- Creates database trigger for event-scoped bidder number uniqueness
- Adds indexes for query optimization

### 1.2 Seed Sample Data

```bash
# Create sample event with seating configuration
poetry run python seed_seating_data.py

# This creates:
# - 1 demo event with 10 tables, 8 guests per table (80 capacity)
# - 30 registered guests (mix of assigned and unassigned)
# - 20 bidder numbers already assigned (100-119)
```

**Sample Data Structure**:

| Table | Guests Assigned | Bidder Numbers |
|-------|----------------|----------------|
| 1     | 6/8            | 100-105        |
| 2     | 8/8 (Full)     | 106-113        |
| 3     | 4/8            | 114-117        |
| 4     | 2/8            | 118-119        |
| 5-10  | 0/8 (Empty)    | N/A            |

---

## Phase 2: Backend Development (15 minutes)

### 2.1 Start Backend Server

```bash
# From project root
make dev-backend
# OR manually:
cd backend && poetry run uvicorn app.main:app --reload --port 8000
```

**Backend runs at**: `http://localhost:8000`

### 2.2 Test API Endpoints

**Interactive API Docs**: Navigate to `http://localhost:8000/docs`

**Quick Test via cURL**:

```bash
# 1. Login (get access token)
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@demo.com", "password": "password123"}'
# Copy the "access_token" from response

# 2. Configure event seating
EVENT_ID="YOUR_EVENT_ID_HERE"
ACCESS_TOKEN="YOUR_TOKEN_HERE"

curl -X PATCH http://localhost:8000/api/v1/admin/events/$EVENT_ID/seating/config \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_count": 10, "max_guests_per_table": 8}'

# 3. Get guests with seating status
curl -X GET http://localhost:8000/api/v1/admin/events/$EVENT_ID/seating/guests \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 4. Assign guest to table
GUEST_ID="YOUR_GUEST_ID_HERE"

curl -X PATCH http://localhost:8000/api/v1/admin/events/$EVENT_ID/guests/$GUEST_ID/table \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_number": 5}'

# 5. Auto-assign remaining guests
curl -X POST http://localhost:8000/api/v1/admin/events/$EVENT_ID/seating/auto-assign \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### 2.3 Run Backend Tests

```bash
# Run seating-related tests
cd backend
poetry run pytest app/tests/unit/test_seating_service.py -v
poetry run pytest app/tests/unit/test_bidder_number_service.py -v
poetry run pytest app/tests/integration/test_seating_assignment.py -v

# Run all tests with coverage
make test-backend
# OR:
poetry run pytest --cov=app --cov-report=html
```

**Expected Test Coverage**: 80%+ for seating service layer

---

## Phase 3: Frontend Development (15 minutes)

### 3.1 Install Frontend Dependencies

```bash
# Admin PWA
cd frontend/fundrbolt-admin
pnpm install

# Donor PWA
cd ../donor-pwa
pnpm install
```

### 3.2 Start Frontend Dev Servers

**Option A: Start Admin PWA only**

```bash
make dev-frontend
# OR manually:
cd frontend/fundrbolt-admin && pnpm dev
```

Runs at: `http://localhost:5173`

**Option B: Start Donor PWA only**

```bash
make start-donor-pwa
# OR manually:
cd frontend/donor-pwa && pnpm dev --port 5174
```

Runs at: `http://localhost:5174`

**Option C: Start both (use separate terminals)**

```bash
# Terminal 1: Admin PWA
cd frontend/fundrbolt-admin && pnpm dev

# Terminal 2: Donor PWA
cd frontend/donor-pwa && pnpm dev --port 5174
```

### 3.3 Navigate to Seating Features

**Admin PWA**:

1. Navigate to `http://localhost:5173`
2. Login with demo admin credentials: `admin@demo.com` / `password123`
3. Go to Events → [Select Event] → Seating Management
4. Try:
   - Configuring seating (set table count and max guests)
   - Viewing unassigned guests
   - Drag-and-drop guests to tables
   - Manually assigning bidder numbers
   - Auto-assigning remaining guests

**Donor PWA**:

1. Navigate to `http://localhost:5174`
2. Login with demo donor credentials: `donor@demo.com` / `password123`
3. Go to Events → [Select Event]
4. See seating section above auction items showing:
   - Your table number
   - Message prompting to check in (if not checked in)
   - Your bidder number badge (only after check-in)
   - Collapsible section with tablemates

### 3.4 Run Frontend Tests

```bash
# Admin PWA tests
cd frontend/fundrbolt-admin
pnpm test

# Donor PWA tests
cd frontend/donor-pwa
pnpm test
```

---

## Common Development Tasks

### Create a New Migration

```bash
cd backend
poetry run alembic revision -m "description of change"
# Edit the generated file in backend/alembic/versions/
poetry run alembic upgrade head
```

### Reset Database to Test Migrations

```bash
# Downgrade to before seating feature
cd backend
poetry run alembic downgrade 012_event_registration_and_guests

# Re-run seating migrations
poetry run alembic upgrade head
```

### Seed Additional Test Data

```bash
cd backend

# Seed more events with different configurations
poetry run python seed_seating_data.py --events 3 --tables 15 --capacity 10

# Seed specific scenarios
poetry run python seed_seating_data.py --scenario full_event  # All tables full
poetry run python seed_seating_data.py --scenario empty_event # No assignments
```

### Debug Drag-and-Drop Issues

```bash
# Check browser console for performance metrics
# Look for: "Drag-drop operation took Xms (target: 500ms)"

# Enable debug logging in frontend
# frontend/fundrbolt-admin/src/hooks/useSeatingDragDrop.ts
const DEBUG = true; // Set to true
```

### Test Bidder Number Conflict Resolution

```bash
# Manually assign duplicate number via API
curl -X PATCH http://localhost:8000/api/v1/admin/events/$EVENT_ID/guests/$GUEST_ID/bidder-number \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bidder_number": 234}'

# Check audit logs to see reassignment
curl -X GET http://localhost:8000/api/v1/admin/audit-logs?action=bidder_number_reassigned \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

---

## Troubleshooting

### Issue: Migration fails with "relation already exists"

**Solution**:

```bash
# Check current migration state
cd backend
poetry run alembic current

# If migrations are partially applied, downgrade and re-run
poetry run alembic downgrade base
poetry run alembic upgrade head
```

### Issue: Database trigger error on bidder number assignment

**Error**: `Bidder number 234 is already assigned to another guest in this event`

**Solution**: This is expected behavior. The database trigger enforces uniqueness. Use a different bidder number or let the service handle reassignment automatically.

### Issue: Frontend shows "Seating not configured" despite backend config

**Check**:

```bash
# Verify event has seating configuration
curl -X GET http://localhost:8000/api/v1/admin/events/$EVENT_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | jq '.table_count, .max_guests_per_table'

# Should return: 10, 8 (or your configured values)
```

**Solution**: Ensure both `table_count` AND `max_guests_per_table` are set (not null).

### Issue: Drag-and-drop not working in Admin PWA

**Check browser console**:

- Look for CORS errors → Ensure backend is running on correct port (8000)
- Look for 400 errors → Check table capacity limits
- Look for 403 errors → Ensure logged-in user has NPO Admin or NPO Staff role

**Debug**:

```bash
# Check user role
curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | jq '.role'

# Should return: "npo_admin" or "npo_staff"
```

### Issue: Auto-assign fails with "insufficient capacity"

**Diagnosis**:

```bash
# Check total registered guests vs capacity
curl -X GET http://localhost:8000/api/v1/admin/events/$EVENT_ID/seating/guests \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | jq '[.guests[] | select(.table_number == null)] | length'

# Compare with total capacity
curl -X GET http://localhost:8000/api/v1/admin/events/$EVENT_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | jq '(.table_count * .max_guests_per_table)'
```

**Solution**: Increase `table_count` or `max_guests_per_table` to accommodate all guests.

---

## Testing Scenarios

### Scenario 1: Basic Flow (Happy Path)

1. Configure event seating (10 tables, 8 guests per table)
2. Auto-assign all guests
3. Verify no conflicts
4. Check in Donor PWA that seating info displays correctly

**Expected Result**: All guests assigned to tables, bidder numbers 100-179 used, tables filled sequentially.

### Scenario 2: Manual Assignment with Conflict

1. Manually assign bidder number 234 to Guest A
2. Manually assign bidder number 234 to Guest B
3. Verify Guest A is automatically reassigned a new number
4. Check audit logs for reassignment record

**Expected Result**: Guest A gets new number (e.g., 235), Guest B gets 234, audit log created.

### Scenario 3: Capacity Limits

1. Configure event with 2 tables, 4 guests per table (capacity: 8)
2. Register 10 guests
3. Attempt auto-assign
4. Verify 2 guests remain unassigned with warning message

**Expected Result**: First 8 guests assigned, last 2 unassigned, API returns warning.

### Scenario 4: Party-Aware Assignment

1. Register 3 parties:
   - Party A: 5 guests
   - Party B: 3 guests
   - Party C: 2 guests
2. Configure 2 tables, 6 guests per table
3. Auto-assign
4. Verify parties are kept together

**Expected Result**:

- Table 1: Party A (5 guests) + 1 guest from Party C
- Table 2: Party B (3 guests) + 1 guest from Party C

### Scenario 5: Bidder Number Visibility (Check-in Gating)

1. Assign bidder number 234 to Guest A
2. Login as Guest A in Donor PWA
3. Navigate to event page
4. Verify bidder number is NOT shown (message: "Check in to see your bidder number")
5. Check in Guest A via Admin PWA
6. Refresh Donor PWA event page
7. Verify bidder number 234 is now displayed

**Expected Result**: Bidder number hidden before check-in, visible after check-in.

---

## Next Steps

After completing this quickstart:

1. **Read the Specification**: `.specify/specs/012-seating-assignment/spec.md`
2. **Understand the Data Model**: `.specify/specs/012-seating-assignment/data-model.md`
3. **Review API Contracts**: `.specify/specs/012-seating-assignment/contracts/`
4. **Check Implementation Plan**: `.specify/specs/012-seating-assignment/plan.md`
5. **Read Technical Research**: `.specify/specs/012-seating-assignment/research.md`

---

## Development Workflow

```bash
# 1. Create feature branch (if not already on it)
git checkout 012-seating-assignment

# 2. Make code changes
# Edit files in backend/app/ or frontend/fundrbolt-admin/src/

# 3. Run tests
make test-backend  # Backend tests
make test-frontend # Frontend tests

# 4. Check code quality
make lint          # Lint all code
make format        # Format all code
make type-check    # TypeScript type checking

# 5. Commit with pre-commit hooks
make check-commits # Run pre-commit hooks with auto-retry
git add .
git commit -m "feat: implement table assignment drag-and-drop"

# 6. Push to GitHub
git push origin 012-seating-assignment

# 7. Open pull request
# Create PR on GitHub targeting main branch
```

---

## Useful Commands Reference

| Command | Description |
|---------|-------------|
| `make dev-backend` | Start backend dev server |
| `make dev-frontend` | Start Admin PWA dev server |
| `make start-donor-pwa` | Start Donor PWA dev server |
| `make test` | Run all tests (backend + frontend) |
| `make lint` | Lint all code |
| `make format` | Format all code (black, ruff, prettier) |
| `make migrate` | Run Alembic migrations |
| `make docker-up` | Start PostgreSQL and Redis containers |
| `make docker-down` | Stop all containers |

---

## Additional Resources

- **Main README**: `/home/jjeanes/fundrbolt-platform/README.md`
- **Backend README**: `/home/jjeanes/fundrbolt-platform/backend/README.md`
- **API Documentation**: `http://localhost:8000/docs` (when backend is running)
- **Makefile Help**: Run `make help` in project root for all available commands

---

## Support

If you encounter issues:

1. Check the **Troubleshooting** section above
2. Review the **Implementation Plan**: `.specify/specs/012-seating-assignment/plan.md`
3. Check existing tests for examples: `backend/app/tests/unit/test_seating_service.py`
4. Ask in team chat or create GitHub issue

Happy coding! 🎉
