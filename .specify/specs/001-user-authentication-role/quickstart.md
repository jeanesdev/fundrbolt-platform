# Quickstart Guide: User Authentication & Role Management

**Feature**: 001-user-authentication-role
**Date**: October 20, 2025
**Audience**: Developers setting up local development environment

---

## Prerequisites

- **Python**: 3.11 or higher
- **Node.js**: 18.x or higher (for frontend)
- **pnpm**: 8.x or higher (package manager)
- **Docker & Docker Compose**: Latest stable version
- **Git**: For version control

---

## 1. Initial Setup

### Clone Repository

```bash
git clone https://github.com/jeanesdev/fundrbolt-platform.git
cd fundrbolt-platform
```

### Environment Variables

Create `.env` file in project root:

```bash
# Backend Environment Variables
ENVIRONMENT=development
DEBUG=true

# Database (PostgreSQL)
DATABASE_URL=postgresql://fundrbolt_user:fundrbolt_password@localhost:5432/fundrbolt_db

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT Configuration
JWT_SECRET_KEY=your-super-secret-jwt-key-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Azure Communication Services (Email)
AZURE_COMMUNICATION_CONNECTION_STRING=your-azure-communication-connection-string
EMAIL_FROM_ADDRESS=noreply@fundrbolt.app
EMAIL_FROM_NAME=Fundrbolt Platform

# Frontend URLs (for email links)
FRONTEND_ADMIN_URL=http://localhost:5173
FRONTEND_DONOR_URL=http://localhost:5174

# Super Admin Seed (for initial setup)
SUPER_ADMIN_EMAIL=admin@fundrbolt.app
SUPER_ADMIN_PASSWORD=ChangeMe123!
SUPER_ADMIN_FIRST_NAME=Super
SUPER_ADMIN_LAST_NAME=Admin

# Rate Limiting
RATE_LIMIT_LOGIN_ATTEMPTS=5
RATE_LIMIT_LOGIN_WINDOW_MINUTES=15
```

**Security Note**: Generate a strong JWT secret in production:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## 2. Start Infrastructure (Docker Compose)

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: fundrbolt_postgres
    environment:
      POSTGRES_USER: fundrbolt_user
      POSTGRES_PASSWORD: fundrbolt_password
      POSTGRES_DB: fundrbolt_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fundrbolt_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: fundrbolt_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

Start services:

```bash
docker-compose up -d
```

Verify services are running:

```bash
docker-compose ps
```

Expected output:
```
NAME                IMAGE                COMMAND                  SERVICE    STATUS
fundrbolt_postgres      postgres:15-alpine   "docker-entrypoint.s…"   postgres   Up 10 seconds (healthy)
fundrbolt_redis         redis:7-alpine       "docker-entrypoint.s…"   redis      Up 10 seconds (healthy)
```

---

## 3. Backend Setup

### Install Python Dependencies

Navigate to backend directory:

```bash
cd backend
```

Create virtual environment and install dependencies:

```bash
# Install Poetry if not already installed
curl -sSL https://install.python-poetry.org | python3 -

# Install dependencies
poetry install

# Activate virtual environment
poetry shell
```

### Run Database Migrations

```bash
# Initialize Alembic (first time only)
alembic upgrade head
```

This will:
1. Create `roles` table + seed 5 core roles
2. Create `users` table
3. Create `permissions` table + seed default permissions
4. Create `sessions` table
5. Create `audit_logs` table
6. Create `event_staff` table (depends on events table from feature 002)
7. **Seed super admin** from environment variables
8. Enable Row-Level Security policies

Verify migration:

```bash
# Check PostgreSQL tables
docker exec -it fundrbolt_postgres psql -U fundrbolt_user -d fundrbolt_db -c "\dt"
```

Expected output:
```
              List of relations
 Schema |       Name        | Type  |   Owner
--------+-------------------+-------+------------
 public | alembic_version   | table | fundrbolt_user
 public | audit_logs        | table | fundrbolt_user
 public | permissions       | table | fundrbolt_user
 public | roles             | table | fundrbolt_user
 public | sessions          | table | fundrbolt_user
 public | users             | table | fundrbolt_user
```

### Verify Super Admin Created

```bash
docker exec -it fundrbolt_postgres psql -U fundrbolt_user -d fundrbolt_db -c \
  "SELECT id, email, role_id FROM users WHERE email = 'admin@fundrbolt.app';"
```

Expected output:
```
                  id                  |      email       |              role_id
--------------------------------------+------------------+------------------------------------
 550e8400-e29b-41d4-a716-446655440000 | admin@fundrbolt.app  | <uuid-of-super-admin-role>
```

### Start Backend Server

```bash
# Development mode with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend should be running at: `http://localhost:8000`

API docs available at: `http://localhost:8000/docs` (Swagger UI)

---

## 4. Frontend Setup

### Install Admin Dashboard Dependencies

```bash
cd ../frontend/fundrbolt-admin
pnpm install
```

### Start Admin Dashboard

```bash
pnpm dev
```

Admin dashboard should be running at: `http://localhost:5173`

### Install Donor PWA Dependencies (Optional)

```bash
cd ../donor-pwa
pnpm install
```

### Start Donor PWA (Optional)

```bash
pnpm dev
```

Donor PWA should be running at: `http://localhost:5174`

---

## 5. Test Authentication Flow

### Test 1: User Registration

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.donor@example.com",
    "password": "TestPass123",
    "first_name": "Test",
    "last_name": "Donor",
    "phone": "+1-555-0123"
  }'
```

Expected response:
```json
{
  "user": {
    "id": "uuid-here",
    "email": "test.donor@example.com",
    "first_name": "Test",
    "last_name": "Donor",
    "phone": "+1-555-0123",
    "email_verified": false,
    "is_active": false,
    "role": "donor",
    "npo_id": null,
    "created_at": "2025-10-20T10:00:00Z",
    "organization_name": null,
    "address_line1": null,
    "address_line2": null,
    "city": null,
    "state": null,
    "postal_code": null,
    "country": null
  },
  "message": "Verification email sent to test.donor@example.com"
}
```

#### Registration with Organization and Address

For NPO administrators who want to provide organization details:

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@helpinghand.org",
    "password": "SecurePass456",
    "first_name": "Jane",
    "last_name": "Smith",
    "phone": "+1-555-0199",
    "organization_name": "Helping Hand Foundation",
    "address_line1": "123 Main Street",
    "address_line2": "Suite 200",
    "city": "Boston",
    "state": "MA",
    "postal_code": "02101",
    "country": "USA"
  }'
```

Expected response:
```json
{
  "user": {
    "id": "uuid-here",
    "email": "admin@helpinghand.org",
    "first_name": "Jane",
    "last_name": "Smith",
    "phone": "+1-555-0199",
    "email_verified": false,
    "is_active": false,
    "role": "donor",
    "npo_id": null,
    "created_at": "2025-10-20T10:00:00Z",
    "organization_name": "Helping Hand Foundation",
    "address_line1": "123 Main Street",
    "address_line2": "Suite 200",
    "city": "Boston",
    "state": "MA",
    "postal_code": "02101",
    "country": "USA"
  },
  "message": "Verification email sent to admin@helpinghand.org"
}
```

**Note**: All address fields are optional. You can provide organization name without address, partial addresses, or all fields.
```

### Test 2: Check Email Verification Token (Development)

In development, check Redis for verification token:

```bash
docker exec -it fundrbolt_redis redis-cli KEYS "email_verify:*"
```

Get token details:

```bash
docker exec -it fundrbolt_redis redis-cli GET "email_verify:<token-hash>"
# Returns: user_id
```

**Production Note**: In production, token is sent via Azure Communication Services email.

### Test 3: Verify Email

```bash
curl -X POST http://localhost:8000/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<token-from-redis>"
  }'
```

Expected response:
```json
{
  "message": "Email verified successfully",
  "user": {
    "id": "uuid-here",
    "email": "test.donor@example.com",
    "email_verified": true,
    "is_active": true
  }
}
```

### Test 4: Login

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.donor@example.com",
    "password": "TestPass123"
  }'
```

Expected response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900,
  "user": {
    "id": "uuid-here",
    "email": "test.donor@example.com",
    "first_name": "Test",
    "last_name": "Donor",
    "role": "donor",
    "npo_id": null
  }
}
```

### Test 5: Access Protected Endpoint

```bash
# Save access token from previous response
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Expected response:
```json
{
  "id": "uuid-here",
  "email": "test.donor@example.com",
  "first_name": "Test",
  "last_name": "Donor",
  "phone": "+1-555-0123",
  "role": "donor",
  "npo_id": null,
  "email_verified": true,
  "is_active": true,
  "created_at": "2025-10-20T10:00:00Z",
  "last_login_at": "2025-10-20T10:05:00Z"
}
```

### Test 6: Refresh Access Token

```bash
# Save refresh token from login response
REFRESH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{
    \"refresh_token\": \"$REFRESH_TOKEN\"
  }"
```

Expected response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900
}
```

### Test 7: Logout

```bash
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"refresh_token\": \"$REFRESH_TOKEN\"
  }"
```

Expected response:
```json
{
  "message": "Logged out successfully"
}
```

Verify session revoked in PostgreSQL:

```bash
docker exec -it fundrbolt_postgres psql -U fundrbolt_user -d fundrbolt_db -c \
  "SELECT refresh_token_jti, revoked_at FROM sessions ORDER BY created_at DESC LIMIT 1;"
```

Expected output:
```
 refresh_token_jti |         revoked_at
-------------------+----------------------------
 abc-123-xyz       | 2025-10-20 10:10:00.123456
```

---

## 6. Super Admin Test Flow

### Test 1: Login as Super Admin

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@fundrbolt.app",
    "password": "ChangeMe123!"
  }'
```

**Important**: Change super admin password immediately after first login!

### Test 2: Create NPO Admin User

```bash
ADMIN_TOKEN="<access-token-from-super-admin-login>"

curl -X POST http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "npo.admin@nonprofit.org",
    "password": "TempPass123",
    "first_name": "NPO",
    "last_name": "Administrator",
    "role": "npo_admin",
    "npo_id": "660e8400-e29b-41d4-a716-446655440000"
  }'
```

Expected response:
```json
{
  "id": "uuid-here",
  "email": "npo.admin@nonprofit.org",
  "first_name": "NPO",
  "last_name": "Administrator",
  "phone": null,
  "role": "npo_admin",
  "npo_id": "660e8400-e29b-41d4-a716-446655440000",
  "email_verified": false,
  "is_active": true,
  "created_at": "2025-10-20T11:00:00Z",
  "organization_name": null,
  "address_line1": null,
  "address_line2": null,
  "city": null,
  "state": null,
  "postal_code": null,
  "country": null
}
```

#### Create User with Organization and Address

Super Admin can create users with full organization details:

```bash
curl -X POST http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "director@foodbank.org",
    "password": "SecurePass789",
    "first_name": "Maria",
    "last_name": "Rodriguez",
    "phone": "+1-555-0200",
    "role": "npo_admin",
    "npo_id": "770e8400-e29b-41d4-a716-446655440000",
    "organization_name": "City Food Bank",
    "address_line1": "456 Oak Avenue",
    "city": "Seattle",
    "state": "WA",
    "postal_code": "98101",
    "country": "USA"
  }'
```

Expected response:
```json
{
  "id": "uuid-here",
  "email": "director@foodbank.org",
  "first_name": "Maria",
  "last_name": "Rodriguez",
  "phone": "+1-555-0200",
  "role": "npo_admin",
  "npo_id": "770e8400-e29b-41d4-a716-446655440000",
  "email_verified": false,
  "is_active": true,
  "created_at": "2025-10-20T11:00:00Z",
  "organization_name": "City Food Bank",
  "address_line1": "456 Oak Avenue",
  "address_line2": null,
  "city": "Seattle",
  "state": "WA",
  "postal_code": "98101",
  "country": "USA"
}
```

**Note**: `npo_id` assumes organizations table exists (Feature 002). All address fields are optional.

### Test 3: List All Users (Super Admin)

```bash
curl -X GET http://localhost:8000/api/v1/users?page=1&per_page=20 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Test 4: Manually Verify User Email

```bash
# Get user_id from list users response
USER_ID="550e8400-e29b-41d4-a716-446655440000"

curl -X POST http://localhost:8000/api/v1/users/$USER_ID/verify-email \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Expected response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john.doe@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "1234567890",
  "role": "donor",
  "npo_id": null,
  "email_verified": true,
  "is_active": false,
  "last_login_at": null,
  "created_at": "2025-10-20T10:00:00Z",
  "updated_at": "2025-10-24T14:15:00Z"
}
```

**Business Rules**:
- Super Admin can verify any user's email
- NPO Admin can only verify emails for users in their NPO
- Audit log entry created for verification action

---

## 7. Verify Redis Session Storage

### Check Active Sessions

```bash
# List all session keys
docker exec -it fundrbolt_redis redis-cli KEYS "session:*"
```

Expected output:
```
1) "session:550e8400-e29b-41d4-a716-446655440000:abc-123-xyz"
```

### Get Session Details

```bash
docker exec -it fundrbolt_redis redis-cli GET "session:550e8400-e29b-41d4-a716-446655440000:abc-123-xyz"
```

Expected output (JSON):
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "refresh_token_jti": "abc-123-xyz",
  "device": "curl/7.81.0",
  "ip": "127.0.0.1",
  "created_at": "2025-10-20T10:00:00Z"
}
```

### Check Token TTL

```bash
docker exec -it fundrbolt_redis redis-cli TTL "session:550e8400-e29b-41d4-a716-446655440000:abc-123-xyz"
```

Expected output: `604799` (seconds remaining out of 7 days = 604800 seconds)

---

## 8. Verify Audit Logs

### Check Login Audit Logs

```bash
docker exec -it fundrbolt_postgres psql -U fundrbolt_user -d fundrbolt_db -c \
  "SELECT user_id, action, ip_address, created_at FROM audit_logs WHERE action = 'login' ORDER BY created_at DESC LIMIT 5;"
```

Expected output:
```
              user_id               | action |  ip_address  |         created_at
------------------------------------+--------+--------------+----------------------------
 550e8400-e29b-41d4-a716-446655440000 | login  | 127.0.0.1    | 2025-10-20 10:00:00.123456
```

### Check Failed Login Attempts

```bash
docker exec -it fundrbolt_postgres psql -U fundrbolt_user -d fundrbolt_db -c \
  "SELECT action, metadata->>'email' as email, ip_address, created_at FROM audit_logs WHERE action = 'failed_login' ORDER BY created_at DESC LIMIT 5;"
```

---

## 9. Test Rate Limiting

### Trigger Rate Limit (Failed Logins)

Run this command 6 times with wrong password:

```bash
for i in {1..6}; do
  curl -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test.donor@example.com",
      "password": "WrongPassword"
    }'
  echo "\nAttempt $i"
done
```

6th attempt should return:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many failed login attempts. Please try again in 15 minutes."
  }
}
```

### Verify Rate Limit in Redis

```bash
docker exec -it fundrbolt_redis redis-cli KEYS "ratelimit:login:*"
```

Expected output:
```
1) "ratelimit:login:127.0.0.1"
```

Check sorted set:

```bash
docker exec -it fundrbolt_redis redis-cli ZRANGE "ratelimit:login:127.0.0.1" 0 -1 WITHSCORES
```

Expected output (5 timestamps within 15-minute window):
```
1) "1697799600123"
2) "1697799600123"
3) "1697799601456"
4) "1697799601456"
...
```

---

## 10. Run Tests

### Backend Unit Tests

```bash
cd backend
poetry run pytest tests/unit/auth/ -v
```

Expected output:
```
tests/unit/auth/test_jwt.py::test_create_access_token PASSED
tests/unit/auth/test_jwt.py::test_verify_access_token PASSED
tests/unit/auth/test_password.py::test_hash_password PASSED
tests/unit/auth/test_password.py::test_verify_password PASSED
...
===================== 15 passed in 2.34s ======================
```

### Backend Integration Tests

```bash
poetry run pytest tests/integration/auth/ -v
```

Expected output:
```
tests/integration/auth/test_register.py::test_register_user PASSED
tests/integration/auth/test_login.py::test_login_success PASSED
tests/integration/auth/test_email_verification.py::test_verify_email PASSED
...
===================== 20 passed in 8.12s ======================
```

### Frontend E2E Tests (Playwright)

```bash
cd frontend/fundrbolt-admin
pnpm test:e2e
```

Expected output:
```
Running 5 tests using 1 worker
  ✓  auth/login.spec.ts:3:1 › Login with valid credentials (2.1s)
  ✓  auth/login.spec.ts:15:1 › Login with invalid credentials (1.3s)
  ...
  5 passed (12.5s)
```

---

## 11. Troubleshooting

### PostgreSQL Connection Error

**Error**: `could not connect to server: Connection refused`

**Solution**:
```bash
# Check if PostgreSQL container is running
docker-compose ps

# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

### Redis Connection Error

**Error**: `Error connecting to Redis: Connection refused`

**Solution**:
```bash
# Check if Redis container is running
docker-compose ps

# Restart Redis
docker-compose restart redis

# Test Redis connection
docker exec -it fundrbolt_redis redis-cli ping
# Should return: PONG
```

### Migration Failed

**Error**: `alembic.util.exc.CommandError: Can't locate revision identified by 'xyz'`

**Solution**:
```bash
# Reset database (development only!)
docker-compose down -v
docker-compose up -d
alembic upgrade head
```

### JWT Token Invalid

**Error**: `{"error": {"code": "INVALID_TOKEN", "message": "Could not validate credentials"}}`

**Solution**:
- Check `JWT_SECRET_KEY` in `.env` matches between backend and token creation
- Verify access token hasn't expired (15-minute lifetime)
- Check clock synchronization between server and client

### Email Verification Token Not Found

**Error**: `{"error": {"code": "INVALID_VERIFICATION_TOKEN", "message": "Verification token is invalid or expired"}}`

**Solution**:
- Check Redis for token: `docker exec -it fundrbolt_redis redis-cli KEYS "email_verify:*"`
- Token expires after 24 hours (check TTL: `TTL email_verify:<hash>`)
- Request new token: `POST /auth/verify-email/resend`

---

## 12. Next Steps

1. **Change Super Admin Password**: Immediately change default super admin password in production!
2. **Configure Azure Communication Services**: Set up email service for production email delivery
3. **Implement Feature 002**: NPO Creation (organizations table required for full functionality)
4. **Implement Feature 003**: Event Creation (events table required for event_staff functionality)
5. **Run Security Audit**: Test OWASP Top 10 vulnerabilities
6. **Performance Testing**: Load test with 1000+ concurrent users
7. **Deploy to Staging**: Set up CI/CD pipeline and deploy to Azure App Service

---

## Summary

✅ **Infrastructure**: PostgreSQL + Redis running in Docker
✅ **Backend**: FastAPI server with authentication endpoints
✅ **Database**: Migrations applied, super admin seeded
✅ **Frontend**: Admin dashboard and donor PWA running
✅ **Tests**: Unit, integration, and E2E tests passing
✅ **Authentication Flow**: Registration → Email verification → Login → Protected endpoints

**Local URLs**:
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Admin Dashboard: http://localhost:5173
- Donor PWA: http://localhost:5174

---

**Version**: 1.0.0
**Date**: October 20, 2025
**Status**: Ready for development
