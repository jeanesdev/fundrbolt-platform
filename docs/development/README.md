# CI Testing with External Services - Quick Start

This directory contains guides for running tests in CI that depend on Azure services.

## Two Approaches

### Approach 1: Use Real Azure Services ☁️

**Pros:** Tests real integration, catches service-specific issues
**Cons:** Costs money, requires secrets management, can hit rate limits

**Quick Start:**
1. Read [CI_SECRETS_SETUP.md](./CI_SECRETS_SETUP.md)
2. Create test Azure resources (Storage + Communication Services)
3. Add secrets to GitHub: Settings > Secrets > Actions
4. Remove test marker filters in `.github/workflows/*.yml`

**Monthly cost:** ~$1-7

---

### Approach 2: Use Mocks (Recommended for CI) 🎭

**Pros:** Free, fast, no external dependencies, works offline
**Cons:** Doesn't test real Azure integration

**Quick Start:**
1. Read [MOCKING_GUIDE.md](./MOCKING_GUIDE.md)
2. Use existing `mock_azure_storage` fixture in tests
3. See [test_sponsors_api_mocked_example.py](../../backend/app/tests/contract/test_sponsors_api_mocked_example.py)
4. Tests run in CI without any configuration!

**Monthly cost:** $0

---

## Current CI Configuration

**Tests running:** 601 tests
**Tests skipped:** 94 tests (34 email + 60 Azure Storage)

**Skipped because:**
- `@pytest.mark.requires_email` - Needs Azure Communication Services
- `@pytest.mark.requires_azure_storage` - Needs Azure Blob Storage

To run ALL tests in CI, you need to either:
1. Configure GitHub Secrets (Approach 1), OR
2. Refactor tests to use mocks (Approach 2)

---

## Recommended Strategy

**For most projects:**
- ✅ Use **mocks** for CI (fast, free, deterministic)
- ✅ Keep some E2E tests with **real services** (run nightly or on release)
- ✅ Use **real services** for local development/manual testing

**Best of both worlds:**
```python
# Conditional mocking - uses real Azure if credentials exist
@pytest.fixture
def storage_service():
    if os.getenv('AZURE_STORAGE_CONNECTION_STRING'):
        # Use real Azure
        return FileUploadService(get_settings())
    else:
        # Use mock
        return mock_storage_fixture()
```

---

## Quick Reference

| Task | Guide | Time |
|------|-------|------|
| Set up Azure secrets in GitHub | [CI_SECRETS_SETUP.md](./CI_SECRETS_SETUP.md) | 15 min |
| Learn how to mock Azure services | [MOCKING_GUIDE.md](./MOCKING_GUIDE.md) | 30 min |
| See mocked test examples | [test_sponsors_api_mocked_example.py](../../backend/app/tests/contract/test_sponsors_api_mocked_example.py) | 10 min |
| Convert a test to use mocks | [MOCKING_GUIDE.md#migrating-existing-tests](./MOCKING_GUIDE.md#migrating-existing-tests-to-use-mocks) | 5 min/test |

---

## Getting Help

**Common Issues:**

1. **503 errors in CI** → Azure Storage not configured
   - Solution: Add secrets OR use mocks

2. **Email rate limit timeouts** → Azure Communication Services rate limits
   - Solution: Use mocks for email tests (already done for most tests)

3. **Tests pass locally but fail in CI** → Missing environment variables
   - Solution: Check `.github/workflows/*.yml` has correct env vars

4. **Want to test Azure integration** → Need real credentials
   - Solution: Follow [CI_SECRETS_SETUP.md](./CI_SECRETS_SETUP.md)

---

## Files

```
docs/development/
├── README.md (this file)
├── CI_SECRETS_SETUP.md          # How to configure GitHub Secrets
└── MOCKING_GUIDE.md              # How to mock Azure services

backend/app/tests/
├── conftest.py                   # Contains mock_azure_storage fixture
└── contract/
    ├── test_sponsors_api.py              # Original (needs Azure Storage)
    └── test_sponsors_api_mocked_example.py  # Mocked version (works in CI)
```

---

**Start here:**
- Want to spend $5/month? → [CI_SECRETS_SETUP.md](./CI_SECRETS_SETUP.md)
- Want free CI tests? → [MOCKING_GUIDE.md](./MOCKING_GUIDE.md)
