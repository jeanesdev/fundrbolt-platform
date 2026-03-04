# Data Model: Social Login for Donor and Admin PWAs

## 1) SocialProvider (reference)
Represents an enabled external identity provider exposed on sign-in screens.

### Fields
- `provider_key` (enum, required): `apple`, `google`, `facebook`, `microsoft`
- `display_name` (string, required)
- `enabled` (boolean, required)
- `supports_verified_email` (boolean, required)
- `sort_order` (integer, required)

### Validation Rules
- `provider_key` unique.
- Disabled providers are not shown and cannot initiate auth flow.
- Provider metadata excludes any secret credentials from persistent domain models.

---

## 2) SocialAuthAttempt
Represents one social authentication transaction from provider selection through completion/failure.

### Fields
- `id` (UUID)
- `provider_key` (enum, required)
- `app_context` (enum, required): `donor_pwa`, `admin_pwa`
- `state_token` (string, required, unique)
- `pkce_verifier_hash` (string, optional)
- `started_at` (timestamp, required)
- `completed_at` (timestamp, nullable)
- `result` (enum, required): `success`, `cancelled`, `failed`, `denied`, `needs_email_verification`, `needs_link_confirmation`, `needs_admin_step_up`
- `failure_code` (string, nullable)
- `client_ip` (string, nullable)
- `user_agent` (string, nullable)

### Validation Rules
- `state_token` must be single-use.
- Expired attempts cannot be completed.
- Provider authorization codes and transient verifier material must be treated as ephemeral and not stored after completion/failure.

### State Transitions
- `started -> success`
- `started -> cancelled`
- `started -> failed`
- `started -> denied`
- `started -> needs_email_verification -> success|failed`
- `started -> needs_link_confirmation -> success|failed`
- `started -> needs_admin_step_up -> success|failed`

---

## 3) SocialIdentityLink
Associates an external provider identity with exactly one platform user account.

### Fields
- `id` (UUID)
- `user_id` (UUID, required)
- `provider_key` (enum, required)
- `provider_subject` (string, required)
- `provider_email` (string, nullable)
- `provider_email_verified` (boolean, required)
- `linked_at` (timestamp, required)
- `linked_via_attempt_id` (UUID, required)
- `is_active` (boolean, required)

### Validation Rules
- Unique constraint on (`provider_key`, `provider_subject`).
- One provider subject cannot be linked to multiple users.
- Linking to existing user requires one-time email-login confirmation unless link already exists.
- Store only minimal provider attributes required for mapping/audit; no provider access or refresh tokens are persisted.

---

## 4) SocialPendingLinkConfirmation
Tracks first-time candidate matches that require user email-login confirmation before final link.

### Fields
- `id` (UUID)
- `attempt_id` (UUID, required)
- `candidate_user_id` (UUID, required)
- `provider_key` (enum, required)
- `provider_subject` (string, required)
- `expires_at` (timestamp, required)
- `confirmed_at` (timestamp, nullable)

### Validation Rules
- Pending confirmation expires automatically.
- Only one active pending confirmation per (`provider_key`, `provider_subject`).

---

## 5) EmailVerificationChallenge
Represents in-app email verification required when provider email is missing/unverified.

### Fields
- `id` (UUID)
- `attempt_id` (UUID, required)
- `email` (string, required)
- `verification_status` (enum, required): `pending`, `verified`, `expired`
- `issued_at` (timestamp, required)
- `verified_at` (timestamp, nullable)

### Validation Rules
- Access cannot be granted until `verification_status = verified`.
- Challenge cannot be reused once verified or expired.
- Expired challenges are purgeable per retention schedule.

---

## 6) AdminStepUpChallenge
Represents elevated verification required for admin social sign-ins.

### Fields
- `id` (UUID)
- `attempt_id` (UUID, required)
- `user_id` (UUID, required)
- `status` (enum, required): `pending`, `satisfied`, `failed`, `expired`
- `issued_at` (timestamp, required)
- `completed_at` (timestamp, nullable)

### Validation Rules
- Admin app session issuance requires `status = satisfied`.
- Failed/expired challenges deny admin access and return fallback login path.
- Challenge records are retained only for required audit/forensic windows then deleted or anonymized per policy.

---

## 7) AuthenticationEvent (audit)
Immutable audit event for social authentication lifecycle and decision points.

### Fields
- `id` (UUID)
- `event_type` (enum, required): `social_auth_started`, `social_auth_succeeded`, `social_auth_failed`, `social_auth_denied`, `social_link_created`, `social_link_blocked`, `admin_step_up_required`, `admin_step_up_failed`
- `user_id` (UUID, nullable)
- `attempt_id` (UUID, required)
- `provider_key` (enum, required)
- `app_context` (enum, required)
- `occurred_at` (timestamp, required)
- `metadata` (object, optional)

### Validation Rules
- Events are append-only.
- Sensitive provider tokens are never stored in `metadata`.
- Provider identifiers in event metadata are masked/redacted to minimum level needed for support diagnostics.

---

## Relationships
- One `SocialAuthAttempt` may lead to zero or one `SocialIdentityLink` creation.
- One `SocialAuthAttempt` may have one `SocialPendingLinkConfirmation` and/or one `EmailVerificationChallenge` and/or one `AdminStepUpChallenge`.
- One `UserAccount` can have many `SocialIdentityLink` records (across providers).
- Many `AuthenticationEvent` records belong to one `SocialAuthAttempt`.

## Retention & Deletion Rules
- `SocialAuthAttempt`, `SocialPendingLinkConfirmation`, `EmailVerificationChallenge`, and `AdminStepUpChallenge` follow short-lived operational retention and are removed/anonymized after policy-defined windows.
- `SocialIdentityLink` is deleted or anonymized when required by account deletion/privacy workflows, unless legally required audit references must be preserved.
- `AuthenticationEvent` follows immutable audit retention requirements and remains privacy-safe via redacted metadata.
