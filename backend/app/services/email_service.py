"""Email service using Azure Communication Services.

T057: Azure Communication Services email client for sending password reset emails
T159: Error handling and retry logic for email service failures
"""

import asyncio
import os

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
    logo_url: str | None = None,
    otp_code: str | None = None,
) -> str:
    """
    Create a professional HTML email template.

    Args:
        heading: Main heading text
        body_paragraphs: List of body paragraphs
        cta_text: Optional call-to-action button text
        cta_url: Optional call-to-action button URL
        footer_text: Optional footer text
        logo_url: Optional CDN URL for FundrBolt logo

    Returns:
        HTML email template string
    """
    resolved_logo_url = (
        logo_url or f"{settings.azure_cdn_logo_base_url}/fundrbolt-logo-white-gold.png"
    )

    # Build body paragraphs
    paragraphs_html = "".join(
        f'<p style="margin: 0 0 16px 0; line-height: 1.6;">{p}</p>' for p in body_paragraphs
    )

    # Build OTP code block if provided
    otp_html = ""
    if otp_code:
        otp_html = f"""
        <div style="background-color: #f3f4f6;
                    border-radius: 8px;
                    padding: 24px;
                    text-align: center;
                    margin: 24px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">Your verification code</p>
          <p style="margin: 0;
                    font-size: 36px;
                    font-weight: 700;
                    letter-spacing: 0.3em;
                    color: #111827;
                    font-family: 'Courier New', Courier, monospace;">{otp_code}</p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">This code expires in 24 hours</p>
        </div>
        """

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
    <title>FundrBolt</title>
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
                <td style="padding: 0;">
                  <!-- Header with Navy Background and Logo -->
                  <div style="background-color: #11294c;
                              padding: 32px;
                              text-align: center;
                              border-top-left-radius: 8px;
                              border-top-right-radius: 8px;">
                                        <img src="{resolved_logo_url}" alt="FundrBolt" style="height: 60px; width: auto; display: inline-block;" />
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px;">
                  <!-- Main Content -->
                  <h2 style="margin: 0 0 24px 0;
                             color: #111827;
                             font-size: 20px;
                             font-weight: 600;">
                    {heading}
                  </h2>

                  {paragraphs_html}

                  {otp_html}

                  {cta_html}

                  <p style="margin: 32px 0 0 0; line-height: 1.6;">
                    Best regards,<br>
                    <strong>The FundrBolt Team</strong>
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

    def _get_logo_url(self, background: str = "dark") -> str:
        """
        Get CDN URL for FundrBolt logo based on background color.

        Args:
            background: Background color context ('light' or 'dark')

        Returns:
            CDN URL for the appropriate logo variant

        Note:
            - Use 'light' (navy/gold logo) for white/light backgrounds
            - Use 'dark' (white/gold logo) for navy/dark backgrounds (default for emails)
        """
        logo_filename = (
            "fundrbolt-logo-navy-gold.png"
            if background == "light"
            else "fundrbolt-logo-white-gold.png"
        )
        return f"{settings.azure_cdn_logo_base_url}/{logo_filename}"

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
        subject = "Reset Your Password - FundrBolt"
        greeting = f"Hi {user_name}," if user_name else "Hi,"
        body = f"""
{greeting}

You requested to reset your password for your FundrBolt account.

Click the link below to reset your password:
{reset_url}

This link will expire in 1 hour.

If you didn't request this password reset, please ignore this email.

Best regards,
The FundrBolt Team
        """.strip()

        # HTML version with logo
        html_body = _create_email_html_template(
            heading="Reset Your Password",
            body_paragraphs=[
                "You requested to reset your password for your FundrBolt account.",
                "Click the button below to reset your password. This link will expire in 1 hour.",
            ],
            cta_text="Reset Password",
            cta_url=reset_url,
            footer_text="If you didn't request this password reset, please ignore this email and your password will remain unchanged.",
            logo_url=self._get_logo_url("dark"),  # White/gold logo on navy background
        )

        # Send with retry logic
        return await self._send_email_with_retry(
            to_email, subject, body, "password_reset", html_body
        )

    async def send_verification_email(
        self,
        to_email: str,
        verification_token: str,
        user_name: str | None = None,
        otp: str | None = None,
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
        # Construct verification link (donor portal)
        verification_url = f"{settings.frontend_donor_url}/verify-email?token={verification_token}"

        # Email content
        subject = "Verify Your Email - FundrBolt"
        greeting = f"Hi {user_name}" if user_name else "Hi"

        # Plain text version
        otp_text = f"\nOr enter this 6-digit code on the verification page: {otp}\n" if otp else ""
        body = f"""
{greeting},

Welcome to FundrBolt!

Please verify your email address by clicking the link below:
{verification_url}
{otp_text}
This link will expire in 24 hours.

If you didn't create an account, please ignore this email.

Best regards,
The FundrBolt Team
        """.strip()

        # HTML version with logo
        otp_body_note = (
            "You can also enter the 6-digit code shown below directly on the verification page."
            if otp
            else None
        )
        html_body = _create_email_html_template(
            heading="Welcome to FundrBolt!",
            body_paragraphs=[
                f"Thank you for creating an account{' ' + user_name if user_name else ''}! To get started, we need to verify your email address.",
                "Click the button below to verify your email and activate your account.",
                *(([otp_body_note]) if otp_body_note else []),
            ],
            cta_text="Verify Email Address",
            cta_url=verification_url,
            footer_text="This verification link will expire in 24 hours. If you didn't create an account, please ignore this email.",
            logo_url=self._get_logo_url("dark"),  # White/gold logo on navy background
            otp_code=otp,
        )

        # Send with retry logic
        return await self._send_email_with_retry(to_email, subject, body, "verification", html_body)

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
        subject = f"Invitation to Join {npo_name} - FundrBolt"
        inviter = f"{invited_by_name} from" if invited_by_name else "A member of"
        role_display = role.replace("_", " ").title()

        # Plain text version
        body = f"""
Hi,

{inviter} {npo_name} has invited you to join their organization on FundrBolt as a {role_display}.

Click the link below to accept the invitation:
{invitation_url}

This invitation will expire in 7 days.

If you don't have a FundrBolt account yet, you'll be able to create one when you accept the invitation.

Best regards,
The FundrBolt Team
        """.strip()

        # HTML version with logo
        html_body = _create_email_html_template(
            heading=f"You're Invited to Join {npo_name}!",
            body_paragraphs=[
                f"{inviter} {npo_name} has invited you to join their organization on FundrBolt as a <strong>{role_display}</strong>.",
                "Click the button below to accept your invitation and get started.",
            ],
            cta_text="Accept Invitation",
            cta_url=invitation_url,
            footer_text=(
                "This invitation will expire in 7 days. "
                "If you don't have a FundrBolt account yet, you'll be able to create one when you accept the invitation."
            ),
            logo_url=self._get_logo_url("dark"),  # White/gold logo on navy background
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
The FundrBolt Team
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

Thank you for submitting your application for {npo_name} on FundrBolt.

Your application is now under review by our team. We'll notify you once a decision has been made.

You can check the status of your application by logging into your account.

If you have any questions, please don't hesitate to contact us.

Best regards,
The FundrBolt Team
        """.strip()

        html_body = _create_email_html_template(
            heading=f"We received your application for {npo_name}",
            body_paragraphs=[
                "Thank you for creating your organization on FundrBolt.",
                f"Your application for <strong>{npo_name}</strong> is now under review by our team.",
                "We will email you again as soon as the review is complete or if we need any additional information.",
            ],
            cta_text="Open Admin Portal",
            cta_url=f"{settings.frontend_admin_url}/dashboard",
            footer_text="This acknowledgement confirms that we received your organization submission and it is pending review.",
        )

        return await self._send_email_with_retry(
            to_email,
            subject,
            body,
            "npo_application_submitted",
            html_body,
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

Your organization is now active on FundrBolt. You can start:
- Customizing your NPO branding
- Inviting team members
- Creating donation campaigns and events

Visit your dashboard to get started:
{dashboard_url}

Welcome to FundrBolt!

Best regards,
The FundrBolt Team
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

Thank you for your interest in joining FundrBolt with {npo_name}.

After careful review, we're unable to approve your application at this time.{reason_text}

You may submit a new application in the future if you'd like to try again.

If you have any questions or need clarification, please contact us.

Best regards,
The FundrBolt Team
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
The FundrBolt Team

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
        Send notification email when non-profit organization application is approved.

        Sent to: NPO creator
        Content: Approval confirmation with next steps and sign-in link

        Args:
            to_email: NPO creator's email address
            npo_name: Name of the NPO
            applicant_name: Optional applicant's name for personalization

        Returns:
            True if email sent successfully, False otherwise
        """
        subject = f"Non-Profit Organization Application Approved: {npo_name}"
        greeting = f"Hi {applicant_name}" if applicant_name else "Hi"
        sign_in_url = f"{settings.frontend_admin_url}/sign-in"

        body = f"""
{greeting},

Congratulations! Your non-profit organization application for {npo_name} has been approved!

Your organization is now active on FundrBolt. You can now:
- Invite co-administrators and staff members
- Create and manage fundraising events
- Customize your organization's branding
- Accept donations from supporters

Sign in to your dashboard to get started:
{sign_in_url}

Welcome to FundrBolt!

Best regards,
The FundrBolt Team
        """.strip()

        html_body = _create_email_html_template(
            heading=f"Your application for {npo_name} has been approved!",
            body_paragraphs=[
                f"Congratulations, <strong>{npo_name}</strong> is now active on FundrBolt!",
                "Here's what you can do next:",
                (
                    '<ul style="margin: 0 0 16px 0; padding-left: 24px;">'
                    '<li style="margin-bottom: 6px;">Invite co-administrators and staff members</li>'
                    '<li style="margin-bottom: 6px;">Create and manage fundraising events</li>'
                    '<li style="margin-bottom: 6px;">Customize your organization\'s branding</li>'
                    '<li style="margin-bottom: 6px;">Accept donations from supporters</li>'
                    "</ul>"
                ),
                "Sign in to your dashboard to get started and welcome your team.",
            ],
            cta_text="Sign In to FundrBolt",
            cta_url=sign_in_url,
            footer_text=(
                f"You are receiving this email because your non-profit organization "
                f"application for {npo_name} was approved on FundrBolt."
            ),
        )

        return await self._send_email_with_retry(
            to_email=to_email,
            subject=subject,
            body=body,
            email_type="application_approved",
            html_body=html_body,
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

Thank you for your interest in joining the FundrBolt with {npo_name}.

After reviewing your application, we are unable to approve it at this time.{reason_text}

If you believe this decision was made in error or if you have additional information that may help with the review, please contact our support team.

You may also submit a new application with updated information in the future.

Best regards,
The FundrBolt Team

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

        Sent to: settings.admin_notification_email (or fallback npo_applications@fundrbolt.com)
        Content: Alert that new application needs review

        Args:
            npo_name: Name of the NPO
            npo_email: NPO contact email
            applicant_name: Optional applicant's name

        Returns:
            True if email sent successfully, False otherwise
        """
        admin_email = settings.admin_notification_email or "npo_applications@fundrbolt.com"
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
This is an automated notification from the FundrBolt.
        """.strip()

        return await self._send_email_with_retry(
            to_email=admin_email,
            subject=subject,
            body=body,
            email_type="admin_application_notification",
        )

    async def send_npo_application_submitted_admin_notification(
        self,
        applicant_name: str,
        applicant_email: str,
        npo_name: str,
        application_id: str,
    ) -> bool:
        """
        Send notification to the configured admin email when a new NPO application
        is submitted via the onboarding wizard.

        Sent to: settings.admin_notification_email (or fallback npo_applications@fundrbolt.com)
        Content: Applicant details, NPO name, direct review link.

        Args:
            applicant_name: Full name of the applicant.
            applicant_email: Email address of the applicant.
            npo_name: Name of the submitted NPO.
            application_id: UUID string of the NPOApplication record.

        Returns:
            True if email sent successfully, False otherwise.
        """
        admin_email = settings.admin_notification_email or "npo_applications@fundrbolt.com"
        subject = f"New NPO Application (Onboarding): {npo_name}"
        review_url = f"{settings.frontend_admin_url}/admin/npo-applications"

        import datetime as _dt

        submitted_at = _dt.datetime.now(_dt.UTC).strftime("%B %d, %Y at %I:%M %p UTC")

        plain_body = f"""
New NPO Application Submitted via Onboarding Wizard

Applicant: {applicant_name} <{applicant_email}>
Organisation: {npo_name}
Application ID: {application_id}
Submitted: {submitted_at}

Please review this application in the admin dashboard:
{review_url}

---
This is an automated notification from the FundrBolt.
        """.strip()

        html_body = _create_email_html_template(
            heading=f"New NPO Application: {npo_name}",
            body_paragraphs=[
                f"<strong>{applicant_name}</strong> ({applicant_email}) has submitted a new NPO "
                f"application for <strong>{npo_name}</strong> via the onboarding wizard.",
                f"<strong>Application ID:</strong> {application_id}<br>"
                f"<strong>Submitted:</strong> {submitted_at}",
                "Please review and action this application in the admin dashboard.",
            ],
            cta_text="Review Application",
            cta_url=review_url,
            footer_text="This is an automated notification from the FundrBolt.",
        )

        return await self._send_email_with_retry(
            to_email=admin_email,
            subject=subject,
            body=plain_body,
            email_type="npo_onboarding_admin_notification",
            html_body=html_body,
        )

    async def send_welcome_email(
        self,
        to_email: str,
        user_name: str,
        dashboard_url: str | None = None,
    ) -> bool:
        """
        Send a welcome email after a user's email address is verified.

        Args:
            to_email: Recipient email address.
            user_name: User's first name for personalised greeting.
            dashboard_url: Optional direct link to the user's dashboard.

        Returns:
            True if email sent successfully, False otherwise.
        """
        subject = f"Welcome to FundrBolt, {user_name}!"
        url = dashboard_url or f"{settings.frontend_admin_url}/dashboard"

        plain_body = f"""
Hi {user_name},

Welcome to FundrBolt! Your email address has been verified and your account is now active.

You can log in to your dashboard at any time here:
{url}

If you have any questions, just reply to this email or visit our help center.

—The FundrBolt Team
        """.strip()

        html_body = _create_email_html_template(
            heading=f"Welcome to FundrBolt, {user_name}! 🎉",
            body_paragraphs=[
                f"Hi <strong>{user_name}</strong>,",
                "Your email address has been verified and your FundrBolt account is now active. "
                "We're glad you're here!",
                "Log in to your dashboard to explore the platform and start raising funds.",
            ],
            cta_text="Go to Dashboard",
            cta_url=url,
            footer_text="You received this email because you created an account on FundrBolt.",
            logo_url=self._get_logo_url("dark"),
        )

        return await self._send_email_with_retry(
            to_email=to_email,
            subject=subject,
            body=plain_body,
            email_type="welcome",
            html_body=html_body,
        )

    async def send_npo_application_reopened_email(
        self,
        to_email: str,
        user_name: str,
        npo_name: str,
        revision_notes: str | None = None,
    ) -> bool:
        """
        Notify an applicant that their rejected NPO application has been re-opened
        for revision by an admin.

        Args:
            to_email: Applicant's email address.
            user_name: Applicant's first name.
            npo_name: Name of the NPO application.
            revision_notes: Optional guidance from the admin reviewer.

        Returns:
            True if email sent successfully, False otherwise.
        """
        subject = f"Your NPO application for {npo_name} has been re-opened"
        wizard_url = f"{settings.frontend_admin_url}/register/npo"

        notes_paragraph = (
            f"The reviewer left the following feedback:<br><em>{revision_notes}</em>"
            if revision_notes
            else "Please log in and resubmit with any requested updates."
        )

        plain_body = f"""
Hi {user_name},

Good news — your NPO application for "{npo_name}" has been re-opened for revision.

You can log in to FundrBolt and resubmit your application at:
{wizard_url}

{f"Reviewer notes: {revision_notes}" if revision_notes else ""}

If you have any questions about this decision, please contact us by replying to this email.

—The FundrBolt Team
        """.strip()

        html_body = _create_email_html_template(
            heading=f"Your application for {npo_name} has been re-opened",
            body_paragraphs=[
                f"Hi <strong>{user_name}</strong>,",
                f"Good news! Your NPO application for <strong>{npo_name}</strong> has been "
                "re-opened for revision.",
                notes_paragraph,
            ],
            cta_text="Update & Resubmit Application",
            cta_url=wizard_url,
            footer_text="If you have questions about this decision, please reply to this email.",
        )

        return await self._send_email_with_retry(
            to_email=to_email,
            subject=subject,
            body=plain_body,
            email_type="npo_application_reopened",
            html_body=html_body,
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

        if settings.environment == "test" or "PYTEST_CURRENT_TEST" in os.environ:
            logger.info(
                "Email send skipped in test environment",
                extra={
                    "to": to_email,
                    "subject": subject,
                },
            )
            return

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
                    "senderDisplayName": settings.email_from_name,
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

    async def send_receipt_email(
        self,
        to_email: str,
        donor_name: str,
        event_name: str,
        transaction_id: str,
        amount_total: float,
        pdf_bytes: bytes | None = None,
    ) -> bool:
        """Send a payment receipt email, optionally with PDF attachment.

        Args:
            to_email: Recipient email address
            donor_name: Donor's display name for personalisation
            event_name: Name of the event for the subject line
            transaction_id: Transaction UUID for reference
            amount_total: Total amount charged (USD)
            pdf_bytes: Optional PDF receipt bytes to attach

        Returns:
            True if sent successfully, False on mock mode.

        Raises:
            EmailSendError: If sending fails after retries.
        """
        subject = f"Your receipt for {event_name}"
        greeting = f"Hi {donor_name},"
        amount_formatted = f"${amount_total:,.2f}"

        body = (
            f"{greeting}\n\n"
            f"Thank you! Your payment of {amount_formatted} for {event_name} "
            f"has been processed successfully.\n\n"
            f"Transaction ID: {transaction_id}\n\n"
            "Please find your receipt attached to this email. "
            "You can also access your receipt any time from your account.\n\n"
            "Thank you for your support!\n\n"
            "— The FundrBolt Team"
        )

        if not self.enabled:
            logger.info(
                "[MOCK EMAIL] receipt email",
                extra={
                    "to": to_email,
                    "subject": subject,
                    "has_attachment": pdf_bytes is not None,
                },
            )
            return True

        # Send with optional PDF attachment via Azure
        import asyncio as _asyncio
        import base64
        from concurrent.futures import ThreadPoolExecutor as _ThreadPoolExecutor

        def _send_sync_with_attachment() -> None:
            try:
                from azure.communication.email import EmailClient

                if not settings.azure_communication_connection_string:
                    raise EmailSendError("Azure connection string not configured")

                client = EmailClient.from_connection_string(
                    settings.azure_communication_connection_string
                )

                content: dict[str, str] = {"subject": subject, "plainText": body}

                message: dict[str, object] = {
                    "senderAddress": settings.email_from_address,
                    "senderDisplayName": settings.email_from_name,
                    "recipients": {"to": [{"address": to_email}]},
                    "content": content,
                }

                if pdf_bytes:
                    message["attachments"] = [
                        {
                            "name": f"receipt-{transaction_id[:8]}.pdf",
                            "contentType": "application/pdf",
                            "contentInBase64": base64.b64encode(pdf_bytes).decode(),
                        }
                    ]

                poller = client.begin_send(message)
                poller.result()

                logger.info(
                    "Receipt email sent",
                    extra={
                        "to": to_email,
                        "transaction_id": transaction_id,
                        "has_pdf": pdf_bytes is not None,
                    },
                )
            except Exception as exc:
                logger.error("Failed to send receipt email", extra={"error": str(exc)})
                raise EmailSendError(f"Receipt email failed: {exc}") from exc

        # Retry up to 3 times with exponential backoff
        delay = 1.0
        last_exc: Exception | None = None
        for attempt in range(3):
            try:
                loop = _asyncio.get_event_loop()
                with _ThreadPoolExecutor() as executor:
                    await loop.run_in_executor(executor, _send_sync_with_attachment)
                return True
            except EmailSendError as exc:
                last_exc = exc
                if attempt < 2:
                    await _asyncio.sleep(delay)
                    delay *= 2

        raise EmailSendError("Failed to send receipt email after 3 attempts") from last_exc


# Singleton instance
_email_service: EmailService | None = None


def get_email_service() -> EmailService:
    """Get email service singleton instance."""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
