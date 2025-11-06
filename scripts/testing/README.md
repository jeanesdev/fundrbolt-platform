# Testing Scripts

Bash scripts for manual API testing and validation.

## Scripts

### test-invitation-api.sh
Tests the NPO member invitation API endpoints.

**Usage:**
```bash
./scripts/testing/test-invitation-api.sh
```

**What it tests:**
- GET `/npos/{npo_id}/members` - List members
- POST `/npos/{npo_id}/members` - Create invitation

**Configuration:**
Edit the script to set:
- `NPO_ID`: Your NPO ID
- `TOKEN`: Valid JWT token

**Debugging tips included for common errors (401, 403, 404, 405, 409).**

---

### test-branding-flow.sh
End-to-end test of NPO branding configuration.

**Usage:**
```bash
./scripts/testing/test-branding-flow.sh
```

**Prerequisites:**
- Backend server running on port 8000
- Frontend server running on port 5173
- Valid test user credentials

**What it tests:**
1. Server health checks
2. User authentication
3. NPO list retrieval
4. Current branding fetch
5. Branding update
6. Logo upload URL generation
7. Branding verification

**Outputs manual testing URLs at the end.**

---

### test-url-validation.sh
Information script for URL validation in branding forms.

**Usage:**
```bash
./scripts/testing/test-url-validation.sh
```

**What it covers:**
- URL validation rules
- Valid/invalid URL examples
- Social media link validation
- Manual testing instructions

**Use this as a reference for testing the branding form's URL validation.**

## Requirements

- `curl` - For API requests
- `jq` - For JSON parsing (optional but recommended)
- `python3` - For JSON processing

## Notes

- These scripts are for development/testing only
- Update configuration variables before running
- Check that servers are running before executing tests
