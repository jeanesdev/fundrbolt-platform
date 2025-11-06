"""Test script to send a test email via Azure Communication Services."""

import asyncio
import sys

from app.services.email_service import get_email_service


async def test_send_email(to_email: str) -> None:
    """Send a test email."""
    email_service = get_email_service()

    print(f"Email service enabled: {email_service.enabled}")
    print(f"Sending test email to: {to_email}")

    try:
        success = await email_service.send_verification_email(
            to_email=to_email,
            verification_token="test-token-12345",
            user_name="Test User",
        )

        if success:
            print("✅ Email sent successfully!")
        else:
            print("❌ Email sending failed")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: poetry run python test_email.py <email_address>")
        sys.exit(1)

    email = sys.argv[1]
    asyncio.run(test_send_email(email))
