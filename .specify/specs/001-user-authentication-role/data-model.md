# Data Model: User Authentication & Role Management

**Feature**: 001-user-authentication-role
**Date**: October 20, 2025
**Status**: Phase 1 Design

## Overview

This document defines the complete database schema for the authentication and role management system. All models use UUIDs for primary keys, include timestamp tracking, and are designed for PostgreSQL with Row-Level Security (RLS) enabled on multi-tenant tables.

---

## Entity Relationship Diagram

```
┌─────────────┐
│    Role     │
│  (5 types)  │
└──────┬──────┘
       │
       │ 1:N
       │
┌──────▼──────────────────┐
│        User             │
│  - email_verified       │
│  - is_active            │
│  - npo_id (nullable)    │
└──┬────────┬─────────┬───┘
   │        │         │
   │        │         │ N:M (via event_staff)
   │        │         │
   │ 1:N    │ 1:N     ▼
   │        │    ┌────────────┐
   │        │    │   Event    │
   │        │    │ (RLS: npo) │
   │        │    └────────────┘
   │        │
   ▼        ▼
┌─────┐  ┌──────────┐
│Sess.│  │AuditLog  │
│(Rds)│  │(immut.)  │
└─────┘  └──────────┘
```

---

## Core Entities

### 1. User

**Purpose**: Represents any person using the platform (donor, staff, coordinator, NPO admin, super admin)

**Table**: `users`

```sql
CREATE TABLE users (
    -- Identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    -- Profile
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NULL,
    organization_name VARCHAR(255) NULL,
    organization_address TEXT NULL,

    -- Authentication
    email_verified BOOLEAN NOT NULL DEFAULT false,  -- Can be manually verified by super_admin or npo_admin
    is_active BOOLEAN NOT NULL DEFAULT false,

    -- Role & Scope
    role_id UUID NOT NULL REFERENCES roles(id),
    npo_id UUID NULL REFERENCES organizations(id),  -- Only for npo_admin, event_coordinator roles

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP NULL,

    -- Constraints
    CONSTRAINT email_lowercase CHECK (email = LOWER(email)),
    CONSTRAINT password_not_empty CHECK (LENGTH(password_hash) > 0),
    CONSTRAINT npo_id_required_for_npo_roles CHECK (
        (role_id IN (SELECT id FROM roles WHERE name IN ('npo_admin', 'event_coordinator')) AND npo_id IS NOT NULL)
        OR (role_id IN (SELECT id FROM roles WHERE name NOT IN ('npo_admin', 'event_coordinator')))
    )
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_npo_id ON users(npo_id) WHERE npo_id IS NOT NULL;
CREATE INDEX idx_users_email_verified ON users(email_verified) WHERE email_verified = false;
CREATE INDEX idx_users_created_at ON users(created_at DESC);
```

**Business Rules**:
- Email must be unique (case-insensitive)
- Email must be verified before login (`email_verified = true` AND `is_active = true`)
- Email can be manually verified by super_admin (any user) or npo_admin (users in their NPO only)
- Password must be hashed with bcrypt (12+ rounds)
- NPO Admin and Event Coordinator roles MUST have `npo_id` set
- Staff and Donor roles MUST NOT have `npo_id` (use event_staff for staff assignments)
- Default role on registration: "donor"
- Phone numbers are stored as raw digits (no formatting characters) for consistency
- Organization name and address are optional fields for users who wish to provide business/organization information

**SQLAlchemy Model**:
```python
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from passlib.context import CryptContext
import uuid
from datetime import datetime

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    organization_name = Column(String(255), nullable=True)
    organization_address = Column(String, nullable=True)
    email_verified = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    npo_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)

    # Relationships
    role = relationship("Role", back_populates="users")
    npo = relationship("Organization", back_populates="users")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
    event_assignments = relationship("EventStaff", back_populates="user", cascade="all, delete-orphan")

    # Check constraints
    __table_args__ = (
        CheckConstraint("email = LOWER(email)", name="email_lowercase"),
        CheckConstraint("LENGTH(password_hash) > 0", name="password_not_empty"),
    )

    def set_password(self, plain_password: str):
        self.password_hash = pwd_context.hash(plain_password)

    def verify_password(self, plain_password: str) -> bool:
        return pwd_context.verify(plain_password, self.password_hash)

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
```

---

### 2. Role

**Purpose**: Defines the five core role types with their scope and description

**Table**: `roles`

```sql
CREATE TABLE roles (
    -- Identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    scope VARCHAR(20) NOT NULL,  -- 'platform', 'npo', 'event', 'own'

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT role_name_valid CHECK (name IN ('super_admin', 'npo_admin', 'event_coordinator', 'staff', 'donor')),
    CONSTRAINT role_scope_valid CHECK (scope IN ('platform', 'npo', 'event', 'own'))
);

-- Indexes
CREATE UNIQUE INDEX idx_roles_name ON roles(name);
```

**Seed Data** (created in migration):
```sql
INSERT INTO roles (id, name, description, scope) VALUES
    (gen_random_uuid(), 'super_admin', 'Augeo platform staff with full access to all NPOs and events', 'platform'),
    (gen_random_uuid(), 'npo_admin', 'Full management access within assigned nonprofit organization(s)', 'npo'),
    (gen_random_uuid(), 'event_coordinator', 'Event and auction management within assigned NPO', 'npo'),
    (gen_random_uuid(), 'staff', 'Donor registration and check-in within assigned events', 'event'),
    (gen_random_uuid(), 'donor', 'Bidding and profile management only', 'own');
```

**SQLAlchemy Model**:
```python
class Role(Base):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(String, nullable=False)
    scope = Column(String(20), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="role")
    permissions = relationship("Permission", back_populates="role", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "name IN ('super_admin', 'npo_admin', 'event_coordinator', 'staff', 'donor')",
            name="role_name_valid"
        ),
        CheckConstraint(
            "scope IN ('platform', 'npo', 'event', 'own')",
            name="role_scope_valid"
        ),
    )
```

---

### 3. Permission

**Purpose**: Defines specific actions allowed for each role (resource:action:scope format)

**Table**: `permissions`

```sql
CREATE TABLE permissions (
    -- Identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,

    -- Permission Definition
    resource VARCHAR(50) NOT NULL,  -- 'users', 'events', 'auctions', 'bids', 'profile', '*'
    action VARCHAR(20) NOT NULL,    -- 'create', 'read', 'update', 'delete', '*'
    scope VARCHAR(20) NOT NULL,     -- 'platform', 'npo', 'event', 'own'

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT permission_unique UNIQUE(role_id, resource, action, scope)
);

-- Indexes
CREATE INDEX idx_permissions_role_id ON permissions(role_id);
```

**Seed Data Examples**:
```sql
-- Super Admin: Full access to everything
INSERT INTO permissions (role_id, resource, action, scope) VALUES
    ((SELECT id FROM roles WHERE name = 'super_admin'), '*', '*', 'platform');

-- NPO Admin: Full access within NPO scope
INSERT INTO permissions (role_id, resource, action, scope) VALUES
    ((SELECT id FROM roles WHERE name = 'npo_admin'), 'events', '*', 'npo'),
    ((SELECT id FROM roles WHERE name = 'npo_admin'), 'users', '*', 'npo'),
    ((SELECT id FROM roles WHERE name = 'npo_admin'), 'auctions', '*', 'npo');

-- Event Coordinator: Event and auction management
INSERT INTO permissions (role_id, resource, action, scope) VALUES
    ((SELECT id FROM roles WHERE name = 'event_coordinator'), 'events', '*', 'npo'),
    ((SELECT id FROM roles WHERE name = 'event_coordinator'), 'auctions', '*', 'npo'),
    ((SELECT id FROM roles WHERE name = 'event_coordinator'), 'items', '*', 'npo');

-- Staff: Donor registration and check-in
INSERT INTO permissions (role_id, resource, action, scope) VALUES
    ((SELECT id FROM roles WHERE name = 'staff'), 'donors', 'read', 'event'),
    ((SELECT id FROM roles WHERE name = 'staff'), 'donors', 'create', 'event'),
    ((SELECT id FROM roles WHERE name = 'staff'), 'paddles', '*', 'event');

-- Donor: Bidding and own profile
INSERT INTO permissions (role_id, resource, action, scope) VALUES
    ((SELECT id FROM roles WHERE name = 'donor'), 'bids', 'create', 'own'),
    ((SELECT id FROM roles WHERE name = 'donor'), 'profile', '*', 'own');
```

**SQLAlchemy Model**:
```python
class Permission(Base):
    __tablename__ = "permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    resource = Column(String(50), nullable=False)
    action = Column(String(20), nullable=False)
    scope = Column(String(20), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    role = relationship("Role", back_populates="permissions")

    __table_args__ = (
        UniqueConstraint("role_id", "resource", "action", "scope", name="permission_unique"),
    )
```

---

### 4. Session (PostgreSQL Metadata)

**Purpose**: Immutable audit trail of user sessions for compliance and security investigations

**Table**: `sessions`

**Note**: Active session validation uses Redis. This table is write-only for audit purposes.

```sql
CREATE TABLE sessions (
    -- Identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Session Details
    refresh_token_jti VARCHAR(255) NOT NULL UNIQUE,  -- JWT ID for Redis lookup
    device_info VARCHAR(500) NULL,
    ip_address VARCHAR(45) NOT NULL,  -- IPv6 max length
    user_agent TEXT NULL,

    -- Lifecycle
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,  -- 7 days from created_at
    revoked_at TIMESTAMP NULL,

    -- Constraints
    CONSTRAINT expires_after_creation CHECK (expires_at > created_at)
);

-- Indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_jti ON sessions(refresh_token_jti);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX idx_sessions_active ON sessions(user_id, revoked_at) WHERE revoked_at IS NULL;
```

**Business Rules**:
- Immutable: No UPDATE or DELETE operations (only INSERT and soft revoke via `revoked_at`)
- Redis is source of truth for active sessions (this is audit trail only)
- `expires_at` set to 7 days from `created_at`
- Logout sets `revoked_at` but doesn't delete record

**SQLAlchemy Model**:
```python
class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    refresh_token_jti = Column(String(255), unique=True, nullable=False)
    device_info = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=False)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="sessions")

    __table_args__ = (
        CheckConstraint("expires_at > created_at", name="expires_after_creation"),
    )
```

---

### 5. AuditLog

**Purpose**: Immutable log of all authentication and authorization events for security auditing

**Table**: `audit_logs`

```sql
CREATE TABLE audit_logs (
    -- Identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,  -- NULL for failed login attempts

    -- Event Details
    action VARCHAR(50) NOT NULL,  -- 'login', 'logout', 'failed_login', 'password_reset', 'role_change', etc.
    resource_type VARCHAR(50) NULL,
    resource_id UUID NULL,

    -- Request Context
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NULL,

    -- Metadata (JSONB for flexibility)
    metadata JSONB NULL,

    -- Timestamp (immutable, indexed)
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);
CREATE INDEX idx_audit_logs_metadata_gin ON audit_logs USING GIN(metadata);  -- For JSONB queries
```

**Logged Actions**:
- `login` - Successful login
- `logout` - User logout
- `failed_login` - Failed login attempt
- `password_reset_requested` - Password reset email sent
- `password_reset_completed` - Password successfully reset
- `password_changed` - Password changed via settings
- `role_changed` - User role modified by admin
- `email_verified` - Email verification completed
- `session_revoked` - Session manually revoked

**Business Rules**:
- Immutable: No UPDATE or DELETE operations
- Retention: 90 days in hot storage, archive to Azure Blob after 90 days
- Automatic logging via FastAPI middleware

**SQLAlchemy Model**:
```python
from sqlalchemy.dialects.postgresql import JSONB

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    ip_address = Column(String(45), nullable=False)
    user_agent = Column(String, nullable=True)
    metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Relationships
    user = relationship("User", back_populates="audit_logs")
```

---

### 6. EventStaff (Join Table)

**Purpose**: Links staff users to specific events (many-to-many relationship)

**Table**: `event_staff`

```sql
CREATE TABLE event_staff (
    -- Identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationships
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Assignment Metadata
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    assigned_by UUID NOT NULL REFERENCES users(id),  -- NPO Admin who made the assignment

    -- Constraints
    CONSTRAINT event_staff_unique UNIQUE(event_id, user_id)
);

-- Indexes
CREATE INDEX idx_event_staff_event_id ON event_staff(event_id);
CREATE INDEX idx_event_staff_user_id ON event_staff(user_id);
CREATE INDEX idx_event_staff_assigned_by ON event_staff(assigned_by);
```

**Business Rules**:
- One staff user can be assigned to multiple events
- One event can have multiple staff members
- Only users with `role = 'staff'` can be assigned
- Only NPO Admins can create/delete assignments
- Assignment must be within NPO Admin's organization

**SQLAlchemy Model**:
```python
class EventStaff(Base):
    __tablename__ = "event_staff"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Relationships
    event = relationship("Event", back_populates="staff_assignments")
    user = relationship("User", back_populates="event_assignments", foreign_keys=[user_id])
    assigner = relationship("User", foreign_keys=[assigned_by])

    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="event_staff_unique"),
    )
```

---

## Row-Level Security (RLS) Policies

### Enable RLS on Multi-Tenant Tables

```sql
-- Enable RLS on tables with npo_id (future: events, auctions, items)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
```

### Create Tenant Isolation Policies

```sql
-- Policy: NPO-scoped users can only see their own organization's data
CREATE POLICY tenant_isolation_policy ON events
    USING (
        npo_id = current_setting('app.current_npo_id', true)::uuid
        OR current_setting('app.user_role', true) = 'super_admin'
    );

CREATE POLICY tenant_isolation_policy ON auctions
    USING (
        npo_id = current_setting('app.current_npo_id', true)::uuid
        OR current_setting('app.user_role', true) = 'super_admin'
    );

-- Policy: Event-scoped staff can only see assigned events
CREATE POLICY staff_event_access ON events
    USING (
        current_setting('app.user_role', true) = 'staff'
        AND id IN (
            SELECT event_id FROM event_staff
            WHERE user_id = current_setting('app.current_user_id', true)::uuid
        )
    );
```

---

## Redis Data Structures

### Active Session Storage

**Key**: `session:{user_id}:{jti}`
**Value**: JSON
**TTL**: 604800 seconds (7 days)

```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "refresh_token_jti": "abc-123-xyz",
  "device": "Chrome on Windows 10",
  "ip": "192.168.1.1",
  "created_at": "2025-10-20T10:00:00Z"
}
```

### JWT Blacklist (Revoked Access Tokens)

**Key**: `blacklist:{jti}`
**Value**: `1`
**TTL**: 900 seconds (15 minutes - access token expiry)

### Email Verification Tokens

**Key**: `email_verify:{token_hash}`
**Value**: `user_id` (UUID)
**TTL**: 86400 seconds (24 hours)

### Password Reset Tokens

**Key**: `password_reset:{token_hash}`
**Value**: `user_id` (UUID)
**TTL**: 3600 seconds (1 hour)

### Rate Limiting (Login Attempts)

**Key**: `ratelimit:login:{ip_address}`
**Value**: Sorted Set of timestamps
**TTL**: 900 seconds (15 minutes)

---

## Migration Strategy

### Migration Order

1. **001_create_roles_table.py** - Create roles table + seed 5 core roles
2. **002_create_users_table.py** - Create users table with FK to roles
3. **003_create_permissions_table.py** - Create permissions + seed default permissions
4. **004_create_sessions_table.py** - Create sessions audit table
5. **005_create_audit_logs_table.py** - Create audit logs table
6. **006_create_event_staff_table.py** - Create event staff join table (depends on events table from feature 002)
7. **007_seed_superadmin.py** - Create initial super admin from environment variables
8. **008_enable_rls_policies.py** - Enable RLS and create policies (after events/auctions tables exist)

### Alembic Example (002_create_users_table.py)

```python
"""Create users table

Revision ID: 002
Revises: 001
Create Date: 2025-10-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'users',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('last_name', sa.String(100), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('organization_name', sa.String(255), nullable=True),
        sa.Column('organization_address', sa.String, nullable=True),
        sa.Column('email_verified', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('role_id', UUID(as_uuid=True), sa.ForeignKey('roles.id'), nullable=False),
        sa.Column('npo_id', UUID(as_uuid=True), nullable=True),  # FK added when organizations table exists
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text("NOW()")),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text("NOW()")),
        sa.Column('last_login_at', sa.DateTime, nullable=True),
        sa.CheckConstraint("email = LOWER(email)", name="email_lowercase"),
        sa.CheckConstraint("LENGTH(password_hash) > 0", name="password_not_empty"),
    )

    # Indexes
    op.create_index('idx_users_email', 'users', ['email'])
    op.create_index('idx_users_role_id', 'users', ['role_id'])
    op.create_index('idx_users_created_at', 'users', ['created_at'], postgresql_ops={'created_at': 'DESC'})

def downgrade():
    op.drop_table('users')
```

---

## Validation Rules (Pydantic Schemas)

### UserCreate Schema

```python
from pydantic import BaseModel, EmailStr, Field, field_validator
import re

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: str | None = Field(None, max_length=20)
    organization_name: str | None = Field(None, max_length=255)
    organization_address: str | None = None

    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Password must contain at least one letter and one number"""
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one number')
        return v

    @field_validator('email')
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        """Normalize email to lowercase"""
        return v.lower()
```

---

## Summary

**Total Tables**: 6 (roles, users, permissions, sessions, audit_logs, event_staff)
**Total Indexes**: 20+
**RLS Policies**: 3 (tenant isolation, super admin bypass, staff event access)
**Redis Keys**: 5 types (sessions, blacklist, email verify, password reset, rate limit)
**Migrations**: 8 sequential Alembic migrations

**Key Features**:
- ✅ UUIDs for all primary keys (security, distributed systems)
- ✅ Email verification required before login
- ✅ Row-Level Security for multi-tenant isolation
- ✅ Immutable audit logs and session history
- ✅ Hybrid Redis (hot data) + PostgreSQL (audit trail)
- ✅ Check constraints for data integrity
- ✅ Comprehensive indexing for performance
- ✅ Event staff many-to-many with assignment tracking

---

**Version**: 1.0.0
**Date**: October 20, 2025
**Status**: Ready for implementation
