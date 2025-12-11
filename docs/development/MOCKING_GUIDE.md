# Mocking External Services in Tests

This guide shows how to mock Azure services (Blob Storage, Email) to run tests without external dependencies.

## Why Mock External Services?

**Benefits:**
- ✅ **Faster tests** - No network calls
- ✅ **No cost** - No Azure API usage
- ✅ **Deterministic** - Predictable results
- ✅ **No rate limits** - Run tests unlimited times
- ✅ **Offline testing** - Works without internet
- ✅ **Better CI/CD** - No external service configuration needed

**When to use real services:**
- E2E tests (run less frequently)
- Production deployment validation
- Performance/load testing

## Mocking Strategy

We use Python's `unittest.mock` library to mock Azure SDK clients at the service layer.

### Pattern 1: Mock at Service Initialization

**Best for:** Most tests - mock the Azure client before it's used

### Pattern 2: Mock at API Call Level

**Best for:** Testing error handling and edge cases

## Example: Mocking Azure Blob Storage

### Current Test (Requires Azure)

```python
# app/tests/contract/test_sponsors_api.py
async def test_create_sponsor_with_default_logo_size(
    npo_admin_client: AsyncClient,
    test_event: Any,
) -> None:
    """Test sponsor creation defaults logo_size to 'large'."""
    payload = {
        "name": "Acme Corporation",
        "logo_file_name": "acme-logo.png",
        "logo_file_type": "image/png",
        "logo_file_size": 50000,
    }

    # This fails in CI without Azure Storage credentials
    response = await npo_admin_client.post(
        f"/api/v1/events/{test_event.id}/sponsors",
        json=payload,
    )

    assert response.status_code == 201
```

### Refactored Test (Mocked)

```python
# app/tests/contract/test_sponsors_api.py
from unittest.mock import AsyncMock, MagicMock, patch

@patch('app.services.file_upload_service.BlobServiceClient')
async def test_create_sponsor_with_default_logo_size(
    mock_blob_client: MagicMock,
    npo_admin_client: AsyncClient,
    test_event: Any,
) -> None:
    """Test sponsor creation defaults logo_size to 'large'."""
    # Mock the blob service client
    mock_container_client = MagicMock()
    mock_blob_client.from_connection_string.return_value.get_blob_client.return_value = mock_container_client

    # Mock SAS token generation
    with patch('app.services.file_upload_service.generate_blob_sas') as mock_sas:
        mock_sas.return_value = "sv=2022-11-02&ss=b&srt=o&sp=w&se=2024-12-01T12:00:00Z&sig=MOCK_SIG"

        payload = {
            "name": "Acme Corporation",
            "logo_file_name": "acme-logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        assert response.status_code == 201
        data = response.json()

        # Verify sponsor data
        assert "sponsor" in data
        sponsor = data["sponsor"]
        assert sponsor["name"] == "Acme Corporation"
        assert sponsor["logo_size"] == "large"

        # Verify upload_url was generated
        assert "upload_url" in data
        assert "MOCK_SIG" in data["upload_url"]
```

## Example: Mocking Email Service

### Current Test (Requires Azure Communication Services)

```python
# app/tests/unit/test_contact_service.py
async def test_create_submission_success(
    contact_service: ContactService,
    db_session: AsyncSession,
    mock_request: Request,
) -> None:
    """Test creating a contact submission."""
    data = ContactSubmissionCreate(
        sender_name="Test User",
        sender_email="test@example.com",
        subject="Test Subject",
        message="Test message content",
    )

    # This spawns background task that calls Azure Communication Services
    result = await contact_service.create_submission(data, mock_request)

    assert result.sender_name == "Test User"
```

### Already Mocked! ✅

This test already uses a mocked `EmailService` via the `mock_email_service` fixture:

```python
@pytest.fixture
def mock_email_service() -> MagicMock:
    """Create a mock EmailService."""
    mock_service = MagicMock(spec=EmailService)
    mock_service._send_email_with_retry = AsyncMock(return_value=None)
    return mock_service
```

**The issue:** Background tasks from `asyncio.create_task()` interfere with teardown.

**Solution:** Wait for background tasks to complete:

```python
async def test_create_submission_success(
    contact_service: ContactService,
    db_session: AsyncSession,
    mock_request: Request,
) -> None:
    """Test creating a contact submission."""
    data = ContactSubmissionCreate(
        sender_name="Test User",
        sender_email="test@example.com",
        subject="Test Subject",
        message="Test message content",
    )

    result = await contact_service.create_submission(data, mock_request)

    assert result.sender_name == "Test User"

    # Wait for background task to complete
    await asyncio.sleep(0.1)  # Allow task to start and finish
```

## Creating Reusable Mock Fixtures

### Blob Storage Mock Fixture

```python
# app/tests/conftest.py

@pytest.fixture
def mock_blob_storage():
    """Mock Azure Blob Storage client."""
    with patch('app.services.file_upload_service.BlobServiceClient') as mock_blob_client, \
         patch('app.services.file_upload_service.generate_blob_sas') as mock_sas:

        # Configure mock blob client
        mock_container_client = MagicMock()
        mock_blob_instance = mock_blob_client.from_connection_string.return_value
        mock_blob_instance.get_blob_client.return_value = mock_container_client

        # Configure mock SAS token
        mock_sas.return_value = "sv=2022-11-02&ss=b&srt=o&sp=w&se=2099-12-31T23:59:59Z&sig=MOCK_SIGNATURE"

        yield {
            'blob_client': mock_blob_client,
            'container_client': mock_container_client,
            'sas': mock_sas,
        }
```

### Using the Fixture

```python
async def test_with_mocked_storage(
    mock_blob_storage: dict,
    npo_admin_client: AsyncClient,
    test_event: Any,
) -> None:
    """Test sponsor creation with mocked storage."""
    payload = {
        "name": "Test Sponsor",
        "logo_file_name": "logo.png",
        "logo_file_type": "image/png",
        "logo_file_size": 50000,
    }

    response = await npo_admin_client.post(
        f"/api/v1/events/{test_event.id}/sponsors",
        json=payload,
    )

    assert response.status_code == 201

    # Verify blob client was called
    mock_blob_storage['blob_client'].from_connection_string.assert_called_once()
```

## Conditional Mocking: Use Real Services When Available

```python
# app/tests/conftest.py

@pytest.fixture
def blob_storage_service():
    """Provide blob storage - real if credentials exist, mocked otherwise."""
    storage_conn_str = os.getenv('AZURE_STORAGE_CONNECTION_STRING')

    if storage_conn_str:
        # Use real Azure Storage
        from app.services.file_upload_service import FileUploadService
        from app.core.config import get_settings
        yield FileUploadService(get_settings())
    else:
        # Use mock
        with patch('app.services.file_upload_service.BlobServiceClient') as mock:
            # ... configure mock ...
            yield mock
```

## Testing Error Scenarios with Mocks

### Simulating Azure Storage Failures

```python
from azure.core.exceptions import AzureError

async def test_sponsor_creation_handles_storage_error(
    npo_admin_client: AsyncClient,
    test_event: Any,
) -> None:
    """Test graceful handling when Azure Storage is down."""
    with patch('app.services.file_upload_service.BlobServiceClient') as mock_blob:
        # Simulate Azure error
        mock_blob.from_connection_string.side_effect = AzureError("Storage unavailable")

        payload = {
            "name": "Test Sponsor",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        # Should return 503 Service Unavailable
        assert response.status_code == 503
```

### Simulating Email Failures

```python
async def test_contact_submission_handles_email_error(
    contact_service: ContactService,
    mock_email_service: MagicMock,
    db_session: AsyncSession,
    mock_request: Request,
) -> None:
    """Test contact submission when email service fails."""
    # Simulate email failure
    mock_email_service._send_email_with_retry.side_effect = Exception("Email service down")

    data = ContactSubmissionCreate(
        sender_name="Test User",
        sender_email="test@example.com",
        subject="Test",
        message="Test message",
    )

    # Submission should still succeed (email sent async)
    result = await contact_service.create_submission(data, mock_request)

    assert result.sender_name == "Test User"

    # Wait for background task
    await asyncio.sleep(0.1)

    # Check that retry was attempted
    assert mock_email_service._send_email_with_retry.call_count == 3  # Max retries
```

## Migrating Existing Tests to Use Mocks

### Step 1: Identify Tests That Need Azure Services

```bash
# Find all tests marked with requires_azure_storage
cd backend
grep -r "@pytest.mark.requires_azure_storage" app/tests/

# Find all tests marked with requires_email
grep -r "@pytest.mark.requires_email" app/tests/
```

### Step 2: Add Mock Fixtures

Add the `mock_blob_storage` fixture to `conftest.py` (shown above).

### Step 3: Update Test Signatures

```python
# Before
async def test_create_sponsor(
    npo_admin_client: AsyncClient,
    test_event: Any,
) -> None:

# After
async def test_create_sponsor(
    mock_blob_storage: dict,  # Add this
    npo_admin_client: AsyncClient,
    test_event: Any,
) -> None:
```

### Step 4: Remove Pytest Markers

```python
# Before
@pytest.mark.requires_azure_storage
async def test_create_sponsor(...):

# After (no marker needed)
async def test_create_sponsor(...):
```

### Step 5: Update Assertions

Optionally verify mock was called:

```python
# Verify blob client was used
mock_blob_storage['blob_client'].from_connection_string.assert_called()

# Verify SAS token was generated
mock_blob_storage['sas'].assert_called_once()
```

## Best Practices

1. **✅ Mock at the service boundary** - Mock external SDK clients, not internal methods
2. **✅ Use fixtures for common mocks** - Reduce code duplication
3. **✅ Test error paths** - Simulate failures with `side_effect`
4. **✅ Verify mock calls** - Ensure code actually uses the mocked service
5. **✅ Keep some E2E tests** - Run a small set against real services (less frequently)
6. **✅ Document what's mocked** - Clear test docstrings
7. **❌ Don't over-mock** - Mock external dependencies, not internal logic
8. **❌ Don't test the mock** - Focus on your code's behavior

## Running Tests

### Run all tests (with mocks):
```bash
poetry run pytest
```

### Run only mocked tests (skip real Azure services):
```bash
poetry run pytest -m "not requires_azure_storage and not requires_email"
```

### Run E2E tests with real services (requires credentials):
```bash
export AZURE_STORAGE_CONNECTION_STRING="your-connection-string"
export AZURE_COMMUNICATION_CONNECTION_STRING="your-connection-string"
poetry run pytest -m "requires_azure_storage or requires_email"
```

## Next Steps

See [test_sponsors_api_mocked.py](../backend/app/tests/contract/test_sponsors_api_mocked.py) for a complete example of mocked sponsor tests.
