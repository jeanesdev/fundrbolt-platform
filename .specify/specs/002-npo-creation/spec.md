# NPO Creation and Management Feature

## Overview
This feature enables users to create and manage Non-Profit Organizations (NPOs) within the Fundrbolt platform, including detailed setup, branding configuration, and administrative workflows.

## Clarifications

### Session 2025-10-19
- Q: NPO Tax ID Validation Requirements → A: US EIN format with international expansion capability
- Q: SuperAdmin Review Response Time Requirements → A: 2 business days SLA with auto-notifications
- Q: Logo File Upload Restrictions → A: 5MB max, PNG/JPG/SVG formats
- Q: Staff Invitation Expiry Time → A: 7 days with reminder notifications
- Q: NPO Name Uniqueness Scope → A: Globally unique across entire platform

## Requirements

### Core NPO Creation
- **NPO Details Input**: Users can input comprehensive NPO information including:
  - Organization name and description (organization name must be globally unique across the platform)
  - Contact information (address, phone, email)
  - Tax identification numbers (US EIN format required, with system designed for future international tax ID support)
  - Mission statement and organizational goals
  - Website URL
  - Registration/incorporation details

### Branding and Visual Identity
- **Color Schemes**: Customizable primary and secondary colors for NPO branding
- **Logo Upload**: Support for uploading organization logos and brand assets (5MB maximum file size, PNG/JPG/SVG formats supported)
- **Theme Configuration**: Visual theming options consistent with NPO branding

### Social Media Integration
- **Social Media Handlers**: Input and management of social media accounts:
  - Facebook page URLs
  - Twitter/X handles
  - Instagram profiles
  - LinkedIn organization pages
  - YouTube channels
  - Other relevant social platforms

### Administrative Management
- **Co-Administrator Invitations**:
  - Ability to invite multiple co-administrators
  - Role-based permissions for co-administrators
  - Invitation management and tracking
  - Invitations expire after 7 days with reminder notifications
- **Staff Management**:
  - Invite staff members with appropriate roles
  - Manage staff permissions and access levels

### Approval Workflow
- **SuperAdmin Review Process**:
  - All new NPO applications must be submitted for review
  - SuperAdmin can approve, reject, or request modifications
  - NPO cannot create events or send invitations until approved
  - Verification process for NPO legitimacy
  - 2 business days SLA for review completion with automated status notifications

### Legal and Compliance
- **EULA Agreement**:
  - NPO administrators must agree to End User License Agreement
  - Terms and Conditions acceptance required
  - Legal document versioning and tracking
  - Re-acceptance required for updated terms

### Status Management
- **Application States**:
  - Draft (in progress)
  - Submitted (pending review)
  - Under Review (being evaluated by SuperAdmin)
  - Approved (verified and active)
  - Rejected (with reasons)
  - Suspended (temporarily disabled)

## User Stories

1. **As an NPO Administrator**, I want to create a new NPO profile so that I can establish my organization's presence on the platform.

2. **As an NPO Administrator**, I want to customize my organization's branding so that it reflects our visual identity.

3. **As an NPO Administrator**, I want to invite co-administrators and staff so that we can collaboratively manage our organization.

4. **As a SuperAdmin**, I want to review NPO applications so that I can ensure only legitimate organizations are approved.

5. **As an NPO Administrator**, I want to understand the terms and conditions so that I can make informed decisions about using the platform.

## Acceptance Criteria

- NPO creation form captures all required organizational details
- Branding customization is reflected throughout the NPO's interface
- Social media links are validated and properly formatted
- Invitation system prevents sending invites before approval
- SuperAdmin has comprehensive review interface
- Legal agreements are properly tracked and enforced
- Application status is clearly communicated to users

## Authentication and Route Protection

### Protected Routes

- **Index/Dashboard Route (`/`)**: Requires authentication
  - Unauthenticated users must be redirected to `/sign-in`
  - Prevents display of user interface elements when not logged in
  - Navigation guards check authentication status before rendering
- **All Application Routes**: Must verify user authentication before access
  - Sign-in page preserves intended destination for post-login redirect
  - Session validation on route transitions
  - Automatic logout redirect on token expiration

### UI State Management

- **Unauthenticated State**:
  - No profile dropdown or user information displayed
  - No access to protected features or navigation
  - Clear call-to-action to sign in
- **Authenticated State**:
  - Display user profile information (name, email)
  - Show role-appropriate navigation and features
  - Proper sign-out functionality

## Technical Considerations

- Form validation and data sanitization
- File upload handling for logos and documents
- Role-based access control implementation
- Email notification system for invitations and approvals
- Route guards and authentication middleware
- Session management and token validation
- Audit logging for all administrative actions
- Integration with authentication system
- Responsive design for various devices
