"""Unit tests for ContactService."""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, Mock

import pytest
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact_submission import ContactSubmission, SubmissionStatus
from app.schemas.contact import ContactSubmissionCreate
from app.services.contact_service import ContactService
from app.services.email_service import EmailService


@pytest.fixture
def mock_email_service() -> MagicMock:
    """Create a mock EmailService."""
    mock_service = MagicMock(spec=EmailService)
    mock_service._send_email_with_retry = AsyncMock(return_value=None)
    return mock_service


@pytest.fixture
def contact_service(db_session: AsyncSession, mock_email_service: MagicMock) -> ContactService:
    """Create ContactService instance with mocked email service."""
    return ContactService(db_session, mock_email_service)


@pytest.fixture
def mock_request() -> Request:
    """Create a mock FastAPI Request object."""
    request = MagicMock(spec=Request)
    client = Mock()
    client.host = "192.168.1.1"
    request.client = client
    request.headers = MagicMock()
    request.headers.get = Mock(return_value=None)
    return request


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.skip(reason="Background task interferes with session teardown - needs refactoring")
async def test_create_submission_success(
    contact_service: ContactService,
    db_session: AsyncSession,
    mock_request: Request,
) -> None:
    """Test creating a contact submission successfully."""
    data = ContactSubmissionCreate(
        sender_name="Test User",
        sender_email="test@example.com",
        subject="Test Subject",
        message="Test message content",
    )

    result = await contact_service.create_submission(data, mock_request)

    assert result.sender_name == "Test User"
    assert result.sender_email == "test@example.com"
    assert result.subject == "Test Subject"
    assert result.status == SubmissionStatus.PENDING
    assert result.id is not None


@pytest.mark.asyncio
@pytest.mark.integration
async def test_create_submission_stores_in_database(
    contact_service: ContactService,
    db_session: AsyncSession,
    mock_request: Request,
) -> None:
    """Test that submission is stored in database."""
    data = ContactSubmissionCreate(
        sender_name="Database Test",
        sender_email="dbtest@example.com",
        subject="DB Test",
        message="Testing database storage",
    )

    result = await contact_service.create_submission(data, mock_request)

    # Query database directly
    db_submission = await db_session.get(ContactSubmission, result.id)
    assert db_submission is not None
    await db_session.refresh(db_submission)
    assert db_submission.sender_name == "Database Test"  # type: ignore[comparison-overlap]
    assert db_submission.sender_email == "dbtest@example.com"  # type: ignore[comparison-overlap]
    assert db_submission.status == SubmissionStatus.PENDING  # type: ignore[comparison-overlap]


@pytest.mark.asyncio
async def test_get_client_ip_from_direct_connection(
    contact_service: ContactService,
) -> None:
    """Test extracting IP from direct connection."""
    mock_request = MagicMock(spec=Request)
    client = Mock()
    client.host = "203.0.113.45"
    mock_request.client = client
    mock_request.headers = MagicMock()
    mock_request.headers.get = Mock(return_value=None)

    ip = contact_service._get_client_ip(mock_request)

    assert ip == "203.0.113.45"


@pytest.mark.asyncio
async def test_get_client_ip_from_x_forwarded_for(
    contact_service: ContactService,
) -> None:
    """Test extracting IP from X-Forwarded-For header (proxy scenario)."""
    mock_request = MagicMock(spec=Request)
    client = Mock()
    client.host = "10.0.0.1"
    mock_request.client = client
    mock_request.headers = MagicMock()
    mock_request.headers.get = Mock(return_value="203.0.113.45, 198.51.100.178")

    ip = contact_service._get_client_ip(mock_request)

    # Should return first IP in chain (original client)
    assert ip == "203.0.113.45"


@pytest.mark.asyncio
async def test_get_client_ip_handles_unknown(
    contact_service: ContactService,
) -> None:
    """Test handling case where client IP is unknown."""
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {}
    mock_request.client = None

    ip = contact_service._get_client_ip(mock_request)

    assert ip == "unknown"


@pytest.mark.asyncio
async def test_send_email_notification_success(
    contact_service: ContactService,
    mock_email_service: MagicMock,
) -> None:
    """Test sending email notification successfully."""
    submission = ContactSubmission(
        id=uuid.uuid4(),
        sender_name="Test User",
        sender_email="test@example.com",
        subject="Test Subject",
        message="Test message",
        ip_address="192.168.1.1",
        status=SubmissionStatus.PENDING,
    )

    await contact_service.send_email_notification(submission)

    # Verify email service was called
    mock_email_service._send_email_with_retry.assert_called_once()
    call_args = mock_email_service._send_email_with_retry.call_args

    # Verify email parameters
    assert call_args.kwargs["to_email"] == "support@fundrbolt.com"
    assert "New Contact Form Submission" in call_args.kwargs["subject"]
    assert "Test Subject" in call_args.kwargs["subject"]
    assert "Test User" in call_args.kwargs["body"]
    assert "test@example.com" in call_args.kwargs["body"]
    assert call_args.kwargs["email_type"] == "contact_submission"


@pytest.mark.asyncio
async def test_send_email_notification_includes_all_fields(
    contact_service: ContactService,
    mock_email_service: MagicMock,
) -> None:
    """Test that email notification includes all submission fields."""
    submission = ContactSubmission(
        id=uuid.uuid4(),
        sender_name="John Doe",
        sender_email="john@example.com",
        subject="Important Question",
        message="This is my question about the platform.",
        ip_address="203.0.113.45",
        status=SubmissionStatus.PENDING,
    )

    await contact_service.send_email_notification(submission)

    call_args = mock_email_service._send_email_with_retry.call_args
    body = call_args.kwargs["body"]

    # Verify all fields present in email body
    assert "John Doe" in body
    assert "john@example.com" in body
    assert "Important Question" in body
    assert "This is my question about the platform." in body
    assert str(submission.id) in body
    assert "203.0.113.45" in body


@pytest.mark.asyncio
async def test_send_email_notification_handles_failure(
    contact_service: ContactService,
    mock_email_service: MagicMock,
) -> None:
    """Test that email notification handles failures gracefully."""
    mock_email_service._send_email_with_retry.side_effect = Exception("SMTP error")

    submission = ContactSubmission(
        id=uuid.uuid4(),
        sender_name="Test User",
        sender_email="test@example.com",
        subject="Test",
        message="Test",
        ip_address="192.168.1.1",
        status=SubmissionStatus.PENDING,
    )

    # Should raise exception (caller handles it)
    with pytest.raises(Exception, match="SMTP error"):
        await contact_service.send_email_notification(submission)


@pytest.mark.asyncio
@pytest.mark.integration
async def test_send_notification_with_retry_success_first_attempt(
    contact_service: ContactService,
    mock_email_service: MagicMock,
    db_session: AsyncSession,
) -> None:
    """Test retry logic succeeds on first attempt."""
    submission = ContactSubmission(
        id=uuid.uuid4(),
        sender_name="Test User",
        sender_email="test@example.com",
        subject="Test",
        message="Test message",
        ip_address="192.168.1.1",
        status=SubmissionStatus.PENDING,
    )
    db_session.add(submission)
    await db_session.commit()

    await contact_service._send_notification_with_retry(submission)

    # Verify email sent
    mock_email_service._send_email_with_retry.assert_called_once()

    # Verify status updated to PROCESSED
    await db_session.refresh(submission)
    assert submission.status == SubmissionStatus.PROCESSED  # type: ignore[comparison-overlap]


@pytest.mark.asyncio
@pytest.mark.integration
async def test_send_notification_with_retry_succeeds_after_failures(
    contact_service: ContactService,
    mock_email_service: MagicMock,
    db_session: AsyncSession,
) -> None:
    """Test retry logic succeeds after some failures."""
    submission = ContactSubmission(
        id=uuid.uuid4(),
        sender_name="Test User",
        sender_email="test@example.com",
        subject="Test",
        message="Test message",
        ip_address="192.168.1.1",
        status=SubmissionStatus.PENDING,
    )
    db_session.add(submission)
    await db_session.commit()

    # Fail twice, then succeed
    mock_email_service._send_email_with_retry.side_effect = [
        Exception("Temporary failure 1"),
        Exception("Temporary failure 2"),
        None,  # Success on 3rd attempt
    ]

    await contact_service._send_notification_with_retry(submission)

    # Verify 3 attempts made
    assert mock_email_service._send_email_with_retry.call_count == 3

    # Verify status updated to PROCESSED
    await db_session.refresh(submission)
    assert submission.status == SubmissionStatus.PROCESSED  # type: ignore[comparison-overlap]


@pytest.mark.asyncio
@pytest.mark.integration
async def test_send_notification_with_retry_fails_after_max_attempts(
    contact_service: ContactService,
    mock_email_service: MagicMock,
    db_session: AsyncSession,
) -> None:
    """Test retry logic fails after max attempts and updates status to FAILED."""
    submission = ContactSubmission(
        id=uuid.uuid4(),
        sender_name="Test User",
        sender_email="test@example.com",
        subject="Test",
        message="Test message",
        ip_address="192.168.1.1",
        status=SubmissionStatus.PENDING,
    )
    db_session.add(submission)
    await db_session.commit()

    # Fail all 3 attempts
    mock_email_service._send_email_with_retry.side_effect = Exception("Permanent failure")

    await contact_service._send_notification_with_retry(submission)

    # Verify 3 attempts made
    assert mock_email_service._send_email_with_retry.call_count == 3

    # Verify status updated to FAILED
    await db_session.refresh(submission)
    assert submission.status == SubmissionStatus.FAILED  # type: ignore[comparison-overlap]


@pytest.mark.asyncio
@pytest.mark.integration
async def test_send_notification_with_retry_exponential_backoff(
    contact_service: ContactService,
    mock_email_service: MagicMock,
    db_session: AsyncSession,
    monkeypatch,
) -> None:
    """Test that retry logic uses exponential backoff (1s, 2s, 4s)."""
    submission = ContactSubmission(
        id=uuid.uuid4(),
        sender_name="Test User",
        sender_email="test@example.com",
        subject="Test",
        message="Test message",
        ip_address="192.168.1.1",
        status=SubmissionStatus.PENDING,
    )
    db_session.add(submission)
    await db_session.commit()

    # Track sleep calls
    sleep_delays = []

    async def mock_sleep(delay: float) -> None:
        sleep_delays.append(delay)

    monkeypatch.setattr("asyncio.sleep", mock_sleep)

    # Fail all attempts
    mock_email_service._send_email_with_retry.side_effect = Exception("Failure")

    await contact_service._send_notification_with_retry(submission)

    # Verify exponential backoff: 1s, 2s (no sleep after final failure)
    assert sleep_delays == [1.0, 2.0]


@pytest.mark.asyncio
@pytest.mark.integration
async def test_create_submission_with_special_characters(
    contact_service: ContactService,
    db_session: AsyncSession,
    mock_request: Request,
) -> None:
    """Test creating submission with unicode and special characters."""
    data = ContactSubmissionCreate(
        sender_name="François O'Neill-Smith",
        sender_email="francois@example.com",
        subject="Question about €100",
        message="I'd like to donate €100 😊",
    )

    result = await contact_service.create_submission(data, mock_request)

    assert result.sender_name == "François O'Neill-Smith"
    assert "€100" in result.subject
    # Note: message field is not in ContactSubmissionResponse, only in ContactSubmissionDetail

    # Verify stored correctly in DB
    db_submission = await db_session.get(ContactSubmission, result.id)
    assert db_submission is not None
    await db_session.refresh(db_submission)
    assert db_submission.sender_name == "François O'Neill-Smith"  # type: ignore[comparison-overlap]


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.skip(reason="Background task interferes with session teardown - needs refactoring")
async def test_create_submission_updates_timestamp(
    contact_service: ContactService,
    db_session: AsyncSession,
    mock_request: Request,
) -> None:
    """Test that submission has correct timestamps."""
    data = ContactSubmissionCreate(
        sender_name="Test User",
        sender_email="test@example.com",
        subject="Test",
        message="Test message",
    )

    before_time = datetime.utcnow()
    result = await contact_service.create_submission(data, mock_request)
    after_time = datetime.utcnow()

    # ContactSubmissionResponse has created_at, not submitted_at
    assert result.created_at is not None
    assert before_time <= result.created_at <= after_time
