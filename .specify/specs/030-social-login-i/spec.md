# Feature Specification: Social Login for Donor and Admin PWAs

**Feature Branch**: `[030-social-login-i]`
**Created**: 2026-03-03
**Status**: Draft
**Input**: User description: "social-login I want to be able to log in to the donor pwa and admin pwa using social platforms: Apple, Google, Facebook, Microsoft, etc as an alternative to email."

## Clarifications

### Session 2026-03-03

- Q: How should social identities be linked to existing accounts to avoid account takeover and duplicates? → A: Require one-time email login confirmation before linking an existing account; auto-create only when no matching account exists.
- Q: How should the system handle provider identities without a verified email? → A: Require a verified email before account access; if missing/unverified, collect and verify email in-app first.
- Q: Should admin social sign-in require an extra verification step? → A: Require step-up verification for admin social sign-ins only.
- Q: Should social sign-in auto-create accounts for donor and admin users equally? → A: Auto-create donor accounts only; admin accounts must already exist before social linking.
- Q: Should this feature include self-service provider linking/unlinking management? → A: No, keep this feature login-only and defer provider-management capabilities.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Sign in with a social account (Priority: P1)

As a donor or admin user, I can choose a social provider on the sign-in screen and complete login without entering an email/password so I can access the app faster.

**Why this priority**: This is the core business value requested and the primary adoption driver for the feature.

**Independent Test**: Can be fully tested by selecting each supported provider from both app login screens and confirming successful access to the correct post-login landing view.

**Acceptance Scenarios**:

1. **Given** a user is on the donor PWA login page, **When** they select a supported social provider and successfully authenticate, **Then** they are signed in and taken to the donor experience associated with their account.
2. **Given** a user is on the admin PWA login page, **When** they select a supported social provider and successfully authenticate, **Then** they must complete an admin step-up verification before being signed in to the admin experience permitted by their existing role.
3. **Given** a user does not want social login, **When** they view login options, **Then** email-based sign-in remains available.

---

### User Story 2 - Link and reuse existing accounts (Priority: P2)

As an existing user, I can use social login without losing my current account history, permissions, or profile context.

**Why this priority**: Preventing duplicate accounts and preserving existing permissions is critical for security, reporting continuity, and support overhead.

**Independent Test**: Can be tested by signing in socially with an identity that matches an existing account and verifying no duplicate account is created and access remains correct.

**Acceptance Scenarios**:

1. **Given** a social identity is already linked to an existing user account, **When** the user signs in with that social provider, **Then** the system signs them into the existing account instead of creating a duplicate.
2. **Given** a returning user previously used social login, **When** they sign in again with the same provider account, **Then** they are consistently mapped to the same platform user account.
3. **Given** a social identity appears to match an existing account that is not yet linked, **When** the user attempts first-time social sign-in, **Then** the user must complete one email-login confirmation before the social identity is linked.
4. **Given** no existing donor account matches the social identity, **When** the user completes social authentication in the donor PWA, **Then** a new donor account is created and linked to that social identity.
5. **Given** no existing admin account matches the social identity, **When** the user completes social authentication in the admin PWA, **Then** account access is denied and the user is instructed to use a pre-provisioned admin account.
6. **Given** a provider does not return a verified email, **When** the user attempts social sign-in, **Then** the user must verify an email address before account access is granted.

---

### User Story 3 - Handle failures clearly and safely (Priority: P3)

As a user, I receive clear next steps when social authentication fails or is canceled, so I can retry or choose another sign-in method.

**Why this priority**: Reliable failure handling reduces abandonment and support requests while maintaining trust.

**Independent Test**: Can be tested by canceling consent, denying permissions, or triggering provider unavailability and confirming user-facing guidance and fallback options.

**Acceptance Scenarios**:

1. **Given** a user cancels or denies social consent, **When** authentication returns to the app, **Then** the user sees a clear message and can retry or choose email login.
2. **Given** a provider is temporarily unavailable, **When** a user attempts social login, **Then** the user is informed and can select another provider or email login.

---

### Edge Cases

- A user starts social login in one app (donor/admin) but the linked account only has permissions for the other app.
- A social provider does not supply an email address or returns an unverified email claim; the user must complete in-app email verification before access.
- An admin user completes social authentication but fails step-up verification; admin access is denied and fallback sign-in options are shown.
- A user attempts social login with a provider account already linked to a different platform user.
- A user has multiple social providers linked and signs in with any of them.
- Provider callback is delayed or interrupted, causing expired authorization attempts.
- A user explicitly logs out and then immediately retries social login.
- An admin attempts first-time social sign-in without a pre-provisioned admin account.
- A user requests account deletion after social linking and expects social identity associations to be removed or anonymized per policy.
- Authentication logs or error payloads accidentally include sensitive social identity details or provider credentials.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST offer social login as an alternative sign-in method in both donor and admin PWAs.
- **FR-002**: System MUST support at least Apple, Google, Facebook, and Microsoft as selectable social providers at launch.
- **FR-003**: System MUST keep existing email-based authentication available for all users.
- **FR-004**: System MUST complete authentication only after the external provider confirms user identity.
- **FR-005**: System MUST map a successfully authenticated social identity to exactly one platform user account.
- **FR-006**: System MUST require a one-time email-login confirmation before linking a first-time social sign-in to an existing account.
- **FR-007**: System MUST preserve existing roles and permissions after social login so users only access authorized donor/admin areas.
- **FR-008**: System MUST allow previously linked social identities to be reused for subsequent sign-ins without relinking.
- **FR-009**: System MUST provide clear, user-friendly failure messages for canceled, failed, or unavailable social authentication attempts.
- **FR-010**: System MUST allow users to return to the login screen and choose a different sign-in method after any social authentication failure.
- **FR-011**: System MUST record auditable sign-in events for social authentication attempts and outcomes.
- **FR-012**: System MUST enforce account security controls applied to login events regardless of whether sign-in occurs via email or social provider.
- **FR-013**: System MUST auto-create and link a new donor account only when no existing donor account match is found.
- **FR-014**: System MUST prevent duplicate account creation when a matching existing account is identified.
- **FR-015**: System MUST require a verified email address before granting account access from social sign-in.
- **FR-016**: System MUST collect and verify an email in-app when the provider does not return a verified email claim.
- **FR-017**: System MUST require successful step-up verification before granting admin PWA access from social sign-in.
- **FR-018**: System MUST deny first-time admin social sign-in when no pre-existing admin account is found.
- **FR-019**: System MUST limit scope to social sign-in authentication flows; self-service provider linking, unlinking, and provider-management settings are out of scope for this feature.
- **FR-020**: System MUST follow data minimization for social sign-in by storing only claims required for identity mapping, authorization, auditing, and support operations.
- **FR-021**: System MUST NOT persist raw provider access tokens, refresh tokens, authorization codes, or equivalent provider secrets in application databases or logs.
- **FR-022**: System MUST apply defined retention and deletion rules to social-auth attempts, challenges, identity links, and audit records consistent with platform privacy obligations.
- **FR-023**: System MUST redact or mask sensitive social identity attributes in logs, monitoring payloads, and error messages.
- **FR-024**: System MUST present clear notice that social identity data is processed for authentication and account security, with links to applicable privacy/legal documents.

### Assumptions

- Existing donor and admin user accounts remain the single source of truth for roles and access rights.
- Users may choose either social login or email login each time they sign in.
- Social provider account data that is required for account mapping is available at the time of sign-in.
- Standard legal and consent obligations for sign-in are already defined in platform policies and continue to apply.
- Provider-management capabilities (link/unlink/switch social providers in account settings) will be defined in a separate follow-up feature.
- Existing platform GDPR consent, export, and deletion workflows apply to social authentication data.
- Social-auth operational records (attempts, pending link confirmations, and verification/step-up challenges) are retained for 90 days, then deleted or anonymized.
- Social identity links are deleted or anonymized within 30 days after approved account deletion requests unless legal hold is required.
- Social-auth audit events follow a 7-year retention window with redacted metadata.

### Key Entities *(include if feature involves data)*

- **User Account**: Existing donor/admin identity in the platform with role assignments and access scope.
- **Social Provider**: External identity source (Apple, Google, Facebook, Microsoft, others) selected during sign-in.
- **Social Identity Link**: Association between a provider-specific external identity and exactly one platform user account.
- **Authentication Event**: Timestamped record of login attempts and outcomes (success, canceled, failed, denied).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 85% of users who choose social login complete sign-in successfully on their first attempt.
- **SC-002**: Median end-to-end social sign-in completion time is 60 seconds or less from provider selection to authenticated app access.
- **SC-003**: Duplicate-account incidents attributable to social login remain below 1% of social sign-in attempts in the first 30 days after release.
- **SC-004**: At least 95% of successful social sign-ins route users to an experience matching their assigned access level (donor vs admin).
- **SC-005**: Social login accounts for at least 30% of total sign-ins across donor and admin PWAs within 60 days of launch.
- **SC-006**: 100% of sampled social-auth logs and error payloads in release validation show redacted sensitive identity values and no provider secret leakage.
- **SC-007**: 100% of social-auth data classes have documented retention/deletion handling and pass privacy review before production rollout.
