# Development Utilities

Python helper scripts for common development tasks.

## Scripts

### test_email.py
Test email sending via Azure Communication Services.

**Usage:**
```bash
cd backend
poetry run python ../scripts/dev-utils/test_email.py <email_address>
```

**Example:**
```bash
cd backend
poetry run python ../scripts/dev-utils/test_email.py test@example.com
```

**What it does:**
- Initializes email service
- Sends a test verification email
- Reports success/failure
- Shows detailed error traces on failure

**Use cases:**
- Verify Azure Communication Services configuration
- Test email delivery before deploying
- Debug email sending issues
- Validate email templates

---

### accept_consent.py
Helper script to accept legal consent for a user account.

**Usage:**
```bash
cd backend
poetry run python ../scripts/dev-utils/accept_consent.py <email> [--password <password>]
```

**Example:**
```bash
cd backend
poetry run python ../scripts/dev-utils/accept_consent.py user@example.com --password "MyPassword123!"
```

**What it does:**
1. Logs in with provided credentials
2. Fetches current published legal documents (Terms of Service, Privacy Policy)
3. Accepts consent for both documents
4. Displays consent details

**Use cases:**
- Bypass consent flow during development
- Test with accounts that need consent
- Quickly unblock users during manual testing
- Automate test data setup

**Output includes:**
- Document versions accepted
- Acceptance timestamp
- Success/failure messages

## Requirements

- Python 3.11+
- Poetry (for dependency management)
- Backend environment configured (.env file)
- Backend server running (for accept_consent.py)

## Notes

- These scripts are for **development/testing only**
- Never use in production environments
- Requires proper environment configuration
- Backend must be running for API-based scripts
