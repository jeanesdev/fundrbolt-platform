"""Contact form submission service.

Handles contact form submissions from the public landing page.
Includes email notifications and retry logic for failures.
"""

import asyncio
from datetime import datetime

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.contact_submission import ContactSubmission, SubmissionStatus
from app.schemas.contact import ContactSubmissionCreate, ContactSubmissionResponse
from app.services.email_service import EmailService

logger = get_logger(__name__)
settings = get_settings()


class ContactService:
    """Service for handling contact form submissions."""

    def __init__(self, db: AsyncSession, email_service: EmailService):
        """
        Initialize contact service.

        Args:
            db: Database session
            email_service: Email service for sending notifications
        """
        self.db = db
        self.email_service = email_service

    async def create_submission(
        self, data: ContactSubmissionCreate, request: Request
    ) -> ContactSubmissionResponse:
        """
        Create a contact form submission and send notification email.

        Args:
            data: Contact submission data
            request: FastAPI request object for IP address extraction

        Returns:
            ContactSubmissionResponse with submission details

        Raises:
            Exception: If database operation fails
        """
        # Get client IP address
        ip_address = self._get_client_ip(request)

        # Create submission record
        submission = ContactSubmission(
            sender_name=data.sender_name,
            sender_email=data.sender_email,
            subject=data.subject,
            message=data.message,
            ip_address=ip_address,
            status=SubmissionStatus.PENDING,
        )

        self.db.add(submission)
        await self.db.commit()
        await self.db.refresh(submission)

        logger.info(
            f"Contact submission created: {submission.id} from {submission.sender_email}",
            extra={
                "submission_id": str(submission.id),
                "sender_email": submission.sender_email,
                "ip_address": ip_address,
            },
        )

        # Send notification email asynchronously (don't block the response)
        asyncio.create_task(self._send_notification_with_retry(submission))

        return ContactSubmissionResponse.model_validate(submission)

    async def _send_notification_with_retry(self, submission: ContactSubmission) -> None:
        """
        Send email notification with exponential backoff retry.

        Args:
            submission: Contact submission to notify about

        Updates submission status to PROCESSED or FAILED based on result.
        """
        max_retries = 3
        base_delay = 1.0  # seconds

        for attempt in range(max_retries):
            try:
                await self.send_email_notification(submission)

                # Update status to processed
                submission.status = SubmissionStatus.PROCESSED  # type: ignore[assignment]
                submission.updated_at = datetime.utcnow()  # type: ignore[assignment]
                await self.db.commit()

                logger.info(
                    f"Contact notification email sent successfully: {submission.id}",
                    extra={"submission_id": str(submission.id), "attempt": attempt + 1},
                )
                return

            except Exception as e:
                logger.warning(
                    f"Email notification failed (attempt {attempt + 1}/{max_retries}): {e}",
                    extra={
                        "submission_id": str(submission.id),
                        "attempt": attempt + 1,
                        "error": str(e),
                    },
                )

                if attempt < max_retries - 1:
                    # Exponential backoff: 1s, 2s, 4s
                    delay = base_delay * (2**attempt)
                    await asyncio.sleep(delay)
                else:
                    # Final failure - update status
                    submission.status = SubmissionStatus.FAILED  # type: ignore[assignment]
                    submission.updated_at = datetime.utcnow()  # type: ignore[assignment]
                    await self.db.commit()

                    logger.error(
                        f"Contact notification email failed after {max_retries} attempts: {submission.id}",
                        extra={
                            "submission_id": str(submission.id),
                            "error": str(e),
                        },
                    )

    async def send_email_notification(self, submission: ContactSubmission) -> None:
        """
        Send email notification to platform team about new contact submission.

        Args:
            submission: Contact submission to notify about

        Raises:
            Exception: If email sending fails
        """
        # Email to platform team (fallback to default)
        recipient_email = "support@augeo.app"

        subject = f"New Contact Form Submission: {submission.subject}"

        # Plain text body
        body = f"""
New contact form submission from {submission.sender_name}

From: {submission.sender_name} ({submission.sender_email})
Subject: {submission.subject}

Message:
{submission.message}

Submission ID: {submission.id}
IP Address: {submission.ip_address}
        """.strip()

        # HTML body with styled formatting
        from app.services.email_service import _create_email_html_template

        body_paragraphs = [
            f"You have received a new contact form submission from <strong>{submission.sender_name}</strong>.",
            f"<strong>From:</strong> {submission.sender_name} ({submission.sender_email})",
            f"<strong>Subject:</strong> {submission.subject}",
            f"<strong>Message:</strong><br>{submission.message.replace(chr(10), '<br>')}",
            f"<strong>Submission ID:</strong> {submission.id}",
            f"<strong>IP Address:</strong> {submission.ip_address}",
        ]

        html_body = _create_email_html_template(
            heading="New Contact Form Submission",
            body_paragraphs=body_paragraphs,
            footer_text="This is an automated notification from the Augeo Platform.",
        )

        # Send email using existing EmailService method
        await self.email_service._send_email_with_retry(
            to_email=recipient_email,
            subject=subject,
            body=body,
            email_type="contact_submission",
            html_body=html_body,
        )

    def _get_client_ip(self, request: Request) -> str:
        """
        Extract client IP address from request.

        Checks X-Forwarded-For header (for proxies) before falling back to direct connection.

        Args:
            request: FastAPI request object

        Returns:
            Client IP address as string
        """
        # Check X-Forwarded-For header (set by proxies/load balancers)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Take the first IP in the chain (original client)
            return forwarded.split(",")[0].strip()

        # Fall back to direct connection IP
        return request.client.host if request.client else "unknown"
