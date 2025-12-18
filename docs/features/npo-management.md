# NPO Management Feature

**Feature ID**: 002-npo-creation
**Status**: ✅ Complete
**Version**: 1.0
**Last Updated**: November 6, 2025

## Overview

The NPO Management feature provides a complete workflow for nonprofit organizations to create profiles, customize branding, invite team members, and submit applications for approval. This feature includes role-based access control, multi-tenant data isolation, and a comprehensive SuperAdmin review system.

## Key Features

### 1. NPO Profile Creation (User Story 1)
- **Create Organization Profiles**: Admins can create detailed NPO profiles with all required information
- **Draft Management**: Save profiles as drafts and edit before submission
- **Validation**: Real-time field validation matching backend requirements
- **Multi-step Workflow**: Organized form sections for easy data entry

### 2. Branding Customization (User Story 2)
- **Logo Upload**: Direct-to-storage upload with image cropping (1:1 aspect ratio)
- **Color Customization**: Primary, secondary, accent, and text colors with live preview
- **WCAG Compliance**: Automatic contrast checking (AA standard: 4.5:1 ratio)
- **Social Media Links**: Platform-specific validation for Facebook, Twitter, Instagram, LinkedIn, YouTube
- **Real-time Preview**: See branding changes instantly on NPO detail page

### 3. Team Management (User Story 3)
- **Role Hierarchy**: Admin > Co-Admin > Staff
- **Email Invitations**: JWT-based invitation tokens (7-day expiry)
- **Team Collaboration**: Invite co-admins and staff members
- **Role Management**: Update member roles and remove members
- **Primary Admin Protection**: Prevent removal/demotion of primary admin
- **Email Notifications**: Automatic notifications for invitations sent and accepted

### 4. Application Review (User Story 4)
- **SuperAdmin Dashboard**: Dedicated applications page with search and filtering
- **Review Workflow**: Approve or reject applications with notes
- **Status Tracking**: DRAFT → PENDING_APPROVAL → APPROVED/REJECTED
- **Email Notifications**: Notify NPO admins of review decisions
- **Audit Trail**: Complete history of review actions

### 5. Legal Compliance (User Story 5)
- **Consent Management**: Terms of Service and Privacy Policy acceptance
- **Version Tracking**: Semantic versioning (major.minor) for legal documents
- **Automatic Enforcement**: Middleware blocks submission without valid consent
- **Audit Trail**: IP address, timestamp, user agent tracking
- **GDPR Compliance**: 7-year retention, data export, data deletion

## Architecture

### Backend Structure

```
backend/app/
├── models/
│   ├── npo.py                    # NPO, NPOStatus enum
│   ├── npo_application.py        # Application workflow
│   ├── npo_member.py            # Member, MemberRole enum
│   ├── npo_branding.py          # Branding configuration
│   ├── invitation.py            # JWT-based invitations
│   ├── legal_document.py        # Versioned legal docs
│   └── consent.py               # Consent tracking
├── services/
│   ├── npo_service.py           # NPO CRUD operations
│   ├── application_service.py   # Submission & review workflow
│   ├── member_service.py        # Team management
│   ├── invitation_service.py    # Invitation lifecycle
│   ├── branding_service.py      # Branding & validation
│   ├── file_upload_service.py   # Logo uploads
│   ├── legal_document_service.py # Legal docs management
│   └── consent_service.py       # Consent tracking
├── api/v1/
│   ├── npos.py                  # NPO endpoints
│   ├── members.py               # Team management endpoints
│   ├── invitations.py           # Invitation endpoints
│   ├── branding.py              # Branding endpoints
│   ├── admin.py                 # SuperAdmin endpoints
│   ├── legal_documents.py       # Legal doc endpoints
│   └── consent.py               # Consent endpoints
├── schemas/
│   ├── npo.py                   # NPO request/response schemas
│   ├── member.py                # Member schemas
│   ├── branding.py              # Branding schemas
│   ├── legal_documents.py       # Legal doc schemas
│   └── consent.py               # Consent schemas
└── middleware/
    ├── auth.py                  # Authentication & role checks
    └── consent_check.py         # Automatic consent enforcement
```

### Frontend Structure

```
frontend/fundrbolt-admin/src/
├── pages/
│   ├── npo/
│   │   ├── create-npo.tsx       # NPO creation page
│   │   ├── list-npo.tsx         # NPO list with filters
│   │   ├── detail-npo.tsx       # NPO detail page (588 lines)
│   │   └── edit-npo.tsx         # NPO editing page
│   ├── admin/
│   │   └── npo-applications.tsx # SuperAdmin applications page (260 lines)
│   └── legal/
│       └── consent-settings.tsx # User consent management
├── components/
│   ├── npo/
│   │   ├── npo-creation-form.tsx          # Reusable NPO form
│   │   ├── npo-branding-section.tsx       # Branding editor
│   │   ├── application-status-badge.tsx   # Status display & submission
│   │   └── npo-legal-agreement-modal.tsx  # Legal consent modal
│   ├── admin/
│   │   └── application-review-dialog.tsx  # Review modal (247 lines)
│   └── legal/
│       ├── legal-document-viewer.tsx      # Document display
│       └── cookie-consent-banner.tsx      # Cookie consent
├── features/npo-management/
│   └── components/
│       ├── MemberList.tsx        # Team member table (261 lines)
│       ├── StaffInvitation.tsx   # Invitation form (146 lines)
│       └── PendingInvitations.tsx # Invitation list
├── services/
│   ├── npo-service.ts            # NPO API client
│   ├── legal-service.ts          # Legal docs API client
│   └── consent-service.ts        # Consent API client
├── stores/
│   └── npo-store.ts              # Zustand store with persist
└── routes/
    └── _authenticated/
        ├── npos/...              # NPO routes
        └── admin/...             # Admin routes
```

## User Workflows

### NPO Administrator: Create and Submit Organization

1. **Sign Up / Log In**
   - Register account or log in
   - Verify email address

2. **Create NPO Profile**
   - Navigate to "Organizations" → "Create Organization"
   - Fill in Basic Information:
     - Organization name (unique, required)
     - Description (required)
     - Email address (required)
     - Phone number (required)
     - Physical address (required)
     - Tax ID / EIN (required)
     - Registration number (optional)
     - Website URL (optional)
   - Save as draft

3. **Customize Branding** (Optional)
   - Navigate to NPO detail page
   - Click "Edit" → "Branding" tab
   - Upload logo (5MB max, 100x100-4000x4000px, 1:1 aspect ratio)
   - Set brand colors with color pickers
   - Check WCAG AA contrast (4.5:1 ratio)
   - Add social media links
   - Save changes

4. **Invite Team Members** (Optional)
   - Navigate to "Team" section on NPO detail page
   - Enter email address and select role (Co-Admin or Staff)
   - Send invitation (7-day expiry)
   - Team member receives email with acceptance link
   - Accepted members appear in member list

5. **Accept Legal Agreements**
   - Click "Submit for Approval" button
   - Review Terms of Service (scrollable, version displayed)
   - Check "I have read and accept the Terms of Service"
   - Review Privacy Policy (scrollable, version displayed)
   - Check "I have read and accept the Privacy Policy"
   - Click "Accept and Continue"
   - Consent recorded with IP, timestamp, user agent

6. **Submit Application**
   - Confirm submission in final dialog
   - Application status changes to "Submitted"
   - Confirmation email sent
   - Wait for SuperAdmin review (3-5 business days)

7. **Check Status**
   - Navigate to NPO detail page
   - View application status badge:
     - **Submitted**: Under review
     - **Approved**: Organization activated
     - **Rejected**: See rejection reason, edit and resubmit

### SuperAdmin: Review Applications

1. **Access Applications**
   - Log in as SuperAdmin
   - Navigate to "NPO Applications" (sidebar link)
   - View list of pending applications

2. **Search and Filter**
   - Search by organization name or email
   - Filter by status: Submitted, Under Review, Approved, Rejected
   - Sort by submission date

3. **Review Application**
   - Click "View Details" to open NPO detail page
   - Review all organization information:
     - Basic details (name, email, phone, address, tax ID)
     - Description and mission
     - Branding (logo, colors, social media)
     - Team members
   - Verify information accuracy and completeness

4. **Approve or Reject**
   - Click "Review Application" button
   - Review dialog opens with application details
   - **To Approve**:
     - Click "Approve Application"
     - Optionally add approval notes
     - Confirm approval
     - Organization status → APPROVED
     - Approval email sent to NPO admin
   - **To Reject**:
     - Click "Reject Application"
     - Enter rejection reason (required)
     - Confirm rejection
     - Organization status → REJECTED
     - Rejection email sent with notes
     - NPO admin can edit and resubmit

5. **Track Review History**
   - All review actions logged with:
     - Reviewer name and ID
     - Decision (approve/reject)
     - Review notes
     - Timestamp
   - Audit trail maintained for compliance

## API Reference

### NPO Endpoints

#### Create NPO
```
POST /api/v1/npos
Content-Type: application/json
Authorization: Bearer <token>

Request:
{
  "name": "Hope Foundation",
  "description": "Supporting education in underserved communities",
  "email": "contact@hopefoundation.org",
  "phone": "+1234567890",
  "address": "123 Main St, City, State 12345",
  "tax_id": "12-3456789",
  "registration_number": "NPO-123456",
  "website_url": "https://hopefoundation.org"
}

Response: 201 Created
{
  "id": "uuid",
  "name": "Hope Foundation",
  "status": "draft",
  "created_at": "2025-11-06T10:00:00Z",
  ...
}
```

#### Get NPO List
```
GET /api/v1/npos?status=draft&page=1&page_size=20
Authorization: Bearer <token>

Response: 200 OK
{
  "items": [...],
  "page": 1,
  "page_size": 20,
  "total_pages": 3,
  "total_items": 45
}
```

#### Get NPO Detail
```
GET /api/v1/npos/{npo_id}
Authorization: Bearer <token>

Response: 200 OK
{
  "id": "uuid",
  "name": "Hope Foundation",
  "status": "approved",
  "member_count": 3,
  "active_member_count": 3,
  "branding": {...},
  "application": {...},
  ...
}
```

#### Update NPO
```
PATCH /api/v1/npos/{npo_id}
Content-Type: application/json
Authorization: Bearer <token>

Request:
{
  "description": "Updated description",
  "phone": "+1987654321"
}

Response: 200 OK
```

#### Submit Application
```
POST /api/v1/npos/{npo_id}/submit
Authorization: Bearer <token>

Response: 200 OK
{
  "id": "uuid",
  "status": "pending_approval",
  "application": {
    "status": "submitted",
    "submitted_at": "2025-11-06T10:00:00Z"
  }
}
```

#### Delete NPO
```
DELETE /api/v1/npos/{npo_id}
Authorization: Bearer <token>

Response: 204 No Content
```

### Team Management Endpoints

#### Get Members
```
GET /api/v1/npos/{npo_id}/members
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "user_email": "admin@example.com",
    "user_first_name": "John",
    "user_last_name": "Doe",
    "user_full_name": "John Doe",
    "role": "admin",
    "status": "active",
    "joined_at": "2025-11-06T10:00:00Z"
  }
]
```

#### Invite Member
```
POST /api/v1/npos/{npo_id}/members
Content-Type: application/json
Authorization: Bearer <token>

Request:
{
  "email": "newmember@example.com",
  "role": "co_admin",
  "message": "Join our team!"
}

Response: 201 Created
{
  "id": "uuid",
  "email": "newmember@example.com",
  "status": "pending",
  "expires_at": "2025-11-13T10:00:00Z"
}
```

#### Update Member Role
```
PATCH /api/v1/npos/{npo_id}/members/{member_id}/role
Content-Type: application/json
Authorization: Bearer <token>

Request:
{
  "role": "staff"
}

Response: 200 OK
```

#### Remove Member
```
DELETE /api/v1/npos/{npo_id}/members/{member_id}
Authorization: Bearer <token>

Response: 204 No Content
```

#### Accept Invitation
```
POST /api/v1/invitations/accept?token={jwt_token}
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Invitation accepted successfully",
  "npo": {...},
  "member": {...}
}
```

### Branding Endpoints

#### Get Branding
```
GET /api/v1/npos/{npo_id}/branding
Authorization: Bearer <token>

Response: 200 OK
{
  "primary_color": "#1E40AF",
  "secondary_color": "#3B82F6",
  "accent_color": "#60A5FA",
  "text_color": "#1F2937",
  "logo_url": "/uploads/logos/uuid.png",
  "facebook_url": "https://facebook.com/hopefoundation",
  "twitter_url": "https://twitter.com/hopefoundation",
  ...
}
```

#### Update Branding
```
PUT /api/v1/npos/{npo_id}/branding
Content-Type: application/json
Authorization: Bearer <token>

Request:
{
  "primary_color": "#1E40AF",
  "secondary_color": "#3B82F6",
  "accent_color": "#60A5FA",
  "text_color": "#1F2937",
  "facebook_url": "https://facebook.com/hopefoundation"
}

Response: 200 OK
```

#### Upload Logo
```
POST /api/v1/npos/{npo_id}/logo/upload-url
Content-Type: application/json
Authorization: Bearer <token>

Request:
{
  "filename": "logo.png",
  "content_type": "image/png"
}

Response: 200 OK
{
  "upload_url": "http://localhost:8000/uploads/logos/...",
  "file_path": "/uploads/logos/uuid.png"
}
```

### Admin Endpoints (SuperAdmin Only)

#### Get Pending Applications
```
GET /api/v1/admin/npo-applications?status=submitted&page=1&page_size=20
Authorization: Bearer <superadmin_token>

Response: 200 OK
{
  "items": [
    {
      "npo_id": "uuid",
      "npo_name": "Hope Foundation",
      "npo_email": "contact@hopefoundation.org",
      "status": "submitted",
      "submitted_at": "2025-11-06T10:00:00Z",
      "reviewed_at": null,
      "review_notes": null
    }
  ],
  "page": 1,
  "page_size": 20,
  "total_pages": 2,
  "total_items": 25
}
```

#### Review Application
```
POST /api/v1/admin/npos/{npo_id}/review
Content-Type: application/json
Authorization: Bearer <superadmin_token>

Request:
{
  "decision": "approve",  // or "reject"
  "notes": "All information verified and complete"
}

Response: 200 OK
{
  "id": "uuid",
  "status": "approved",
  "application": {
    "status": "approved",
    "reviewed_at": "2025-11-06T10:00:00Z",
    "review_notes": "All information verified and complete"
  }
}
```

### Legal & Consent Endpoints

#### Get Legal Documents
```
GET /api/v1/legal/documents

Response: 200 OK
[
  {
    "id": "uuid",
    "document_type": "terms_of_service",
    "version": "1.0",
    "content": "# Terms of Service...",
    "published_at": "2025-01-01T00:00:00Z"
  },
  {
    "id": "uuid",
    "document_type": "privacy_policy",
    "version": "1.0",
    "content": "# Privacy Policy...",
    "published_at": "2025-01-01T00:00:00Z"
  }
]
```

#### Accept Consent
```
POST /api/v1/consent/accept
Content-Type: application/json
Authorization: Bearer <token>

Request:
{
  "tos_document_id": "uuid",
  "privacy_document_id": "uuid"
}

Response: 201 Created
{
  "id": "uuid",
  "user_id": "uuid",
  "tos_document_id": "uuid",
  "tos_version": "1.0",
  "privacy_document_id": "uuid",
  "privacy_version": "1.0",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "accepted_at": "2025-11-06T10:00:00Z"
}
```

#### Get Consent Status
```
GET /api/v1/consent/status
Authorization: Bearer <token>

Response: 200 OK
{
  "has_active_consent": true,
  "consent_required": false,
  "current_tos_version": "1.0",
  "current_privacy_version": "1.0",
  "latest_tos_version": "1.0",
  "latest_privacy_version": "1.0",
  "accepted_at": "2025-11-06T10:00:00Z"
}
```

## Database Schema

### NPO Table
```sql
CREATE TABLE npos (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    tax_id VARCHAR(50),
    registration_number VARCHAR(100),
    website_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, pending_approval, approved, rejected, suspended
    creator_id UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_npos_status ON npos(status);
CREATE INDEX idx_npos_creator_id ON npos(creator_id);
```

### NPO Members Table
```sql
CREATE TABLE npo_members (
    id UUID PRIMARY KEY,
    npo_id UUID REFERENCES npos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    role VARCHAR(20) NOT NULL,  -- admin, co_admin, staff
    status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, inactive
    joined_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    UNIQUE(npo_id, user_id)
);

CREATE INDEX idx_npo_members_npo_id ON npo_members(npo_id);
CREATE INDEX idx_npo_members_user_id ON npo_members(user_id);
```

### NPO Branding Table
```sql
CREATE TABLE npo_branding (
    id UUID PRIMARY KEY,
    npo_id UUID UNIQUE REFERENCES npos(id) ON DELETE CASCADE,
    logo_url VARCHAR(500),
    primary_color VARCHAR(7),
    secondary_color VARCHAR(7),
    accent_color VARCHAR(7),
    text_color VARCHAR(7),
    facebook_url VARCHAR(500),
    twitter_url VARCHAR(500),
    instagram_url VARCHAR(500),
    linkedin_url VARCHAR(500),
    youtube_url VARCHAR(500),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

### Invitations Table
```sql
CREATE TABLE invitations (
    id UUID PRIMARY KEY,
    npo_id UUID REFERENCES npos(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    token TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, accepted, expired, revoked
    invited_by_user_id UUID REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_invitations_email_status ON invitations(email, status);
CREATE INDEX idx_invitations_npo_id ON invitations(npo_id);
```

### NPO Applications Table
```sql
CREATE TABLE npo_applications (
    id UUID PRIMARY KEY,
    npo_id UUID UNIQUE REFERENCES npos(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, submitted, under_review, approved, rejected
    submitted_at TIMESTAMP,
    submitted_by_user_id UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    reviewed_by_user_id UUID REFERENCES users(id),
    review_notes TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_npo_applications_status ON npo_applications(status);
```

## Role-Based Access Control

### Roles

1. **SuperAdmin**
   - Full system access
   - Review and approve/reject NPO applications
   - View all NPOs and applications
   - Access admin dashboard

2. **NPO Admin**
   - Create and manage NPO profile
   - Customize branding
   - Invite team members (co-admins and staff)
   - Submit application for approval
   - View and manage own NPO only

3. **NPO Co-Admin**
   - Update NPO details (except core fields)
   - Customize branding
   - Invite staff members (not co-admins)
   - View and manage assigned NPO
   - Cannot submit for approval

4. **NPO Staff**
   - View NPO details
   - View team members
   - Limited editing permissions
   - Cannot invite members
   - Cannot submit for approval

### Permission Matrix

| Action | SuperAdmin | NPO Admin | NPO Co-Admin | NPO Staff |
|--------|------------|-----------|--------------|-----------|
| Create NPO | ❌ | ✅ | ❌ | ❌ |
| View Own NPO | ✅ | ✅ | ✅ | ✅ |
| View All NPOs | ✅ | ❌ | ❌ | ❌ |
| Update NPO Details | ❌ | ✅ | ✅ (limited) | ❌ |
| Delete NPO | ❌ | ✅ | ❌ | ❌ |
| Customize Branding | ❌ | ✅ | ✅ | ❌ |
| Invite Admin/Co-Admin | ❌ | ✅ | ❌ | ❌ |
| Invite Staff | ❌ | ✅ | ✅ | ❌ |
| Remove Members | ❌ | ✅ | ✅ (staff only) | ❌ |
| Submit Application | ❌ | ✅ | ❌ | ❌ |
| Review Applications | ✅ | ❌ | ❌ | ❌ |

## Security Considerations

### Multi-Tenant Data Isolation
- All NPO data queries filtered by membership
- Users can only access NPOs they belong to
- SuperAdmin has special elevated access
- Database-level constraints prevent cross-tenant access

### Authentication & Authorization
- JWT-based authentication with 15-minute access tokens
- Refresh tokens with 7-day expiry
- Role-based access control on all endpoints
- Permission checks at service layer
- Automatic token refresh on frontend

### Input Validation
- Pydantic schemas validate all inputs
- SQL injection prevention via SQLAlchemy ORM
- XSS prevention via React's built-in escaping
- CSRF protection on state-changing operations
- File upload validation (type, size, dimensions)

### Consent Enforcement
- Middleware blocks requests without valid consent
- 409 Conflict returned if consent outdated
- IP address and timestamp tracking
- Immutable audit logs
- GDPR compliance

### Rate Limiting
- Login attempts: 5 per 15 minutes
- Password reset: 3 per hour
- Invitation sending: (to be implemented in T145)
- Redis-backed distributed rate limiting

### Audit Logging
- All NPO creation, updates, deletions logged
- SuperAdmin review actions logged
- Member additions/removals logged
- Consent acceptances logged
- Invitation lifecycle logged

## Testing

### Backend Tests
- **Contract Tests**: 21/21 passing (invitation workflow)
- **Integration Tests**: Complete NPO creation workflow
- **Unit Tests**: Permission checks, password hashing, JWT blacklist
- **Coverage**: 40% overall, 40% BrandingService, 77% API endpoints

### Frontend Tests
- Component tests for key features
- E2E tests pending (T142, T143)

### Test Data
- Seed scripts available for legal documents
- Demo data seeding script pending (T150)

## Performance Considerations

### Database Optimization
- Indexes on status, email, npo_id, user_id columns
- Soft deletes for audit trail
- Pagination on all list endpoints (default 20 per page)
- Eager loading for relationships (selectinload)

### Caching
- TanStack Query caching on frontend (5-minute stale time)
- Redis session storage
- Static asset caching

### File Uploads
- Direct-to-storage uploads (local fallback)
- Image validation before upload
- File size limits: 5MB for logos
- Dimension limits: 100x100 to 4000x4000 pixels

## Monitoring & Observability

### Metrics (Prometheus)
- `fundrbolt_http_requests_total` - HTTP requests by method/path/status
- `fundrbolt_db_failures_total` - Database connection failures
- `fundrbolt_redis_failures_total` - Redis connection failures
- `fundrbolt_email_failures_total` - Email send failures
- `fundrbolt_up` - Application up/down status

### Structured Logging
- JSON format with request IDs
- X-Request-ID header in responses
- Context propagation via ContextVar
- Log levels: DEBUG, INFO, WARNING, ERROR

### Health Checks
- `/health` - Basic liveness check
- `/health/detailed` - DB, Redis, email validation
- `/health/ready` - Kubernetes readiness probe
- `/health/live` - Kubernetes liveness probe

## Deployment

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/fundrbolt

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Email
EMAIL_FROM=noreply@fundrbolt.app
EMAIL_SERVICE=sendgrid  # or smtp
SENDGRID_API_KEY=your-key-here

# File Storage
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE=5242880  # 5MB

# Frontend
VITE_API_URL=http://localhost:8000/api/v1
```

### Docker Compose
```yaml
services:
  backend:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@db/fundrbolt
      - REDIS_URL=redis://redis:6379/0
    ports:
      - "8000:8000"
    depends_on:
      - db
      - redis

  frontend:
    build: ./frontend/fundrbolt-admin
    environment:
      - VITE_API_URL=http://localhost:8000/api/v1
    ports:
      - "3000:3000"

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=fundrbolt
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Troubleshooting

### Common Issues

**Issue**: "Consent required" error when submitting application
**Solution**: User must accept latest Terms of Service and Privacy Policy. Modal should appear automatically on submission.

**Issue**: "Permission denied" when inviting team members
**Solution**: Only NPO Admins can invite Co-Admins. Co-Admins can only invite Staff.

**Issue**: Logo upload fails with validation error
**Solution**: Check file size (<5MB), dimensions (100x100-4000x4000px), and format (PNG, JPG, WEBP).

**Issue**: "NPO name already exists"
**Solution**: Organization names must be unique across the platform. Choose a different name.

**Issue**: Cannot submit application - fields incomplete
**Solution**: All required fields must be filled: name, description, email, phone, address, tax ID.

**Issue**: Invitation link expired
**Solution**: Invitations expire after 7 days. Request a new invitation from NPO admin.

**Issue**: Review button not appearing on NPO detail page
**Solution**: Only SuperAdmins see the Review button, and only for pending_approval NPOs.

## Future Enhancements

### Planned Features
- Rate limiting for invitation sending (T145)
- NPO creation success/failure metrics (T146)
- Comprehensive E2E tests (T142, T143)
- Unit tests for permissions and file validation (T140, T141)
- Performance monitoring for NPO endpoints (T139)

### Potential Improvements
- Bulk import of NPOs
- Advanced branding templates
- Multi-language support
- Document library for NPOs
- Analytics dashboard
- Mobile app support

## Support

For technical support or questions:
- Email: engineering@fundrbolt.app
- Slack: #npo-management channel
- Documentation: https://docs.fundrbolt.app

## Version History

- **v1.0** (November 6, 2025): Initial release with all 5 user stories complete
  - NPO profile creation and management
  - Branding customization
  - Team invitation and collaboration
  - SuperAdmin review workflow
  - Legal consent management
