# Phase 1: Data Model

**Feature**: 006-landing-page
**Date**: 2025-11-06
**Status**: Complete

## Overview

This document defines the database schema for the landing page feature, covering two new entities: ContactSubmission and Testimonial. Both entities follow the platform's existing conventions (UUID primary keys, created_at/updated_at timestamps, soft deletes where applicable).

## Entity Relationship Diagram

```
┌─────────────────────────┐
│   contact_submissions   │
├─────────────────────────┤
│ id (UUID, PK)           │
│ sender_name             │
│ sender_email            │
│ subject                 │
│ message                 │
│ ip_address              │
│ status                  │
│ created_at              │
│ updated_at              │
└─────────────────────────┘

┌─────────────────────────┐
│     testimonials        │
├─────────────────────────┤
│ id (UUID, PK)           │
│ quote_text              │
│ author_name             │
│ author_role             │
│ organization_name       │
│ photo_url               │
│ display_order           │
│ is_published            │
│ created_by (UUID, FK)   │────────> users.id
│ created_at              │
│ updated_at              │
│ deleted_at              │
└─────────────────────────┘
```

## Entity Definitions

### 1. ContactSubmission

**Purpose**: Store contact form submissions for audit trail and potential support ticketing integration

**Table Name**: `contact_submissions`

**Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| sender_name | VARCHAR(100) | NOT NULL | Name of person submitting form |
| sender_email | VARCHAR(255) | NOT NULL | Email address for response |
| subject | VARCHAR(200) | NOT NULL | Subject line of inquiry |
| message | TEXT | NOT NULL | Message body (max 5000 chars enforced in app) |
| ip_address | VARCHAR(45) | NOT NULL | IPv4 or IPv6 address for rate limiting |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | pending, processed, failed |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Submission timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes**:

```sql
CREATE INDEX idx_contact_submissions_ip_created
ON contact_submissions(ip_address, created_at);

CREATE INDEX idx_contact_submissions_status
ON contact_submissions(status);

CREATE INDEX idx_contact_submissions_created_at
ON contact_submissions(created_at DESC);
```

**Validation Rules** (enforced at application level):

- `sender_name`: 1-100 characters, no special characters beyond spaces, hyphens, apostrophes
- `sender_email`: Valid RFC 5322 email format, max 255 characters
- `subject`: 1-200 characters
- `message`: 1-5000 characters, HTML stripped/sanitized
- `ip_address`: Valid IPv4 or IPv6 format
- `status`: One of ['pending', 'processed', 'failed']

**Business Rules**:

- Contact submissions are immutable (no updates after creation except status)
- Retention: Keep indefinitely for audit purposes
- No soft delete (hard delete after 7 years for GDPR compliance if requested)
- Email notifications sent immediately after creation
- Rate limiting: Max 5 submissions per IP per hour (enforced in middleware)

**State Transitions**:

```
pending → processed (email successfully sent)
pending → failed (email delivery failed after retries)
failed → processed (manual retry successful)
```

### 2. Testimonial

**Purpose**: Store curated user testimonials for display on testimonials page

**Table Name**: `testimonials`

**Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| quote_text | VARCHAR(500) | NOT NULL | The testimonial quote |
| author_name | VARCHAR(100) | NOT NULL | Name or initials (e.g., "Sarah J.") |
| author_role | VARCHAR(50) | NOT NULL | donor, auctioneer, npo_admin |
| organization_name | VARCHAR(200) | NULL | Optional organization name |
| photo_url | VARCHAR(500) | NULL | Optional photo URL (Azure Blob Storage) |
| display_order | INTEGER | NOT NULL, DEFAULT 0 | For manual ordering (lower = higher priority) |
| is_published | BOOLEAN | NOT NULL, DEFAULT FALSE | Draft vs published |
| created_by | UUID | NOT NULL, FOREIGN KEY → users(id) | Admin who created testimonial |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last update timestamp |
| deleted_at | TIMESTAMP | NULL | Soft delete timestamp |

**Foreign Keys**:

```sql
ALTER TABLE testimonials
ADD CONSTRAINT fk_testimonials_created_by
FOREIGN KEY (created_by) REFERENCES users(id)
ON DELETE RESTRICT;  -- Prevent deleting user who created testimonials
```

**Indexes**:

```sql
CREATE INDEX idx_testimonials_published_order
ON testimonials(is_published, display_order)
WHERE deleted_at IS NULL;

CREATE INDEX idx_testimonials_role
ON testimonials(author_role)
WHERE deleted_at IS NULL AND is_published = TRUE;

CREATE INDEX idx_testimonials_created_by
ON testimonials(created_by);
```

**Validation Rules** (enforced at application level):

- `quote_text`: 10-500 characters
- `author_name`: 1-100 characters
- `author_role`: One of ['donor', 'auctioneer', 'npo_admin']
- `organization_name`: 0-200 characters (optional)
- `photo_url`: Valid URL format, max 500 characters (optional)
- `display_order`: Integer 0-9999
- `is_published`: Boolean

**Business Rules**:

- Only admins (superadmin role) can create/update/delete testimonials
- Soft delete (set deleted_at timestamp)
- Unpublished testimonials are drafts (not shown on public page)
- Display order allows manual curation (lower numbers appear first)
- Photo URLs point to Azure Blob Storage (uploaded separately)
- No user-submitted testimonials in MVP (all admin-created)

**Query Patterns**:

```sql
-- Get published testimonials for public page (ordered)
SELECT id, quote_text, author_name, author_role, organization_name, photo_url
FROM testimonials
WHERE is_published = TRUE AND deleted_at IS NULL
ORDER BY display_order ASC, created_at DESC
LIMIT 10 OFFSET ?;

-- Get testimonials by role
SELECT * FROM testimonials
WHERE author_role = ? AND is_published = TRUE AND deleted_at IS NULL
ORDER BY display_order ASC;

-- Admin: Get all testimonials (including drafts and deleted)
SELECT * FROM testimonials
ORDER BY created_at DESC;
```

## SQLAlchemy Models

### ContactSubmission Model

```python
# backend/app/models/contact_submission.py
from sqlalchemy import Column, String, Text, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base
import uuid
import enum
from datetime import datetime

class SubmissionStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    FAILED = "failed"

class ContactSubmission(Base):
    __tablename__ = "contact_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_name = Column(String(100), nullable=False)
    sender_email = Column(String(255), nullable=False)
    subject = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    ip_address = Column(String(45), nullable=False)
    status = Column(
        Enum(SubmissionStatus),
        nullable=False,
        default=SubmissionStatus.PENDING
    )
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    def __repr__(self):
        return f"<ContactSubmission {self.id} from {self.sender_email}>"
```

### Testimonial Model

```python
# backend/app/models/testimonial.py
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base
import uuid
import enum
from datetime import datetime

class AuthorRole(str, enum.Enum):
    DONOR = "donor"
    AUCTIONEER = "auctioneer"
    NPO_ADMIN = "npo_admin"

class Testimonial(Base):
    __tablename__ = "testimonials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quote_text = Column(String(500), nullable=False)
    author_name = Column(String(100), nullable=False)
    author_role = Column(Enum(AuthorRole), nullable=False)
    organization_name = Column(String(200), nullable=True)
    photo_url = Column(String(500), nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    is_published = Column(Boolean, nullable=False, default=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<Testimonial {self.id} by {self.author_name}>"
```

## Alembic Migration

```python
# alembic/versions/YYYYMMDD_HHMM_add_contact_testimonial_tables.py
"""Add contact_submissions and testimonials tables

Revision ID: XXXXXX
Revises: YYYYYY
Create Date: 2025-11-06 XX:XX:XX.XXXXXX
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'XXXXXX'
down_revision = 'YYYYYY'  # Last migration from feature 005
branch_labels = None
depends_on = None

def upgrade():
    # Create contact_submissions table
    op.create_table(
        'contact_submissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('sender_name', sa.String(100), nullable=False),
        sa.Column('sender_email', sa.String(255), nullable=False),
        sa.Column('subject', sa.String(200), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Create indexes for contact_submissions
    op.create_index(
        'idx_contact_submissions_ip_created',
        'contact_submissions',
        ['ip_address', 'created_at']
    )
    op.create_index(
        'idx_contact_submissions_status',
        'contact_submissions',
        ['status']
    )
    op.create_index(
        'idx_contact_submissions_created_at',
        'contact_submissions',
        [sa.text('created_at DESC')]
    )

    # Create testimonials table
    op.create_table(
        'testimonials',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('quote_text', sa.String(500), nullable=False),
        sa.Column('author_name', sa.String(100), nullable=False),
        sa.Column('author_role', sa.String(50), nullable=False),
        sa.Column('organization_name', sa.String(200), nullable=True),
        sa.Column('photo_url', sa.String(500), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_published', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
    )

    # Create indexes for testimonials
    op.create_index(
        'idx_testimonials_published_order',
        'testimonials',
        ['is_published', 'display_order'],
        postgresql_where=sa.text('deleted_at IS NULL')
    )
    op.create_index(
        'idx_testimonials_role',
        'testimonials',
        ['author_role'],
        postgresql_where=sa.text('deleted_at IS NULL AND is_published = true')
    )
    op.create_index(
        'idx_testimonials_created_by',
        'testimonials',
        ['created_by']
    )

def downgrade():
    op.drop_index('idx_testimonials_created_by')
    op.drop_index('idx_testimonials_role')
    op.drop_index('idx_testimonials_published_order')
    op.drop_table('testimonials')

    op.drop_index('idx_contact_submissions_created_at')
    op.drop_index('idx_contact_submissions_status')
    op.drop_index('idx_contact_submissions_ip_created')
    op.drop_table('contact_submissions')
```

## Pydantic Schemas

### ContactSubmission Schemas

```python
# backend/app/schemas/contact.py
from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime
from uuid import UUID
from typing import Optional
from app.models.contact_submission import SubmissionStatus
import bleach

class ContactSubmissionCreate(BaseModel):
    sender_name: str = Field(..., min_length=1, max_length=100)
    sender_email: EmailStr
    subject: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=5000)

    @validator('sender_name')
    def validate_name(cls, v):
        # Allow only letters, spaces, hyphens, apostrophes
        if not all(c.isalpha() or c in " -'" for c in v):
            raise ValueError('Name contains invalid characters')
        return v.strip()

    @validator('message')
    def sanitize_message(cls, v):
        # Strip HTML tags for security
        return bleach.clean(v, tags=[], strip=True).strip()

class ContactSubmissionResponse(BaseModel):
    id: UUID
    sender_name: str
    sender_email: str
    subject: str
    status: SubmissionStatus
    created_at: datetime

    class Config:
        orm_mode = True

class ContactSubmissionDetail(ContactSubmissionResponse):
    message: str
    ip_address: str
    updated_at: datetime
```

### Testimonial Schemas

```python
# backend/app/schemas/testimonial.py
from pydantic import BaseModel, HttpUrl, Field
from datetime import datetime
from uuid import UUID
from typing import Optional
from app.models.testimonial import AuthorRole

class TestimonialCreate(BaseModel):
    quote_text: str = Field(..., min_length=10, max_length=500)
    author_name: str = Field(..., min_length=1, max_length=100)
    author_role: AuthorRole
    organization_name: Optional[str] = Field(None, max_length=200)
    photo_url: Optional[HttpUrl] = None
    display_order: int = Field(default=0, ge=0, le=9999)
    is_published: bool = False

class TestimonialUpdate(BaseModel):
    quote_text: Optional[str] = Field(None, min_length=10, max_length=500)
    author_name: Optional[str] = Field(None, min_length=1, max_length=100)
    author_role: Optional[AuthorRole] = None
    organization_name: Optional[str] = Field(None, max_length=200)
    photo_url: Optional[HttpUrl] = None
    display_order: Optional[int] = Field(None, ge=0, le=9999)
    is_published: Optional[bool] = None

class TestimonialResponse(BaseModel):
    id: UUID
    quote_text: str
    author_name: str
    author_role: AuthorRole
    organization_name: Optional[str]
    photo_url: Optional[str]
    display_order: int
    is_published: bool
    created_at: datetime

    class Config:
        orm_mode = True

class TestimonialDetail(TestimonialResponse):
    created_by: UUID
    updated_at: datetime
    deleted_at: Optional[datetime]
```

## Data Seeding (Development/Testing)

```python
# backend/seed_testimonials.py
from app.core.database import SessionLocal
from app.models.testimonial import Testimonial, AuthorRole
from app.models.user import User
import uuid

def seed_testimonials():
    db = SessionLocal()

    # Get or create admin user
    admin = db.query(User).filter(User.email == "admin@fundrbolt.com").first()
    if not admin:
        print("Admin user not found. Run seed_test_users.py first.")
        return

    testimonials = [
        {
            "quote_text": "Fundrbolt helped us raise 40% more than last year's gala. The digital bid paddles were a huge hit with our donors!",
            "author_name": "Sarah J.",
            "author_role": AuthorRole.DONOR,
            "organization_name": "Community Arts Foundation",
            "display_order": 1,
            "is_published": True,
        },
        {
            "quote_text": "As an auctioneer, Fundrbolt's real-time controls gave me confidence. The bid tracking is flawless.",
            "author_name": "Michael Chen",
            "author_role": AuthorRole.AUCTIONEER,
            "organization_name": "Elite Auctioneers",
            "display_order": 2,
            "is_published": True,
        },
        {
            "quote_text": "Setup was incredibly easy. We had our event running in days, not weeks. Highly recommend!",
            "author_name": "Lisa Martinez",
            "author_role": AuthorRole.NPO_ADMIN,
            "organization_name": "Hope Shelter",
            "display_order": 3,
            "is_published": True,
        },
    ]

    for t_data in testimonials:
        testimonial = Testimonial(
            id=uuid.uuid4(),
            created_by=admin.id,
            **t_data
        )
        db.add(testimonial)

    db.commit()
    print(f"Seeded {len(testimonials)} testimonials")
    db.close()

if __name__ == "__main__":
    seed_testimonials()
```

## Summary

- **2 new tables**: `contact_submissions`, `testimonials`
- **0 modified tables**: No changes to existing schema
- **6 new indexes**: Optimized for common query patterns
- **1 foreign key**: `testimonials.created_by` → `users.id`
- **Soft delete**: Testimonials only (contact submissions are immutable)
- **Audit trail**: Both entities track created_at/updated_at
