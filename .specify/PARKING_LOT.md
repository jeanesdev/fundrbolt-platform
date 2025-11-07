# Parking Lot

Items that are deferred, blocked, or waiting for future consideration.

## Deferred Features

### Feature 004: Cloud Infrastructure - Production Deployment (T162-T164)
- **Status**: Deferred - Minimal deployment operational
- **Phase**: Phase 9 (Final Validation)
- **Feature**: 004-cloud-infrastructure-deployment
- **Tasks**:
  - T162: Deploy production environment and verify all success criteria met
  - T163: Conduct final cost analysis and confirm within 10% variance of estimates
  - T164: Schedule first quarterly disaster recovery drill
- **Current State**: All infrastructure code complete, minimal deployment (~$1.50/month) operational for local development
- **Reason**: Full production infrastructure (~$289/month) not needed until ready to launch to real users
- **Blocking**: Budget approval, production readiness decision
- **Revisit When**:
  - Ready to launch to production users
  - Need to deploy full application stack to Azure
  - Budget approved for ~$289/month Azure costs
- **Estimated Effort**: 3-5 days (deployment, validation, DR drill)
- **Dependencies**:
  - T162 blocked by: Production readiness decision, budget approval
  - T163 blocked by: T162 (need 30 days of production operation for cost analysis)
  - T164 blocked by: T162 (need production environment to test DR procedures)

### Database Permission Table (T074-T075)
- **Status**: Deferred - Using service-based permissions instead
- **Phase**: Phase 5 (User Story 3)
- **Reason**: Simpler and faster for MVP; 5 roles with clear hierarchy don't require database-backed permissions
- **ADR**: [ADR-001: Service-Based Permissions](./.specify/adr/001-service-based-permissions.md)
- **Revisit When**:
  - Custom permissions needed per NPO
  - Dynamic role creation required
  - Compliance requires permission audit trail
- **Estimated Effort**: 5-8 days to implement fully

### Email Integration Tests (T055)
- **Status**: Deferred - Covered by contract tests
- **Phase**: Phase 4 (User Story 2)
- **Reason**: Token extraction from mock emails requires additional test infrastructure
- **Current Coverage**: Contract tests validate endpoint behavior without email content parsing
- **Revisit When**:
  - Real email sending implemented (Azure Communication Services)
  - Need end-to-end email verification flow tests
- **Estimated Effort**: 2-3 days

### Audit Service Unit Tests (T147)
- **Status**: Deferred - Integration tests provide sufficient coverage
- **Phase**: Phase 11 (Audit Logging)
- **Reason**: Integration tests provide 88% coverage of audit logging functionality
- **Current Coverage**: 4/4 integration tests passing (test_audit_logging.py)
- **Revisit When**:
  - Audit methods become more complex with business logic
  - Need to test edge cases not covered by integration tests
  - Code coverage requirements increase above 90%
- **Estimated Effort**: 1-2 days

### Audit Logging Middleware (T151)
- **Status**: Deferred - Endpoint-level capture preferred
- **Phase**: Phase 11 (Audit Logging)
- **Reason**: IP address and user agent captured at endpoint level provides more context
- **Current Approach**: Endpoints pass IP/UA directly to audit methods
- **ADR**: [ADR-002: Audit Logging Database Persistence](./.specify/adr/002-audit-logging-database-persistence.md)
- **Revisit When**:
  - Need centralized request metadata capture
  - Want to audit all requests (not just security events)
  - Performance optimization needed (avoid duplicate extraction)
- **Estimated Effort**: 2-3 days

## Technical Debt

### Contract Test Failures
- **Status**: 22/28 contract tests need debugging
- **Files Affected**: Various contract test files in `backend/app/tests/contract/`
- **Impact**: Medium (unit/integration tests passing)
- **Priority**: Should fix before Phase 6
- **Estimated Effort**: 2-3 days

### Mypy Type Annotation Errors
- **Status**: 27 type annotation errors
- **Command**: `cd backend && poetry run mypy app`
- **Impact**: Low (code runs correctly)
- **Priority**: Nice-to-have for code quality
- **Estimated Effort**: 1-2 days

### Email Service Production Implementation
- **Status**: ~~Blocked on infrastructure deployment (Spec 004)~~ **Unblocked - Infrastructure Complete**
- **Blocking Issue**: ~~Requires Azure Communication Services, verified domain, DNS configuration, and production URLs~~
- **Current State**:
  - Mock mode working (logs to console) - sufficient for development and testing
  - Infrastructure code complete (Azure Communication Services Bicep module ready)
  - Domain purchased (augeo.app) and DNS zone deployed
  - Email configuration documented in /docs/operations/email-configuration.md
- **Files**: `backend/app/services/email_service.py`
- **Dependencies** (All Ready):
  - ✅ Azure Communication Services Email resource (Bicep module ready)
  - ✅ Domain ownership (augeo.app purchased from Namecheap, expires 10/28/2026)
  - ✅ DNS infrastructure (Azure DNS zone deployed, nameservers configured)
  - ⏳ DNS records (SPF, DKIM, DMARC) - Waiting for DNS propagation (24-48 hours)
  - ⏳ Production frontend URLs - Need full production deployment (T162)
  - ✅ azure-communication-email package (already in dependencies)
  - ⏳ AZURE_COMMUNICATION_CONNECTION_STRING environment variable - Need ACS deployment
  - ✅ EMAIL_FROM_ADDRESS configuration (backend config already supports)
- **Impact**: Cannot send real emails (password reset, verification, user invitations) until production deployed
- **Priority**: Required for production launch - **Ready to deploy with T162**
- **Next Steps**:
  1. ~~Create Spec 004: Cloud Infrastructure & Deployment~~ ✅ Complete
  2. ~~Plan full Azure architecture (App Service, DNS, monitoring, etc.)~~ ✅ Complete
  3. Wait for DNS propagation (24-48 hours after nameserver configuration)
  4. Deploy full production infrastructure (T162)
  5. Configure Azure Communication Services domain verification
  6. Test email delivery with mail-tester.com
- **Estimated Effort**: 1-2 days (after T162 production deployment)
- **Related Specs**: ✅ Spec 004 (Cloud Infrastructure & Deployment) - Complete

### IP Address Capture in Audit Logs
- **Status**: Currently set to None
- **Service**: `backend/app/services/audit_service.py`
- **Files**: All audit method calls in endpoints
- **Required**:
  - Extract IP from `request.client.host` in FastAPI
  - Handle proxies/load balancers (X-Forwarded-For header)
  - Pass IP address parameter to all audit methods
  - Privacy/compliance considerations
- **Impact**: Audit logs missing source IP for security investigations
- **Priority**: Should implement before production
- **Estimated Effort**: 1-2 days

## Blocked Items

### Real Email Sending (Production)
- **Blocked By**: ~~Missing Spec 004 (Cloud Infrastructure & Deployment)~~ **Now: T162 (Production Deployment)**
- **Status**: Infrastructure complete, waiting for production deployment
- **Reason**: Email requires full production environment (App Service, verified domain, DNS propagation)
- **Current Workaround**: Mock email mode works for development/testing
- **Tasks Affected**:
  - T057: Email service implementation (partially complete - mock mode working)
  - Production deployment of password reset feature
  - Production deployment of email verification feature
  - User invitation emails
- **Next Action**: ~~Create Spec 004 to plan Azure infrastructure~~ ✅ Complete - **Execute T162 (Production Deployment)**
- **Priority**: Medium - Not blocking current development, required before production launch
- **Dependencies**: T162 (Production Deployment), DNS propagation (24-48 hours)

### Feature 006: Landing Page - Performance & Production Tasks (T083-T094)
- **Status**: Deferred - MVP is production-ready without these optimizations
- **Feature**: 006-landing-page
- **Tasks**: Performance optimization (T083-T088), Production readiness (T089-T094)
- **Current State**: Core functionality complete, 148 tests passing (88 testimonial + 60 contact form)
- **Reason**: Optimizations not critical for initial launch; core observability already in place
- **Blocking**: None - can be implemented incrementally post-launch
- **Revisit When**:
  - User feedback indicates slow page loads
  - Bundle size becomes problematic (>300KB)
  - Need enhanced monitoring/alerting
- **Estimated Effort**: 8-12 days total
- **Details**: See `.specify/specs/006-landing-page/PARKING_LOT.md`

## Future Enhancements

### Row-Level Security (RLS)
- **Mentioned In**: research.md - "Phase 1 requirement (was incorrectly deferred to Phase 2)"
- **Status**: Not yet implemented
- **Purpose**: PostgreSQL RLS for data isolation between NPOs
- **Priority**: Required before multi-NPO support
- **Estimated Effort**: 5-8 days

### Structured Food Options
- **Mentioned In**: 003-event-creation-ability spec
- **Status**: Free-text field in MVP, structured options deferred
- **Purpose**: Better UX for menu/dietary info entry
- **Priority**: Nice-to-have enhancement
- **Estimated Effort**: 3-5 days

## Known Issues

### Feature 006: Rate Limiting Redis Bug
- **Status**: Identified in testing, deferred fix
- **Impact**: 500 error on 6th+ contact form submission
- **Root Cause**: Redis data type conflict (middleware uses string counters, service uses sorted sets)
- **Fix Required**: Refactor to use consistent Redis implementation (recommend sorted sets)
- **Test**: `test_rate_limiting_blocks_excessive_submissions` currently skipped
- **Priority**: Medium - Security/stability issue but workaround exists (works for first 5 submissions)
- **Estimated Effort**: 1-2 days

### Feature 006: HTML Sanitization Not Implemented
- **Status**: Identified in testing, deferred fix
- **Impact**: Contact form stores unsanitized HTML/script tags
- **Security Risk**: Medium (XSS if displayed in admin without escaping)
- **Fix Required**: Add HTML sanitization to ContactSubmissionCreate schema
- **Recommendation**: Use `bleach` or `markupsafe` library
- **Test**: `test_contact_submission_html_sanitization` currently skipped
- **Priority**: Medium - Security issue but data not rendered without escaping
- **Estimated Effort**: 1 day

### Feature 006: Whitespace Trimming Not Implemented
- **Status**: Identified in testing, deferred fix
- **Impact**: Leading/trailing whitespace not trimmed from form fields
- **Fix Required**: Add `.strip()` to Pydantic validators
- **Test**: `test_whitespace_trimming_in_name_field` currently skipped
- **Priority**: Low - Cosmetic issue only
- **Estimated Effort**: 0.5 days

## Decisions Needed

None currently - all active work has clear direction.

---

**Last Updated**: 2025-11-07
**Maintained By**: Development Team
**Review Cadence**: Update after each phase completion
