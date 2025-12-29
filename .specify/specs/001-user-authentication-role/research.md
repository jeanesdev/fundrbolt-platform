# Phase 0 Research: User Authentication & Role Management

**Feature**: 001-user-authentication-role
**Date**: October 20, 2025
**Status**: Complete

## Overview

This document captures the technical research and decisions made for implementing the authentication and role management system for the Fundrbolt platform. All decisions prioritize security, performance, and alignment with the constitution's principles.

---

## 1. JWT Token Management Strategy

### Decision: OAuth2 with JWT Access + Refresh Tokens

**Chosen Approach**:
- **Access tokens**: Short-lived (15 minutes), contains user claims (user_id, role, permissions)
- **Refresh tokens**: Long-lived (7 days), stored in Redis with user metadata
- **Storage**: Access token in memory (frontend state), refresh token in httpOnly cookie (future) or localStorage (MVP)
- **Rotation**: Refresh tokens are single-use and rotated on each refresh request

**Rationale**:
1. **Short access token expiry** minimizes damage if token is compromised
2. **Refresh tokens in Redis** enables instant revocation on logout/compromise
3. **JWT claims** reduce database lookups for permission checks (<100ms requirement)
4. **httpOnly cookies** (Phase 2) prevent XSS attacks, but localStorage acceptable for MVP with HTTPS

**Alternatives Considered**:
- ❌ **Session-only auth (no JWT)**: Would require database lookup on every request (violates <100ms performance goal)
- ❌ **Long-lived JWTs (1+ hour)**: Security risk if token leaked, hard to revoke
- ❌ **Opaque tokens**: Would need database lookup for every request, doesn't scale

**Implementation Details**:
```python
# JWT Claims Structure
{
  "sub": "user-uuid",           # Subject (user ID)
  "email": "user@example.com",
  "role": "npo_admin",
  "permissions": ["events:*:npo", "users:read:npo"],
  "scope": "npo:org-uuid",      # NPO/Event scoping
  "iat": 1697654400,            # Issued at
  "exp": 1697655300,            # Expires (15 min later)
  "jti": "token-uuid"           # JWT ID for blacklisting
}
```

**Libraries**:
- `python-jose[cryptography]` for JWT encoding/decoding (supports RS256 and HS256)
- Algorithm: **HS256** (symmetric) for MVP, RS256 (asymmetric) in Phase 2 for microservices

---

## 2. Password Security Standards

### Decision: Bcrypt with 12 Rounds

**Chosen Approach**:
- Hash algorithm: **bcrypt**
- Cost factor: **12 rounds** (default in passlib)
- Validation: Minimum 8 characters, at least 1 letter + 1 number (Pydantic regex)
- Salt: Automatically handled by bcrypt (unique per password)

**Rationale**:
1. **Bcrypt is battle-tested** and resistant to GPU/ASIC brute force attacks
2. **12 rounds** balances security with performance (~200-300ms hash time)
3. **Adaptive cost** allows increasing rounds as hardware improves
4. **Built-in salt** prevents rainbow table attacks

**Alternatives Considered**:
- ✅ **Argon2id**: More modern, winner of Password Hashing Competition, but bcrypt is "good enough" and more widely adopted (can migrate later if needed)
- ❌ **PBKDF2**: Older standard, less resistant to GPU attacks than bcrypt
- ❌ **SHA256/SHA512**: Fast hashing is a security vulnerability for passwords

**Password Reset Tokens**:
- Generate cryptographically random token (32 bytes, URL-safe base64)
- Store token hash in Redis with 1-hour TTL
- Invalidate token after successful password reset (single-use)

**Implementation**:
```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hash password
hashed = pwd_context.hash(plain_password)  # Auto-generates salt

# Verify password
is_valid = pwd_context.verify(plain_password, hashed)
```

---

## 3. Role-Based Access Control (RBAC) Architecture

### Decision: Flat Roles with Permission Scoping

**Chosen Approach**:
- **5 core roles**: Super Admin, NPO Admin, Event Coordinator, Staff, Donor (no role hierarchy)
- **Permission scoping**: platform, npo, event, own
- **Enforcement**: FastAPI dependency injection (`require_role`, `require_permission`)
- **Caching**: Role/permission checks cached in JWT claims (no DB lookup per request)

**Rationale**:
1. **Flat roles** are simpler than hierarchical (no "admin inherits from staff" complexity)
2. **Scope-based permissions** handle multi-tenancy (NPO-level, event-level isolation)
3. **JWT claims caching** ensures <100ms permission checks (constitution requirement)
4. **Explicit is better than implicit** (Zen of Python) - no permission inheritance surprises

**Alternatives Considered**:
- ❌ **Hierarchical roles** (e.g., admin > coordinator > staff): More complex, harder to reason about edge cases
- ❌ **Attribute-Based Access Control (ABAC)**: Too flexible/complex for MVP, overkill for 5 roles
- ❌ **Per-resource permissions** (e.g., user X can edit event Y): Over-engineered for Phase 1

**Permission Model**:
```python
# Example permissions
"events:create:npo"     # Create events within NPO scope
"events:read:platform"  # Read all events (super admin)
"bids:create:own"       # Create bids for self (donor)
"users:update:event"    # Update users within event scope
```

**Middleware Design**:
```python
# FastAPI dependency for role check
async def require_role(required_role: str):
    def dependency(current_user: User = Depends(get_current_user)):
        if current_user.role != required_role:
            raise HTTPException(403, "Insufficient permissions")
        return current_user
    return dependency

# Usage in endpoint
@router.post("/events")
async def create_event(
    user: User = Depends(require_role("event_coordinator"))
):
    ...
```

---

## 4. Session Management with Redis

### Decision: Hybrid Redis + PostgreSQL Session Storage

**Chosen Approach**:
- **Redis (hot data)**: Active refresh tokens, JWT blacklist, session lookups
  - Key: `session:{user_id}:{jti}` → Full session JSON with device/IP/metadata
  - TTL: 7 days (auto-cleanup on expiry)
- **PostgreSQL (audit trail)**: Immutable session history for compliance
  - Write session record on login (id, user_id, refresh_token_jti, device, IP, created_at)
  - Never delete from PostgreSQL (keep for audit, even after Redis expiry)
- **Blacklist**: JWT ID (jti) blacklist for revoked access tokens, key: `blacklist:{jti}`, TTL: 15 min (access token expiry)
- **Multi-device support**: One user can have multiple active sessions (different JTIs)

**Data Split**:
- **Redis only**: Refresh token validation, active session checks, JWT blacklist (hot path)
- **PostgreSQL only**: Historical session data, security audit queries, compliance reporting
- **Both**: Initial session creation writes to both, logout deletes from Redis only

**Rationale**:
1. **Redis for speed** - <1ms lookups for token validation (performance requirement)
2. **PostgreSQL for compliance** - Immutable audit trail for "who logged in when" investigations
3. **Redis TTL** automatically cleans up expired sessions (no cron jobs needed)
4. **Graceful degradation** - If Redis is down, block new logins but allow existing access tokens to work until expiry (15 min)

**Redis Down Scenario**:
- Cannot issue new refresh tokens (login/refresh blocked)
- Existing access tokens work until expiry (15 min grace period)
- Alert triggers, auto-restart Redis, users re-login
- PostgreSQL audit trail preserved

**Alternatives Considered**:
- ❌ **PostgreSQL only**: Too slow for high-frequency checks (violates <100ms goal)
- ❌ **Redis only (no persistence)**: Lose audit trail, violates compliance requirements
- ❌ **JWT blacklist in PostgreSQL**: Slow, can't expire automatically

**Redis Schema**:
```redis
# Active session (refresh token)
SET session:user-123:token-abc {
  "user_id": "user-123",
  "refresh_token_jti": "token-abc",
  "device": "Chrome on Windows",
  "ip": "192.168.1.1",
  "created_at": "2025-10-20T10:00:00Z"
} EX 604800  # 7 days

# Blacklisted access token (logout)
SET blacklist:token-xyz 1 EX 900  # 15 minutes
```

**Connection Pooling**:
- Use `redis-py` with connection pool (max 50 connections)
- Automatic reconnect on connection failure

---

## 5. Multi-Tenant Data Isolation Strategy

### Decision: PostgreSQL Row-Level Security (RLS) + JWT Scope Claims

**Chosen Approach** (UPDATED for Security):
- **NPO-scoped roles** (NPO Admin, Event Coordinator): JWT contains `scope: "npo:<org_id>"`
- **Event-scoped roles** (Staff): JWT contains `scope: "event:<event_id>"`
- **PostgreSQL RLS policies**: Enable RLS on tenant-scoped tables (events, auctions, items, etc.)
- **Session context**: Set `current_setting('app.current_org_id')` at session start
- **Automatic filtering**: RLS policies enforce `org_id = current_setting('app.current_org_id')::uuid`

**Rationale**:
1. **Defense-in-depth**: Even if developer forgets `WHERE org_id = ...`, RLS prevents data leaks
2. **Fail-secure**: RLS denies access by default unless explicitly allowed
3. **JWT scope claims** still used for fast permission checks (avoid DB lookup)
4. **Low complexity**: SQLAlchemy middleware sets session variable once per request
5. **Constitution compliance**: "Data Security and Privacy" principle requires treating data as if under regulatory scrutiny

**Alternatives Considered**:
- ❌ **Separate database per tenant**: Over-engineered for <100 NPOs (MVP), high operational overhead
- ❌ **Application-level filtering only**: **UNSAFE** - High risk of developer mistakes leaking data across tenants
- ✅ **PostgreSQL Row-Level Security (RLS)**: **Phase 1 requirement** (was incorrectly deferred to Phase 2)

**Implementation Pattern**:

**Step 1: Enable RLS on tenant-scoped tables**
```sql
-- Enable RLS on tables with org_id
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Policy: Allow access only to rows matching session org_id
CREATE POLICY tenant_isolation_policy ON events
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON auctions
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON items
  USING (
    org_id = current_setting('app.current_org_id', true)::uuid
    OR auction_id IN (
      SELECT id FROM auctions WHERE org_id = current_setting('app.current_org_id', true)::uuid
    )
  );

-- Super admin bypass (platform-wide access)
CREATE POLICY superadmin_bypass ON events
  USING (current_setting('app.user_role', true) = 'super_admin');
```

**Step 2: SQLAlchemy middleware sets session variable**
```python
from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "connect")
def set_session_context(dbapi_conn, connection_record):
    """Set session variables from JWT claims on each connection"""
    cursor = dbapi_conn.cursor()

    # Get current user from request context (set by auth middleware)
    user = get_current_user_from_context()

    if user:
        # Set org_id for RLS policies
        if user.role_scope == "npo":
            cursor.execute(f"SET app.current_org_id = '{user.scope_id}'")

        # Set role for bypass policies
        cursor.execute(f"SET app.user_role = '{user.role}'")

    cursor.close()

# Simpler approach: Set per-request instead of per-connection
async def set_rls_context(user: User, db: Session):
    """Call this in FastAPI dependency after auth"""
    if user.role_scope == "npo":
        db.execute(f"SET LOCAL app.current_org_id = '{user.scope_id}'")
    db.execute(f"SET LOCAL app.user_role = '{user.role}'")
```

**Step 3: Use in FastAPI endpoints**
```python
@router.get("/events")
async def list_events(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Set RLS context
    await set_rls_context(user, db)

    # Query events - RLS automatically filters by org_id
    events = db.query(Event).all()  # Safe! RLS enforces tenant isolation
    return events
```

**Benefits**:
- ✅ **Impossible to leak data** across tenants (even with buggy queries)
- ✅ **No manual `WHERE org_id = ...` needed** (RLS does it automatically)
- ✅ **Fail-secure by default** (RLS denies unless policy allows)
- ✅ **Low overhead** (~5ms per request to set session variables)

**Tradeoffs**:
- ⚠️ Adds one Alembic migration for RLS policies
- ⚠️ Requires testing RLS policies (but that's good security practice!)
- ⚠️ Super admin queries need explicit bypass policy

---

## 6. Rate Limiting for Brute Force Prevention

### Decision: Redis-based Sliding Window Rate Limiter

**Chosen Approach**:
- **Algorithm**: Sliding window counter (more accurate than fixed window)
- **Limits**: 5 failed login attempts per 15 minutes per IP address
- **Storage**: Redis sorted sets, key: `ratelimit:login:{ip_address}`
- **Response**: HTTP 429 with `Retry-After` header
- **Bypass**: Super admins can bypass (for internal testing)

**Rationale**:
1. **Sliding window** prevents burst attacks at window boundaries
2. **Redis sorted sets** efficiently track timestamps and prune old attempts
3. **Per-IP limiting** balances security with usability (shared office IPs)
4. **15-minute window** long enough to deter attackers, short enough to unlock legitimate users

**Alternatives Considered**:
- ❌ **Fixed window**: Attackers can exploit window boundaries (10 attempts at 14:59, 10 more at 15:01)
- ❌ **Token bucket**: More complex, overkill for simple login rate limiting
- ❌ **Per-user limiting**: Doesn't protect against username enumeration attacks
- ✅ **CAPTCHA** (Phase 2): Add after 3 failed attempts for better UX

**Implementation**:
```python
import time
from redis import Redis

async def check_rate_limit(ip: str, redis: Redis) -> bool:
    key = f"ratelimit:login:{ip}"
    now = time.time()
    window_start = now - 900  # 15 minutes ago

    # Remove old attempts
    redis.zremrangebyscore(key, 0, window_start)

    # Count recent attempts
    attempt_count = redis.zcard(key)
    if attempt_count >= 5:
        return False  # Rate limited

    # Record this attempt
    redis.zadd(key, {str(now): now})
    redis.expire(key, 900)  # Auto-cleanup
    return True
```

---

## 7. Password Reset Flow Design

### Decision: Email-based Reset with Signed Tokens

**Chosen Approach**:
1. User requests reset → backend generates random token (32 bytes)
2. Backend stores token hash in Redis with 1-hour TTL, key: `password_reset:{token_hash}`
3. Backend sends email with reset link: `https://app.fundrbolt.com/reset-password?token={token}`
4. User clicks link → frontend displays form
5. User submits new password + token → backend validates token, updates password, invalidates all sessions
6. Token is deleted from Redis after successful reset (single-use)

**Rationale**:
1. **Hashed token in Redis** prevents token leakage if Redis is compromised
2. **1-hour expiry** balances security with user convenience
3. **Single-use tokens** prevent replay attacks
4. **Email verification implicit** (must access email account to get token)

**Alternatives Considered**:
- ❌ **Magic links (passwordless)**: More complex, requires session management in email link
- ❌ **Security questions**: Weak security, easy to guess or social-engineer
- ❌ **SMS-based reset**: Adds Twilio dependency, costs money, SIM-swap attacks

**Email Service**:
- MVP: Azure Communication Services (Email) or SendGrid (transactional email)
- Template: HTML email with branded reset button
- Fallback: Log reset link to console in dev environment (no email service needed)

**Security Considerations**:
- Always return "Email sent" even if email doesn't exist (prevent email enumeration)
- Log all password reset requests for auditing
- Invalidate all active sessions after password change (force re-login)

---

## 8. Audit Logging Strategy

### Decision: Immutable PostgreSQL Table + Structured JSON

**Chosen Approach**:
- **Table**: `audit_logs` with columns: id, user_id, action, resource_type, resource_id, ip_address, user_agent, metadata (JSONB), created_at
- **Logged events**: login, logout, failed_login, password_reset, role_change, session_revoked
- **Middleware**: FastAPI middleware auto-logs all auth events
- **Retention**: 90 days in hot storage, archive to Azure Blob after 90 days

**Rationale**:
1. **Immutable logs** (no UPDATE/DELETE) prevent tampering
2. **JSONB metadata** allows flexible event-specific data without schema changes
3. **Indexed timestamps** enable fast time-range queries for incident response
4. **Automatic logging** reduces developer mistakes (no manual log calls)

**Alternatives Considered**:
- ❌ **Log files only**: Hard to query, no structured data
- ❌ **External SIEM** (Splunk, Datadog): Too expensive for MVP, add in Phase 2
- ✅ **PostgreSQL + Azure Monitor**: Good balance for MVP, can integrate SIEM later

**Log Format**:
```json
{
  "id": "log-uuid",
  "user_id": "user-123",
  "action": "login",
  "resource_type": null,
  "resource_id": null,
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "metadata": {
    "success": true,
    "device": "Chrome on Windows",
    "login_method": "email_password"
  },
  "created_at": "2025-10-20T10:00:00Z"
}
```

---

## 9. Frontend Token Storage & Refresh

### Decision: localStorage + Axios Interceptor for Auto-Refresh

**Chosen Approach**:
- **Access token**: Store in Zustand global state (memory)
- **Refresh token**: Store in localStorage (httpOnly cookies in Phase 2)
- **Auto-refresh**: Axios response interceptor catches 401, refreshes token, retries original request
- **Logout**: Clear localStorage + Zustand state + call backend logout endpoint

**Rationale**:
1. **Memory storage for access token** minimizes XSS risk (token lost on page refresh, but auto-refreshed)
2. **localStorage for refresh token** persists across page reloads (acceptable with HTTPS + CSP)
3. **Axios interceptor** provides seamless UX (user never sees 401 errors)
4. **Backend logout** ensures tokens are revoked server-side (delete from Redis)

**Alternatives Considered**:
- ✅ **httpOnly cookies** (Phase 2): More secure (immune to XSS), but requires CORS config and backend cookie handling
- ❌ **sessionStorage**: Lost on tab close, poor UX for donors opening multiple tabs
- ❌ **IndexedDB**: Over-engineered for simple token storage

**Implementation**:
```typescript
// Axios interceptor
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      const { data } = await axios.post('/api/v1/auth/refresh', { refresh_token: refreshToken });
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      error.config.headers.Authorization = `Bearer ${data.access_token}`;
      return axios(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

## 10. Testing Strategy for Authentication

### Decision: Pyramid Testing with Specialized Auth Tests

**Test Levels**:
1. **Unit tests** (500+ tests, 80%+ coverage):
   - Password hashing/verification
   - JWT generation/validation
   - Permission checking logic
   - Rate limit algorithms

2. **Integration tests** (50-100 tests):
   - Full API endpoint flows (register → login → refresh → logout)
   - Role assignment and permission enforcement
   - Redis session management
   - Audit log creation

3. **E2E tests** (10-15 tests):
   - User registration → email → login → protected page
   - Password reset flow end-to-end
   - Multi-device login (same user, different browsers)
   - Admin role assignment workflow

4. **Security tests** (20+ tests):
   - Rate limiting enforcement (5 attempts → 429 error)
   - JWT expiry and refresh
   - Token revocation on logout
   - Permission bypass attempts (try accessing admin endpoints as donor)
   - SQL injection in login form
   - XSS in user profile fields

**Test Data**:
- Use `factory_boy` for consistent user/role fixtures
- Separate test database (Docker PostgreSQL)
- In-memory Redis for unit tests, real Redis for integration tests

**Performance Tests** (Phase 2):
- Locust load test: 1000 concurrent login requests (target <2s p95)
- JWT validation benchmarks (target <100ms p99)

---

## 11. Email Verification for New Users

### Decision: Required Email Verification Before Login (Phase 1)

**Chosen Approach**:
1. User registers → account created with `email_verified = false`, `is_active = false`
2. Backend generates email verification token (32 bytes, URL-safe base64)
3. Backend stores token hash in Redis with 24-hour TTL, key: `email_verify:{token_hash}`
4. Backend sends email with verification link: `https://app.fundrbolt.com/verify-email?token={token}`
5. User clicks link → backend validates token, sets `email_verified = true`, `is_active = true`
6. User can now login with verified email
7. Token is deleted from Redis after successful verification (single-use)

**Rationale**:
1. **Prevents spam/bot registrations** - Requires valid email access
2. **Verifies contact method** - Ensures we can send password resets and notifications
3. **24-hour expiry** - Balance between user convenience and security
4. **Single-use tokens** - Prevent replay attacks
5. **Phase 1 requirement** - Authentication spec requires secure account creation

**Login Flow Changes**:
- Login attempt with unverified email → Return 403 "Please verify your email address"
- Provide "Resend verification email" option on login page
- Verification email template matches brand (same as password reset)

**Edge Cases**:
- **Expired verification token**: User can request new verification email (re-send)
- **Lost verification email**: Provide "Resend" button on login page
- **Email typo during registration**: User must contact support (no self-service email change before verification)
- **Multiple verification attempts**: Allow unlimited resends with 1-minute rate limit per email

**Alternatives Considered**:
- ❌ **No email verification (Phase 2)**: Allows spam accounts, violates security best practices
- ❌ **Email verification optional**: Defeats the purpose, users skip it
- ✅ **Required verification**: Industry standard, prevents abuse

**Implementation**:
```python
# Registration endpoint
@router.post("/auth/register")
async def register(data: UserCreate, db: Session):
    # Create user with email_verified=False, is_active=False
    user = User(email=data.email, email_verified=False, is_active=False, ...)
    db.add(user)
    db.commit()

    # Generate verification token
    token = generate_verification_token()
    token_hash = hash_token(token)
    redis.setex(f"email_verify:{token_hash}", 86400, user.id)  # 24 hours

    # Send verification email
    send_verification_email(user.email, token)

    return {"message": "Registration successful. Please check your email to verify your account."}

# Verification endpoint
@router.post("/auth/verify-email")
async def verify_email(token: str, db: Session):
    token_hash = hash_token(token)
    user_id = redis.get(f"email_verify:{token_hash}")

    if not user_id:
        raise HTTPException(400, "Invalid or expired verification token")

    user = db.query(User).filter(User.id == user_id).first()
    user.email_verified = True
    user.is_active = True
    db.commit()

    redis.delete(f"email_verify:{token_hash}")  # Single-use

    return {"message": "Email verified successfully. You can now log in."}

# Login check
@router.post("/auth/login")
async def login(data: LoginRequest, db: Session):
    user = authenticate_user(data.email, data.password)

    if not user.email_verified:
        raise HTTPException(403, "Please verify your email address before logging in")

    # ... proceed with JWT generation
```

---

## 12. Super Admin Bootstrap Process

### Decision: Manual Seed Script with Environment Variable Override

**Chosen Approach**:
1. **Development**: Alembic seed migration creates default super admin
   - Email: From `SUPERADMIN_EMAIL` env var (default: `admin@fundrbolt.local`)
   - Password: From `SUPERADMIN_PASSWORD` env var (default: `ChangeMe123!`)
   - Auto-verified: `email_verified = true`, `is_active = true`
2. **Production**: Manual script run by DevOps during initial deployment
   - Requires explicit environment variables (no defaults)
   - Script fails if super admin already exists (idempotent)
3. **Security**: Super admin password must be changed on first login (force password reset)

**Rationale**:
1. **Chicken-and-egg problem**: Need one user to create other users
2. **Seed script**: Ensures consistent dev environment setup
3. **Production safety**: Requires explicit configuration, no weak defaults
4. **Auditability**: Super admin creation logged in audit_logs table

**Implementation**:
```python
# Alembic seed migration: versions/002_seed_superadmin.py
from alembic import op
import sqlalchemy as sa
from passlib.context import CryptContext
import os
from datetime import datetime
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def upgrade():
    # Get from environment or use dev defaults
    email = os.getenv("SUPERADMIN_EMAIL", "admin@fundrbolt.local")
    password = os.getenv("SUPERADMIN_PASSWORD", "ChangeMe123!")

    # Get super_admin role ID (created in previous migration)
    conn = op.get_bind()
    role = conn.execute(
        sa.text("SELECT id FROM roles WHERE name = 'super_admin'")
    ).fetchone()

    # Check if super admin already exists
    existing = conn.execute(
        sa.text("SELECT id FROM users WHERE role_id = :role_id LIMIT 1"),
        {"role_id": role[0]}
    ).fetchone()

    if existing:
        print("Super admin already exists, skipping...")
        return

    # Create super admin
    user_id = uuid.uuid4()
    conn.execute(
        sa.text("""
            INSERT INTO users (id, email, password_hash, first_name, last_name,
                               role_id, email_verified, is_active, created_at, updated_at)
            VALUES (:id, :email, :password_hash, :first_name, :last_name,
                    :role_id, true, true, :now, :now)
        """),
        {
            "id": user_id,
            "email": email,
            "password_hash": pwd_context.hash(password),
            "first_name": "Super",
            "last_name": "Admin",
            "role_id": role[0],
            "now": datetime.utcnow()
        }
    )

    print(f"✅ Super admin created: {email}")
    print(f"⚠️  CHANGE PASSWORD ON FIRST LOGIN")

def downgrade():
    # Don't delete super admin on rollback (safety)
    pass
```

**Production Deployment**:
```bash
# Set environment variables
export SUPERADMIN_EMAIL="admin@fundrboltplatform.com"
export SUPERADMIN_PASSWORD="$(openssl rand -base64 32)"

# Run migrations (includes seed)
poetry run alembic upgrade head

# Log password securely
echo "Super admin password: $SUPERADMIN_PASSWORD" >> /secure/credentials.txt
```

**Alternatives Considered**:
- ❌ **Hard-coded credentials**: Security vulnerability
- ❌ **No default super admin**: Blocks development workflow
- ✅ **Environment variable with secure defaults**: Best practice

---

## 13. Event-Scoped Role Assignment (Staff & Event Coordinators)

### Decision: Automatic NPO Admin → Event Coordinator, Manual Staff Assignment

**Chosen Approach**:

**NPO Admin → Event Coordinator (Automatic)**:
- Any user with `npo_admin` role automatically has event coordinator access to all events in their NPO(s)
- No separate `event_coordinators` join table needed
- JWT scope: `scope: "npo:<npo_id>"` grants access to all events under that NPO
- RLS policies: `events.npo_id = current_setting('app.current_org_id')::uuid`

**Staff → Events (Manual Assignment)**:
- Staff users assigned to specific events via `event_staff` join table
- One staff member can be assigned to multiple events (many-to-many)
- NPO Admin can add/remove staff from events within their NPO
- JWT scope: `scope: "event:<event_id>,<event_id>"` (comma-separated list)

**Data Model**:
```sql
-- User table (simplified)
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    role_id UUID REFERENCES roles(id),  -- References: donor, staff, event_coordinator, npo_admin, super_admin
    npo_id UUID REFERENCES organizations(id) NULL,  -- Only for npo_admin role
    ...
);

-- Event staff assignments (many-to-many)
CREATE TABLE event_staff (
    id UUID PRIMARY KEY,
    event_id UUID REFERENCES events(id) NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    assigned_at TIMESTAMP DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id) NOT NULL,  -- NPO Admin who assigned them
    UNIQUE(event_id, user_id)  -- One assignment per user per event
);
```

**Permission Logic**:
```python
# Get user's accessible events
async def get_user_event_access(user: User, db: Session) -> list[UUID]:
    """Returns list of event IDs user can access"""

    if user.role == "super_admin":
        # Super admin: all events
        return db.query(Event.id).all()

    elif user.role == "npo_admin":
        # NPO Admin: all events in their NPO(s)
        return db.query(Event.id).filter(Event.npo_id == user.npo_id).all()

    elif user.role == "event_coordinator":
        # Event Coordinator: all events in their NPO(s)
        return db.query(Event.id).filter(Event.npo_id == user.npo_id).all()

    elif user.role == "staff":
        # Staff: only assigned events
        return (
            db.query(Event.id)
            .join(EventStaff)
            .filter(EventStaff.user_id == user.id)
            .all()
        )

    else:
        # Donor: no event management access
        return []

# NPO Admin assigns staff to event
@router.post("/events/{event_id}/staff")
async def assign_staff_to_event(
    event_id: UUID,
    staff_user_id: UUID,
    current_user: User = Depends(require_role("npo_admin")),
    db: Session = Depends(get_db)
):
    # Verify event belongs to NPO Admin's organization
    event = db.query(Event).filter(Event.id == event_id).first()
    if event.npo_id != current_user.npo_id:
        raise HTTPException(403, "Cannot assign staff to events outside your organization")

    # Verify target user is staff role
    staff_user = db.query(User).filter(User.id == staff_user_id).first()
    if staff_user.role != "staff":
        raise HTTPException(400, "Can only assign users with staff role")

    # Create assignment
    assignment = EventStaff(
        event_id=event_id,
        user_id=staff_user_id,
        assigned_by=current_user.id
    )
    db.add(assignment)
    db.commit()

    return {"message": f"Staff {staff_user.email} assigned to event {event.name}"}

# NPO Admin removes staff from event
@router.delete("/events/{event_id}/staff/{staff_user_id}")
async def remove_staff_from_event(
    event_id: UUID,
    staff_user_id: UUID,
    current_user: User = Depends(require_role("npo_admin")),
    db: Session = Depends(get_db)
):
    # Verify event belongs to NPO Admin's organization
    event = db.query(Event).filter(Event.id == event_id).first()
    if event.npo_id != current_user.npo_id:
        raise HTTPException(403, "Cannot manage staff for events outside your organization")

    # Delete assignment
    db.query(EventStaff).filter(
        EventStaff.event_id == event_id,
        EventStaff.user_id == staff_user_id
    ).delete()
    db.commit()

    return {"message": "Staff removed from event"}
```

**Rationale**:
1. **Automatic NPO Admin access** - Simplifies permission model, NPO admins manage entire organization
2. **Granular staff assignment** - Event staff only see events they're working, reduces clutter
3. **Many-to-many staff** - Staff can work multiple events (common for event contractors)
4. **Audit trail** - `assigned_by` tracks who granted access (compliance)

**Alternatives Considered**:
- ❌ **Manual event coordinator assignment**: Too much overhead, NPO admins already trusted
- ❌ **Staff can self-assign**: Security risk, need NPO admin approval
- ✅ **Automatic + manual hybrid**: Best balance of convenience and control

---

## Summary

All technical decisions are finalized and align with the constitution's principles:

✅ **Security-first**: Bcrypt, short JWT expiry, rate limiting, audit logging, **email verification required**
✅ **Performance**: Redis caching, JWT claims, <100ms auth checks, <2s login
✅ **YAGNI**: No over-engineering (no MFA, no SSO, no ABAC—only what's specified)
✅ **Production-ready**: Comprehensive testing, structured logging, graceful error handling, **PostgreSQL RLS for tenant isolation**
✅ **Solo developer efficiency**: Managed services (Redis, Postgres), battle-tested libraries

**Key Clarifications Added**:
1. **Session storage**: Hybrid Redis (hot data) + PostgreSQL (audit trail)
2. **Email verification**: Required for new users before login (Phase 1)
3. **Super admin bootstrap**: Alembic seed migration with environment variables
4. **Event access**: NPO Admins auto-granted to all events, Staff manually assigned
5. **Staff assignment**: Many-to-many via `event_staff` table, NPO Admin can add/remove

**Next Phase**: Proceed to Phase 1 (Design) to create `data-model.md`, `contracts/`, and `quickstart.md`.

---

**Version**: 1.1.0
**Completed**: October 20, 2025
**Reviewed By**: AI Agent (Constitution-compliant)

**Changelog**:
- v1.1.0 (2025-10-20): Added email verification (§11), super admin bootstrap (§12), event-scoped roles (§13), clarified session storage hybrid approach (§4)
- v1.0.0 (2025-10-20): Initial research document with 10 core technical decisions
