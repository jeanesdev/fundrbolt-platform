"""Email service using Azure Communication Services.

T057: Azure Communication Services email client for sending password reset emails
T159: Error handling and retry logic for email service failures
"""

import asyncio

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.metrics import EMAIL_FAILURES_TOTAL

logger = get_logger(__name__)
settings = get_settings()


def _create_email_html_template(
    heading: str,
    body_paragraphs: list[str],
    cta_text: str | None = None,
    cta_url: str | None = None,
    footer_text: str | None = None,
) -> str:
    """
    Create a professional HTML email template.

    Args:
        heading: Main heading text
        body_paragraphs: List of body paragraphs
        cta_text: Optional call-to-action button text
        cta_url: Optional call-to-action button URL
        footer_text: Optional footer text

    Returns:
        HTML email template string
    """
    # Build body paragraphs
    paragraphs_html = "".join(
        f'<p style="margin: 0 0 16px 0; line-height: 1.6;">{p}</p>' for p in body_paragraphs
    )

    # Build CTA button if provided
    cta_html = ""
    if cta_text and cta_url:
        cta_html = f"""
        <table role="presentation" style="margin: 32px 0;">
          <tr>
            <td>
              <a href="{cta_url}"
                 style="background-color: #2563eb;
                        color: #ffffff;
                        padding: 14px 32px;
                        text-decoration: none;
                        border-radius: 6px;
                        display: inline-block;
                        font-weight: 600;">
                {cta_text}
              </a>
            </td>
          </tr>
        </table>
        """

    # Build footer
    footer_html = ""
    if footer_text:
        footer_html = f"""
        <div style="margin-top: 32px;
                    padding-top: 24px;
                    border-top: 1px solid #e5e7eb;
                    color: #6b7280;
                    font-size: 14px;">
          <p style="margin: 0;">{footer_text}</p>
        </div>
        """

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Augeo Platform</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation"
             style="width: 100%;
                    border-collapse: collapse;
                    background-color: #f3f4f6;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation"
                   style="max-width: 600px;
                          margin: 0 auto;
                          background-color: #ffffff;
                          border-radius: 8px;
                          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="padding: 40px;">
                  <!-- Header -->
                  <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="margin: 0;
                               color: #1f2937;
                               font-size: 24px;
                               font-weight: 700;">
                      Augeo Platform
                    </h1>
                  </div>

                  <!-- Main Content -->
                  <h2 style="margin: 0 0 24px 0;
                             color: #111827;
                             font-size: 20px;
                             font-weight: 600;">
                    {heading}
                  </h2>

                  {paragraphs_html}

                  {cta_html}

                  <p style="margin: 32px 0 0 0; line-height: 1.6;">
                    Best regards,<br>
                    <strong>The Augeo Platform Team</strong>
                  </p>

                  {footer_html}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """


class EmailServiceError(Exception):
    """Base exception for email service errors."""

    pass


class EmailSendError(EmailServiceError):
    """Exception raised when email sending fails."""

    pass


class EmailService:
    """Email service for sending transactional emails via Azure Communication Services."""

    def __init__(self) -> None:
        """Initialize email service."""
        # Check if Azure Communication Services credentials are configured
        self.enabled = bool(settings.azure_communication_connection_string)

        if self.enabled:
            logger.info(
                "EmailService initialized with Azure Communication Services",
                extra={"email_from": settings.email_from_address},
            )
        else:
            logger.warning(
                "EmailService initialized in MOCK MODE - emails will only be logged, not sent. "
                "Set AZURE_COMMUNICATION_CONNECTION_STRING to enable real email sending."
            )

    async def send_password_reset_email(
        self, to_email: str, reset_token: str, user_name: str | None = None
    ) -> bool:
        """
        Send password reset email with reset link and retry logic.

        Args:
            to_email: Recipient email address
            reset_token: Password reset token
            user_name: Optional user's first name for personalization

        Returns:
            True if email sent successfully, False otherwise

        Raises:
            EmailSendError: If email fails to send after all retries
        """
        # Construct reset link (admin portal)
        reset_url = f"{settings.frontend_admin_url}/reset-password?token={reset_token}"

        # Email content
        subject = "Reset Your Password - Augeo Platform"
        greeting = f"Hi {user_name}," if user_name else "Hi,"
        body = f"""
{greeting}

You requested to reset your password for your Augeo Platform account.

Click the link below to reset your password:
{reset_url}

This link will expire in 1 hour.

If you didn't request this password reset, please ignore this email.

Best regards,
The Augeo Platform Team
        """.strip()

        # Send with retry logic
        return await self._send_email_with_retry(to_email, subject, body, "password_reset")

    async def send_verification_email(
        self, to_email: str, verification_token: str, user_name: str | None = None
    ) -> bool:
        """
        Send email verification email with retry logic.

        Args:
            to_email: Recipient email address
            verification_token: Email verification token
            user_name: Optional user's first name for personalization

        Returns:
            True if email sent successfully, False otherwise

        Raises:
            EmailSendError: If email fails to send after all retries
        """
        # Construct verification link (admin portal)
        verification_url = f"{settings.frontend_admin_url}/verify-email?token={verification_token}"

        # Email content
        subject = "Verify Your Email - Augeo Platform"
        greeting = f"Hi {user_name}," if user_name else "Hi,"
        body = f"""
{greeting}

Welcome to Augeo Platform!

Please verify your email address by clicking the link below:
{verification_url}

This link will expire in 24 hours.

If you didn't create an account, please ignore this email.

Best regards,
The Augeo Platform Team
        """.strip()

        # Send with retry logic
        return await self._send_email_with_retry(to_email, subject, body, "verification")

    async def send_npo_member_invitation_email(
        self,
        to_email: str,
        invitation_token: str,
        npo_name: str,
        role: str,
        invited_by_name: str | None = None,
    ) -> bool:
        """
        Send NPO member invitation email.

        Args:
            to_email: Recipient email address
            invitation_token: Invitation token
            npo_name: Name of the NPO
            role: Role being offered (admin, co_admin, staff)
            invited_by_name: Name of person who sent invitation

        Returns:
            True if email sent successfully

        Raises:
            EmailSendError: If email fails after all retries
        """
        # Construct invitation link
        invitation_url = (
            f"{settings.frontend_admin_url}/invitations/accept?token={invitation_token}"
        )

        # Email content
        subject = f"Invitation to Join {npo_name} - Augeo Platform"
        inviter = f"{invited_by_name} from" if invited_by_name else "A member of"
        role_display = role.replace("_", " ").title()

        # Plain text version
        body = f"""
Hi,

{inviter} {npo_name} has invited you to join their organization on Augeo Platform as a {role_display}.

Click the link below to accept the invitation:
{invitation_url}

This invitation will expire in 7 days.

If you don't have an Augeo Platform account yet, you'll be able to create one when you accept the invitation.

Best regards,
The Augeo Platform Team
        """.strip()

        # HTML version
        html_body = _create_email_html_template(
            heading=f"You're Invited to Join {npo_name}!",
            body_paragraphs=[
                f"{inviter} {npo_name} has invited you to join their organization on Augeo Platform as a <strong>{role_display}</strong>.",
                "Click the button below to accept your invitation and get started.",
            ],
            cta_text="Accept Invitation",
            cta_url=invitation_url,
            footer_text=(
                "This invitation will expire in 7 days. "
                "If you don't have an Augeo Platform account yet, you'll be able to create one when you accept the invitation."
            ),
        )

        return await self._send_email_with_retry(
            to_email, subject, body, "npo_invitation", html_body
        )

    async def send_npo_invitation_accepted_email(
        self,
        to_email: str,
        npo_name: str,
        member_name: str,
        member_role: str,
    ) -> bool:
        """
        Send notification email when someone accepts an NPO invitation.

        Sent to the NPO admin(s) who invited the member.

        Args:
            to_email: NPO admin's email address
            npo_name: Name of the NPO
            member_name: Name of the person who accepted
            member_role: Role they accepted (admin, co_admin, staff)

        Returns:
            True if email sent successfully

        Raises:
            EmailSendError: If email fails after all retries
        """
        subject = f"Team Member Joined: {npo_name}"
        role_display = member_role.replace("_", " ").title()
        dashboard_url = f"{settings.frontend_admin_url}/npos"

        body = f"""
Hi,

Good news! {member_name} has accepted your invitation to join {npo_name} as a {role_display}.

You can view your team members and manage permissions in your NPO dashboard:
{dashboard_url}

Best regards,
The Augeo Platform Team
        """.strip()

        return await self._send_email_with_retry(to_email, subject, body, "npo_invitation_accepted")

    async def send_npo_application_submitted_email(
        self, to_email: str, npo_name: str, applicant_name: str | None = None
    ) -> bool:
        """
        Send confirmation email when NPO application is submitted.

        Args:
            to_email: NPO applicant's email
            npo_name: Name of the NPO
            applicant_name: Applicant's name

        Returns:
            True if email sent successfully
        """
        subject = f"NPO Application Submitted: {npo_name}"
        greeting = f"Hi {applicant_name}," if applicant_name else "Hi,"

        body = f"""
{greeting}

Thank you for submitting your application for {npo_name} on Augeo Platform.

Your application is now under review by our team. We'll notify you once a decision has been made.

You can check the status of your application by logging into your account.

If you have any questions, please don't hesitate to contact us.

Best regards,
The Augeo Platform Team
        """.strip()

        return await self._send_email_with_retry(
            to_email, subject, body, "npo_application_submitted"
        )

    async def send_npo_application_approved_email(
        self, to_email: str, npo_name: str, applicant_name: str | None = None
    ) -> bool:
        """
        Send email when NPO application is approved.

        Args:
            to_email: NPO applicant's email
            npo_name: Name of the NPO
            applicant_name: Applicant's name

        Returns:
            True if email sent successfully
        """
        subject = f"NPO Application Approved: {npo_name}"
        greeting = f"Hi {applicant_name}," if applicant_name else "Hi,"
        dashboard_url = f"{settings.frontend_admin_url}/dashboard"

        body = f"""
{greeting}

Congratulations! Your application for {npo_name} has been approved.

Your organization is now active on Augeo Platform. You can start:
- Customizing your NPO branding
- Inviting team members
- Creating donation campaigns and events

Visit your dashboard to get started:
{dashboard_url}

Welcome to Augeo Platform!

Best regards,
The Augeo Platform Team
        """.strip()

        return await self._send_email_with_retry(
            to_email, subject, body, "npo_application_approved"
        )

    async def send_npo_application_rejected_email(
        self,
        to_email: str,
        npo_name: str,
        rejection_reason: str | None = None,
        applicant_name: str | None = None,
    ) -> bool:
        """
        Send email when NPO application is rejected.

        Args:
            to_email: NPO applicant's email
            npo_name: Name of the NPO
            rejection_reason: Reason for rejection (optional)
            applicant_name: Applicant's name

        Returns:
            True if email sent successfully
        """
        subject = f"NPO Application Status: {npo_name}"
        greeting = f"Hi {applicant_name}," if applicant_name else "Hi,"

        reason_text = f"\n\nReason:\n{rejection_reason}\n" if rejection_reason else ""

        body = f"""
{greeting}

Thank you for your interest in joining Augeo Platform with {npo_name}.

After careful review, we're unable to approve your application at this time.{reason_text}

You may submit a new application in the future if you'd like to try again.

If you have any questions or need clarification, please contact us.

Best regards,
The Augeo Platform Team
        """.strip()

        return await self._send_email_with_retry(
            to_email, subject, body, "npo_application_rejected"
        )

    async def _send_email_with_retry(
        self,
        to_email: str,
        subject: str,
        body: str,
        email_type: str,
        html_body: str | None = None,
    ) -> bool:
        """
        Send email with retry logic and error handling.

        Args:
            to_email: Recipient email address
            subject: Email subject
            body: Email body (plain text)
            email_type: Type of email (for logging)
            html_body: Optional HTML email body

        Returns:
            True if email sent successfully

        Raises:
            EmailSendError: If email fails after all retries
        """
        max_retries = 3
        retry_delay = 1.0

        for attempt in range(max_retries):
            try:
                if self.enabled:
                    # Send via Azure Communication Services
                    await self._send_via_azure(to_email, subject, body, html_body)
                else:
                    # Mock mode for development - just log
                    logger.info(
                        f"[MOCK EMAIL] {email_type} email\n"
                        f"To: {to_email}\n"
                        f"Subject: {subject}\n"
                        f"Body:\n{body}"
                    )
                return True

            except Exception as e:
                # Increment failure counter
                EMAIL_FAILURES_TOTAL.inc()

                if attempt < max_retries - 1:
                    logger.warning(
                        "Email sending failed, retrying",
                        extra={
                            "email_type": email_type,
                            "to_email": to_email,
                            "error": str(e),
                            "attempt": attempt + 1,
                            "max_retries": max_retries,
                        },
                    )
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                else:
                    logger.error(
                        "Email sending failed after all retries",
                        extra={
                            "email_type": email_type,
                            "to_email": to_email,
                            "error": str(e),
                            "max_retries": max_retries,
                        },
                    )
                    raise EmailSendError(
                        f"Failed to send {email_type} email after {max_retries} attempts"
                    ) from e

        return False  # Should not reach here

    async def send_application_submitted_email(
        self, to_email: str, npo_name: str, applicant_name: str | None = None
    ) -> bool:
        """
        Send confirmation email when NPO application is submitted.

        Sent to: NPO creator
        Content: Confirmation that application is under review

        Args:
            to_email: NPO creator's email address
            npo_name: Name of the NPO
            applicant_name: Optional applicant's name for personalization

        Returns:
            True if email sent successfully, False otherwise
        """
        subject = f"NPO Application Submitted: {npo_name}"
        greeting = f"Hi {applicant_name}" if applicant_name else "Hi"

        body = f"""
{greeting},

Thank you for submitting your NPO application for {npo_name}!

Your application is now being reviewed by our team. We aim to complete the review process within 2 business days.

What happens next:
- Our team will review your organization's information
- You'll receive an email notification once the review is complete
- If approved, you'll be able to start inviting team members and creating events
- If additional information is needed, we'll reach out to you directly

You can check your application status anytime in your dashboard.

Best regards,
The Augeo Platform Team

---
This is an automated message. Please do not reply to this email.
        """.strip()

        return await self._send_email_with_retry(
            to_email=to_email,
            subject=subject,
            body=body,
            email_type="application_submitted",
        )

    async def send_application_approved_email(
        self, to_email: str, npo_name: str, applicant_name: str | None = None
    ) -> bool:
        """
        Send notification email when NPO application is approved.

        Sent to: NPO creator
        Content: Approval confirmation with next steps

        Args:
            to_email: NPO creator's email address
            npo_name: Name of the NPO
            applicant_name: Optional applicant's name for personalization

        Returns:
            True if email sent successfully, False otherwise
        """
        subject = f"NPO Application Approved: {npo_name}"
        greeting = f"Hi {applicant_name}" if applicant_name else "Hi"

        body = f"""
{greeting},

Congratulations! Your NPO application for {npo_name} has been approved!

Your organization is now active on the Augeo Platform. You can now:
- Invite co-administrators and staff members
- Create and manage fundraising events
- Customize your organization's branding
- Accept donations from supporters

Get started by logging into your dashboard and inviting your team members.

If you have any questions, please don't hesitate to reach out to our support team.

Welcome to Augeo!

Best regards,
The Augeo Platform Team

---
This is an automated message. Please do not reply to this email.
        """.strip()

        return await self._send_email_with_retry(
            to_email=to_email,
            subject=subject,
            body=body,
            email_type="application_approved",
        )

    async def send_application_rejected_email(
        self,
        to_email: str,
        npo_name: str,
        reason: str | None = None,
        applicant_name: str | None = None,
    ) -> bool:
        """
        Send notification email when NPO application is rejected.

        Sent to: NPO creator
        Content: Rejection notice with reason and next steps

        Args:
            to_email: NPO creator's email address
            npo_name: Name of the NPO
            reason: Optional reason for rejection
            applicant_name: Optional applicant's name for personalization

        Returns:
            True if email sent successfully, False otherwise
        """
        subject = f"NPO Application Update: {npo_name}"
        greeting = f"Hi {applicant_name}" if applicant_name else "Hi"

        reason_text = f"\n\nReason: {reason}" if reason else ""

        body = f"""
{greeting},

Thank you for your interest in joining the Augeo Platform with {npo_name}.

After reviewing your application, we are unable to approve it at this time.{reason_text}

If you believe this decision was made in error or if you have additional information that may help with the review, please contact our support team.

You may also submit a new application with updated information in the future.

Best regards,
The Augeo Platform Team

---
This is an automated message. Please do not reply to this email.
        """.strip()

        return await self._send_email_with_retry(
            to_email=to_email,
            subject=subject,
            body=body,
            email_type="application_rejected",
        )

    async def send_admin_application_notification_email(
        self, npo_name: str, npo_email: str, applicant_name: str | None = None
    ) -> bool:
        """
        Send notification to admins when a new NPO application is submitted.

        Sent to: npo_applications@augeo.app
        Content: Alert that new application needs review

        Args:
            npo_name: Name of the NPO
            npo_email: NPO contact email
            applicant_name: Optional applicant's name

        Returns:
            True if email sent successfully, False otherwise
        """
        admin_email = "npo_applications@augeo.app"
        subject = f"New NPO Application: {npo_name}"
        applicant_info = f" by {applicant_name}" if applicant_name else ""

        body = f"""
New NPO Application Submitted

A new organization has submitted an application for approval{applicant_info}.

Organization Details:
- Name: {npo_name}
- Contact Email: {npo_email}
- Submitted: {__import__("datetime").datetime.now().strftime("%B %d, %Y at %I:%M %p")}

Action Required:
Please review this application in the admin dashboard.

Review Link: {__import__("os").getenv("FRONTEND_URL", "http://localhost:5173")}/admin/npo-applications

---
This is an automated notification from the Augeo Platform.
        """.strip()

        return await self._send_email_with_retry(
            to_email=admin_email,
            subject=subject,
            body=body,
            email_type="admin_application_notification",
        )

    async def _send_via_azure(
        self, to_email: str, subject: str, body: str, html_body: str | None = None
    ) -> None:
        """
        Send email via Azure Communication Services.

        Args:
            to_email: Recipient email address
            subject: Email subject
            body: Email body (plain text)
            html_body: Optional HTML email body

        Raises:
            EmailSendError: If sending fails
        """
        import asyncio
        from concurrent.futures import ThreadPoolExecutor
        from typing import Any

        def _send_sync() -> Any:
            """Synchronous send operation to run in thread pool."""
            try:
                from azure.communication.email import EmailClient

                if not settings.azure_communication_connection_string:
                    raise EmailSendError(
                        "Azure Communication Services connection string not configured"
                    )

                # Initialize client
                client = EmailClient.from_connection_string(
                    settings.azure_communication_connection_string
                )

                # Prepare message content
                content = {
                    "subject": subject,
                    "plainText": body,
                }
                if html_body:
                    content["html"] = html_body

                # Prepare message
                message = {
                    "senderAddress": settings.email_from_address,
                    "recipients": {"to": [{"address": to_email}]},
                    "content": content,
                }

                # Send email (synchronous Azure SDK call)
                poller = client.begin_send(message)
                result = poller.result()

                logger.info(
                    "Email sent via Azure Communication Services",
                    extra={
                        "to": to_email,
                        "subject": subject,
                        "message_id": result.get("id"),
                        "status": result.get("status"),
                    },
                )
                return result

            except ImportError as e:
                raise EmailSendError(
                    "Azure Communication Email SDK not installed. "
                    "Install with: poetry add azure-communication-email"
                ) from e
            except Exception as e:
                logger.error(
                    "Failed to send email via Azure",
                    extra={"to": to_email, "subject": subject, "error": str(e)},
                )
                raise EmailSendError(f"Failed to send email: {str(e)}") from e

        # Run synchronous Azure SDK call in thread pool to avoid blocking event loop
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            await loop.run_in_executor(executor, _send_sync)


# Singleton instance
_email_service: EmailService | None = None


def get_email_service() -> EmailService:
    """Get email service singleton instance."""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
