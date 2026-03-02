# Quick Start: NPO Creation and Management

**Feature**: NPO Creation and Management
**Date**: 2025-10-19
**Estimated Implementation**: 2-3 weeks

## Overview

This guide provides step-by-step instructions for implementing the NPO creation and management feature in the Fundrbolt fundraising platform. The feature enables users to create non-profit organizations with comprehensive branding, staff management, and approval workflows.

## Prerequisites

### Technical Requirements
- Python 3.11+ with FastAPI backend
- PostgreSQL database with existing multi-tenant setup
- React/TypeScript frontend with existing authentication
- Azure Blob Storage account for file uploads
- Email service (SendGrid or Azure Communication Services)

### Existing System Dependencies
- User authentication system (OAuth2/JWT)
- Multi-tenant architecture with `tenant_id` pattern
- Role-based access control (RBAC) framework
- Database migration system (Alembic)

## Implementation Plan

### Phase 1: Backend Foundation (Week 1)
1. **Database Models** (Day 1-2)
   - Create NPO, NPO_APPLICATION, NPO_MEMBER tables
   - Implement database migrations with proper indexes
   - Set up Row-Level Security (RLS) policies

2. **Core Services** (Day 3-4)
   - NPO service with CRUD operations
   - Application workflow service
   - Multi-tenant data isolation enforcement

3. **API Endpoints** (Day 5)
   - Basic NPO management endpoints
   - Application submission endpoint
   - Validation and error handling

### Phase 2: Branding and Files (Week 2, Days 1-3)
1. **File Upload System**
   - Azure Blob Storage integration
   - Signed URL generation for secure uploads
   - Image processing and validation

2. **Branding Management**
   - Color scheme storage and validation
   - Social media link management
   - CSS property customization

### Phase 3: Staff Management (Week 2, Days 4-5)
1. **Invitation System**
   - JWT-based invitation tokens
   - Email notification service
   - Role-based invitation permissions

2. **Member Management**
   - Staff relationship tracking
   - Role assignment and updates
   - Permission enforcement

### Phase 4: Approval Workflow (Week 3, Days 1-3)
1. **SuperAdmin Interface**
   - Application review endpoints
   - Approval/rejection workflow
   - Review notes and audit trail

2. **Legal Agreement System**
   - Document versioning
   - Acceptance tracking
   - Compliance reporting

### Phase 5: Frontend Implementation (Week 3, Days 4-5)
1. **NPO Creation Forms**
   - Multi-step form with validation
   - Branding configuration interface
   - File upload components

2. **Management Interfaces**
   - Staff invitation system
   - Application status dashboard
   - SuperAdmin review panel

## Development Steps

### Step 1: Database Setup

#### 1.1 Create Migration File
```bash
cd backend
alembic revision --autogenerate -m "Add NPO management tables"
```

#### 1.2 Review Generated Migration
Edit the migration file to include:
- Proper foreign key constraints
- Index creation for performance
- Row-Level Security policy setup

#### 1.3 Apply Migration
```bash
alembic upgrade head
```

### Step 2: Backend Models

#### 2.1 Create SQLAlchemy Models
Location: `backend/src/models/`

Files to create:
- `npo.py` - Core NPO entity
- `npo_application.py` - Application workflow
- `npo_member.py` - Staff relationships
- `npo_branding.py` - Visual identity
- `legal_document.py` - Legal agreements

#### 2.2 Update Model Registry
Add new models to SQLAlchemy metadata for auto-discovery.

### Step 3: Service Layer

#### 3.1 NPO Service (`backend/src/services/npo_service.py`)
```python
class NPOService:
    async def create_npo(self, npo_data: CreateNPORequest, user_id: UUID) -> NPO
    async def get_npo(self, npo_id: UUID, user_id: UUID) -> NPO
    async def update_npo(self, npo_id: UUID, updates: UpdateNPORequest) -> NPO
    async def list_user_npos(self, user_id: UUID) -> List[NPO]
```

#### 3.2 Application Service (`backend/src/services/application_service.py`)
```python
class ApplicationService:
    async def submit_application(self, npo_id: UUID) -> NPOApplication
    async def review_application(self, app_id: UUID, review: ReviewRequest) -> NPOApplication
    async def get_pending_applications(self) -> List[NPOApplication]
```

#### 3.3 Invitation Service (`backend/src/services/invitation_service.py`)
```python
class InvitationService:
    async def create_invitation(self, invitation_data: CreateInvitationRequest) -> Invitation
    async def accept_invitation(self, invitation_id: UUID, token: str) -> NPOMember
    async def revoke_invitation(self, invitation_id: UUID) -> None
```

### Step 4: API Endpoints

#### 4.1 NPO Endpoints (`backend/src/api/npo_endpoints.py`)
Implement endpoints following the OpenAPI specification:
- `GET /npos` - List NPOs
- `POST /npos` - Create NPO
- `GET /npos/{id}` - Get NPO details
- `PUT /npos/{id}` - Update NPO
- `POST /npos/{id}/submit` - Submit for approval

#### 4.2 Staff Management Endpoints
- `GET /npos/{id}/members` - List members
- `POST /npos/{id}/members` - Invite member
- `PUT /npos/{id}/members/{memberId}` - Update member
- `DELETE /npos/{id}/members/{memberId}` - Remove member

#### 4.3 SuperAdmin Endpoints
- `GET /admin/npos/applications` - List applications
- `POST /admin/npos/{id}/applications/{appId}/review` - Review application

### Step 5: Frontend Components

#### 5.1 NPO Creation Form (`frontend/src/features/npo-management/components/NpoCreationForm.tsx`)
Multi-step form with sections:
1. Basic Information
2. Contact Details
3. Branding Setup
4. Review and Submit

#### 5.2 Branding Configuration (`frontend/src/features/npo-management/components/BrandingConfiguration.tsx`)
- Color picker integration
- Logo upload component
- Social media link inputs
- Real-time preview

#### 5.3 Staff Management (`frontend/src/features/npo-management/components/StaffInvitation.tsx`)
- Member list with roles
- Invitation form
- Role management interface

### Step 6: File Upload Implementation

#### 6.1 Backend: Signed URL Generation
```python
@router.post("/npos/{npo_id}/logo/upload-url")
async def get_logo_upload_url(
    npo_id: UUID,
    request: UploadRequest,
    current_user: User = Depends(get_current_user)
):
    # Generate Azure Blob Storage signed URL
    # Return upload URL and final asset URL
```

#### 6.2 Frontend: File Upload Component
```tsx
const LogoUpload = ({ npoId, onUploadComplete }) => {
  // Handle file selection
  // Get signed URL from API
  // Upload directly to Azure Blob Storage
  // Update NPO branding with new logo URL
}
```

### Step 7: Email Notifications

#### 7.1 Template Creation
Create email templates for:
- Invitation notifications
- Application status updates
- Welcome messages

#### 7.2 Service Integration
```python
class EmailService:
    async def send_invitation(self, invitation: Invitation) -> None
    async def send_application_update(self, application: NPOApplication) -> None
```

## Configuration

### Environment Variables
Add to `.env` files:
```
# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
AZURE_STORAGE_CONTAINER_NAME=npo-assets

# Email Service
SENDGRID_API_KEY=your_api_key
FROM_EMAIL=noreply@fundrbolt.com

# Application Settings
NPO_LOGO_MAX_SIZE=5242880  # 5MB
INVITATION_EXPIRY_DAYS=7
```

### Database Configuration
Ensure proper connection pooling and multi-tenant setup:
```python
# Database session with tenant isolation
SessionLocal = sessionmaker(
    bind=engine,
    class_=TenantAwareSession,
    expire_on_commit=False
)
```

## Testing Strategy

### Unit Tests
- Service layer business logic
- Model validation rules
- Permission checking

### Integration Tests
- API endpoint workflows
- Database operations
- Email sending

### End-to-End Tests
```typescript
// tests/e2e/npo-creation.spec.ts
test('complete NPO creation workflow', async ({ page }) => {
  // Navigate to NPO creation
  // Fill out form
  // Submit for approval
  // Verify email notifications
  // SuperAdmin approval
  // Verify NPO activation
});
```

## Security Considerations

### Authentication & Authorization
- JWT token validation on all endpoints
- Role-based access control enforcement
- Multi-tenant data isolation

### File Upload Security
- File type validation (PNG, JPG, SVG only)
- Size limits (5MB max)
- Virus scanning integration
- Secure signed URLs with expiration

### Data Validation
- Server-side validation mirrors frontend rules
- SQL injection prevention
- XSS protection with proper escaping

## Deployment Checklist

### Pre-Deployment
- [ ] Database migration tested in staging
- [ ] Azure Blob Storage container created
- [ ] Email service configured and tested
- [ ] Environment variables set
- [ ] SSL certificates for file upload domains

### Deployment Steps
1. Deploy backend with new API endpoints
2. Run database migration
3. Deploy frontend with new components
4. Configure Azure resources
5. Test email delivery
6. Verify file upload functionality

### Post-Deployment Verification
- [ ] NPO creation workflow functional
- [ ] Email notifications working
- [ ] File uploads processing correctly
- [ ] SuperAdmin interface accessible
- [ ] Multi-tenant isolation verified

## Monitoring and Metrics

### Application Metrics
- NPO creation success/failure rates
- Application approval times
- File upload success rates
- Email delivery rates

### Performance Metrics
- API response times
- Database query performance
- File upload speeds
- Page load times

### Business Metrics
- NPO application volume
- Approval/rejection ratios
- Time from approval to first event
- User engagement with branding features

## Troubleshooting

### Common Issues

#### Database Connection Errors
- Verify connection string and credentials
- Check database server accessibility
- Ensure proper SSL configuration

#### File Upload Failures
- Verify Azure Blob Storage configuration
- Check signed URL expiration
- Validate file type and size restrictions

#### Email Delivery Issues
- Confirm SendGrid/email service setup
- Check sender reputation and DNS records
- Verify email template formatting

#### Permission Denied Errors
- Review role-based access control rules
- Check JWT token validity
- Verify multi-tenant isolation configuration

### Debug Commands
```bash
# Check database connectivity
python -m backend.src.core.database test_connection

# Verify Azure Blob Storage
python -m backend.src.services.file_service test_upload

# Test email service
python -m backend.src.services.email_service test_send
```

## Support and Documentation

### API Documentation
- OpenAPI specification available at `/docs`
- Postman collection for testing
- Authentication examples

### User Documentation
- NPO administrator guide
- SuperAdmin review procedures
- Troubleshooting common issues

### Developer Documentation
- Code architecture overview
- Database schema documentation
- Deployment procedures

## Next Steps

After successful implementation:

1. **Performance Optimization**
   - Monitor query performance and add indexes as needed
   - Implement caching for frequently accessed data
   - Optimize file upload and processing

2. **Feature Enhancements**
   - Advanced branding customization
   - Bulk member import/export
   - Automated compliance checking

3. **Integration Opportunities**
   - CRM system integrations
   - Advanced analytics dashboard
   - Mobile app support

4. **Compliance and Security**
   - SOC 2 audit preparation
   - GDPR compliance verification
   - Security penetration testing

## Support Contacts

- **Technical Issues**: dev-team@fundrbolt.com
- **Business Requirements**: product@fundrbolt.com
- **Security Concerns**: security@fundrbolt.com
