# Phase 0 Research: Social Login for Donor and Admin PWAs

## Decision 1: Provider launch scope
- Decision: Launch with Apple, Google, Facebook, and Microsoft as first-class social providers.
- Rationale: These providers are explicitly required in the feature spec and cover broad user adoption across donor and admin audiences.
- Alternatives considered:
  - Launch with only Google/Microsoft first (rejected: does not satisfy explicit launch requirement)
  - Defer Apple/Facebook to later phase (rejected: creates requirement gap)

## Decision 2: Existing-account linking safety
- Decision: For first-time social sign-in that appears to match an existing account, require one-time email-login confirmation before linking.
- Rationale: Reduces account takeover and incorrect merges while preserving a mostly frictionless recurring sign-in path.
- Alternatives considered:
  - Auto-link purely by email match (rejected: higher takeover/mis-link risk)
  - Admin-manual linking only (rejected: too much operational friction)

## Decision 3: Unverified or missing provider email handling
- Decision: Require verified email before granting account access; if provider does not return verified email, collect and verify email in-app first.
- Rationale: Preserves identity assurance and supports safe account mapping for both donor and admin users.
- Alternatives considered:
  - Allow access without verified email (rejected: weak identity confidence)
  - Block all such sign-ins with no recovery path (rejected: poor UX)

## Decision 4: Admin assurance policy
- Decision: Require step-up verification for admin social sign-ins only.
- Rationale: Admin sessions carry elevated risk and need additional assurance, while donor flow remains lower-friction.
- Alternatives considered:
  - No step-up anywhere (rejected: insufficient protection for privileged access)
  - Step-up for all users (rejected: unnecessary donor friction)

## Decision 5: Account provisioning rules by app type
- Decision: Auto-create donor accounts on first social sign-in when no match exists; deny first-time admin social sign-in if no pre-provisioned admin account exists.
- Rationale: Supports donor onboarding speed while preserving admin access governance.
- Alternatives considered:
  - Auto-create both donor and admin accounts (rejected: risky for admin access control)
  - No auto-create for any audience (rejected: unnecessary donor onboarding friction)

## Decision 6: Feature boundary (YAGNI)
- Decision: Keep this feature login-only; defer provider-management actions (link/unlink/switch provider in settings) to a follow-up feature.
- Rationale: Matches clarified scope and reduces delivery risk.
- Alternatives considered:
  - Include full provider management in current feature (rejected: scope expansion not requested)

## Decision 7: Contract pattern
- Decision: Model social auth as explicit REST endpoints under `/api/v1/auth/social/*`, including provider discovery, auth initiation, callback exchange, and admin step-up verification completion.
- Rationale: Aligns with existing REST-first platform architecture and makes role/security/error behavior contract-testable.
- Alternatives considered:
  - Frontend-only social SDK integration without backend contracts (rejected: weak backend control/auditability)
  - Monolithic single endpoint for all social flows (rejected: lower clarity and weaker validation boundaries)

## Decision 8: Observability and audit requirements
- Decision: Log social auth attempt, success, deny, and failure outcomes as auditable authentication events with actor/session context.
- Rationale: Required by specification and constitution principles for security/privacy and production-grade operations.
- Alternatives considered:
  - Rely only on provider logs (rejected: incomplete platform audit trail)

## Decision 9: Performance/SLO posture for this feature
- Decision: Preserve social sign-in median completion <=60 seconds and first-attempt success >=85%, with explicit monitoring of provider failure/cancel rates.
- Rationale: Directly maps to measurable outcomes in the feature spec and ensures operational readiness.
- Alternatives considered:
  - No explicit social auth SLO targets (rejected: weak acceptance validation)

## Decision 10: PII minimization and secret handling
- Decision: Persist only minimal provider claims required for identity mapping/security audit and explicitly prohibit storage/logging of raw provider secrets.
- Rationale: Reduces breach impact and aligns with platform privacy/security constitution.
- Alternatives considered:
  - Persist broad provider profile payloads for convenience (rejected: unnecessary data collection)

## Decision 11: Retention/deletion alignment
- Decision: Apply policy-bound retention windows to social auth attempts/challenges and integrate social link handling with existing privacy deletion workflows.
- Rationale: Ensures social auth data participates in GDPR-style lifecycle controls.
- Alternatives considered:
  - Keep all social auth artifacts indefinitely (rejected: non-minimal and privacy-risky)

## Decision 12: Transparency and redaction
- Decision: Require user-facing notice of social identity processing and enforce log/error redaction for identity attributes.
- Rationale: Improves compliance posture, user trust, and operational safety.
- Alternatives considered:
  - Rely solely on generic platform privacy policy text without auth-flow notice (rejected: weak transparency at point of data collection)
