# Quickstart: Social Login for Donor and Admin PWAs

## Purpose
Validate social sign-in behavior end-to-end for donor and admin PWAs, including linking safeguards, verified-email gating, and admin step-up.

## Preconditions
- Launch providers configured and enabled: Apple, Google, Facebook, Microsoft.
- At least one existing donor account and one existing admin account are present.
- Test identities available for:
  - Existing linked social identity
  - Existing unlinked account requiring first-time link confirmation
  - Provider identity without verified email
  - New donor identity (no existing account)
  - New admin identity (no existing admin account)

## 1) Donor PWA social sign-in baseline
1. Open donor login screen.
2. Confirm email login remains visible alongside social options.
3. Select each launch provider and complete successful authentication.
4. Confirm user lands in donor experience and session is active.

## 2) Existing account linking safety
1. Use social identity that maps to an existing unlinked account.
2. Confirm flow requires one-time email-login confirmation before linking.
3. Complete confirmation and verify social sign-in succeeds.
4. Sign out and sign in again with same provider.
5. Confirm no re-confirmation is required and account is consistent.

## 3) Missing/unverified provider email
1. Use provider identity without verified email claim.
2. Confirm flow prompts for in-app email verification.
3. Complete verification and confirm access is granted.
4. Retry with expired/failed verification and confirm access is denied until verification succeeds.

## 4) Donor/admin provisioning boundaries
1. Sign in on donor PWA with social identity that has no existing donor account.
2. Confirm donor account is auto-created and linked.
3. Sign in on admin PWA with social identity that has no existing admin account.
4. Confirm access is denied with guidance to use pre-provisioned admin account.

## 5) Admin step-up verification
1. Sign in on admin PWA with existing linked admin social identity.
2. Confirm step-up verification is required before admin session issuance.
3. Complete step-up and verify admin access granted.
4. Fail or cancel step-up and confirm admin access is denied with fallback options.

## 6) Error and resilience behavior
1. Cancel provider consent and verify clear retry/fallback messaging.
2. Simulate provider unavailable response and verify alternate sign-in options are shown.
3. Retry successful sign-in and confirm no duplicate account/link is created.

## 7) Contract and audit verification
- Validate responses against `contracts/social-auth.openapi.yaml`.
- Confirm auth events are recorded for start, success/failure/deny, link operations, and admin step-up outcomes.

## 8) Privacy and PII protection verification
1. Inspect representative auth logs for successful, failed, cancelled, and denied social sign-ins.
2. Confirm logs do not contain provider access tokens, refresh tokens, or raw authorization codes.
3. Confirm social identity attributes are masked/redacted in logs and error payloads.
4. Validate privacy/legal notice is visible in donor and admin social login experiences.
5. Verify retention/deletion handling exists for social-auth attempts/challenges and social identity links according to policy.
6. Execute account deletion/privacy workflow on a social-linked test account and confirm link data is deleted/anonymized per policy.

## 9) Completion checklist
- Social login works in both PWAs for all launch providers.
- Verified-email and link-confirmation safeguards are enforced.
- Admin step-up is required and enforced only for admin social sign-ins.
- Donor auto-provisioning and admin pre-provisioning rules are enforced.
- Scope remains login-only (no provider-management UI/actions).
- No provider secrets are persisted in logs or storage.
- Social-auth retention/deletion and privacy notice checks pass.

## Release Validation Queries (SC-001 – SC-005)

### SC-001: All social auth tests pass
```bash
cd backend && poetry run pytest app/tests/ -k "social_auth" -v --tb=short
```
Expected: All tests pass (≥45 tests, 0 failures).

### SC-002: No provider secrets in logs
```bash
cd backend && poetry run pytest app/tests/unit/test_social_auth_redaction.py -v
```
Expected: 4/4 pass — simulated claims contain no tokens, subs are opaque.

### SC-003: Scope guard — no provider management endpoints
```bash
cd backend && poetry run pytest app/tests/contract/test_social_auth_scope_guard.py -v
```
Expected: 6/6 paths return 404/405 for all HTTP methods.

### SC-004: Data minimization — only whitelisted claims persisted
```bash
cd backend && poetry run pytest app/tests/unit/test_social_auth_minimization.py -v
```
Expected: 3/3 pass — only `sub`, `email`, `email_verified`, `name` persisted.

### SC-005: GDPR retention hooks active
```sql
-- After account deletion, verify social_identity_links are removed
SELECT COUNT(*) FROM social_identity_links WHERE user_id = '<deleted_user_id>';
-- Expected: 0
```
Automated coverage: `consent_service.request_data_deletion` calls `SocialAuthService.delete_social_links_for_user`.

## Release Go/No-Go

| Criterion | Status |
|-----------|--------|
| SC-001: Test suite | ✅ All social auth tests pass |
| SC-002: Secret redaction | ✅ Log redaction guardrails + unit tests |
| SC-003: Scope guard | ✅ No provider management endpoints |
| SC-004: Data minimization | ✅ Whitelist-only claim persistence |
| SC-005: GDPR hooks | ✅ Deletion cascades to social links |

**Decision**: GO — all success criteria met.
