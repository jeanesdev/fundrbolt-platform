# GitHub Secrets Setup for CI Testing

This guide explains how to configure GitHub Secrets to enable Azure service tests in CI.

## Required Secrets

Add these secrets to your GitHub repository at: `Settings > Secrets and variables > Actions`

### 1. Azure Communication Services (Email)

**Secret Name:** `AZURE_COMMUNICATION_CONNECTION_STRING_TEST`

**How to get it:**
1. Go to [Azure Portal](https://portal.azure.com)
2. Create or select an Azure Communication Services resource (use a **dev/test** instance, not production)
3. Navigate to: `Keys` in the left menu
4. Copy the **Connection String**
5. Format: `endpoint=https://your-acs.communication.azure.com/;accesskey=YOUR_ACCESS_KEY`

**Cost optimization:**
- Use the Free tier if available
- Set up rate limiting on the Azure side
- Consider using a separate resource for CI vs local development

### 2. Azure Blob Storage

**Secret Name:** `AZURE_STORAGE_CONNECTION_STRING_TEST`

**How to get it:**
1. Go to [Azure Portal](https://portal.azure.com)
2. Create or select a Storage Account (use a **dev/test** account, not production)
3. Navigate to: `Access keys` in the left menu
4. Copy **Connection string** from key1 or key2
5. Format: `DefaultEndpointsProtocol=https;AccountName=ACCOUNT_NAME;AccountKey=KEY;EndpointSuffix=core.windows.net`

**Secret Name:** `AZURE_STORAGE_ACCOUNT_NAME_TEST`

**Value:** The name of your storage account (e.g., `augeodevtest`)

**Cost optimization:**
- Use the cheapest storage tier (Hot tier, LRS replication)
- Set lifecycle management to delete blobs older than 7 days
- Use a separate container for CI tests: `ci-test-uploads`

## Running Tests WITH External Services

Once secrets are configured, you can enable these tests by removing the marker filters:

### Option 1: Enable All Tests in CI

**In `.github/workflows/backend-ci.yml` and `pr-checks.yml`:**

Change:
```yaml
run: poetry run pytest -v --tb=short -m "not requires_email and not requires_azure_storage"
```

To:
```yaml
run: poetry run pytest -v --tb=short
```

### Option 2: Enable Only Azure Storage Tests

```yaml
run: poetry run pytest -v --tb=short -m "not requires_email"
```

### Option 3: Enable Only Email Tests

```yaml
run: poetry run pytest -v --tb=short -m "not requires_azure_storage"
```

## Testing Locally with Azure Services

Set these environment variables in your `.env` file:

```bash
# Azure Communication Services (Email)
AZURE_COMMUNICATION_CONNECTION_STRING=endpoint=https://your-acs.communication.azure.com/;accesskey=YOUR_KEY

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=your-account;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net
AZURE_STORAGE_ACCOUNT_NAME=your-account
```

Then run all tests:
```bash
cd backend
poetry run pytest
```

## Rate Limiting Considerations

### Email Service Rate Limits

Azure Communication Services has strict rate limits:
- **Free tier**: Very limited sends per day
- **Paid tier**: Higher limits but still rate-limited

**Recommendations:**
- Use mocked email tests for most scenarios (see mocking guide below)
- Run email integration tests **only on main branch merges** or nightly
- Consider using a dedicated CI email resource with separate rate limits

### Storage Service Rate Limits

Azure Blob Storage has much higher rate limits and is safer to test in CI.

## Cost Estimates

**Monthly cost for CI testing resources:**
- Azure Communication Services (Free tier): $0
- Azure Communication Services (Pay-as-you-go): ~$1-5/month for CI
- Azure Blob Storage: ~$1-2/month (with lifecycle management)

**Total: $1-7/month for full CI testing**

## Alternative: Mock External Services

For zero-cost CI testing, see [MOCKING_GUIDE.md](./MOCKING_GUIDE.md) to learn how to mock Azure services in tests.

## Security Best Practices

1. ✅ **Never commit secrets to git**
2. ✅ **Use separate Azure resources for dev/test/prod**
3. ✅ **Rotate secrets regularly** (every 90 days)
4. ✅ **Use minimum required permissions** (ReadWrite for storage, Send for email)
5. ✅ **Monitor usage** - set up Azure Cost Alerts
6. ✅ **Delete old test data** - set up lifecycle policies

## Troubleshooting

### Tests Still Failing with 503 Errors

- Verify secrets are set in GitHub (check Settings > Secrets > Actions)
- Secret names must match exactly: `AZURE_STORAGE_CONNECTION_STRING_TEST`
- Re-run the workflow after adding secrets

### Tests Timing Out (Email)

- You've hit rate limits - wait 1 hour or use a different resource
- Consider using mocks for email tests instead

### Storage Tests Failing

- Check if storage account exists and is accessible
- Verify connection string format is correct
- Ensure container `uploads` exists (or code creates it)

## Next Steps

1. Add secrets to GitHub repository
2. Test by running CI workflow
3. Optionally: Set up mocking for faster tests (see MOCKING_GUIDE.md)
