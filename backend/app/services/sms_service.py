"""SMS notification service (T071).

Sends SMS via Twilio. If Twilio credentials are not configured, logs a warning and skips.
"""

import logging

logger = logging.getLogger(__name__)


async def send_sms(to_number: str, message: str) -> bool:
    """Send an SMS message via Twilio.

    Args:
        to_number: Recipient phone number (E.164 format)
        message: Message body (truncated to 160 chars)

    Returns:
        True if sent successfully.
    """
    # Truncate to SMS limit
    if len(message) > 160:
        message = message[:157] + "..."

    try:
        from app.core.config import get_settings

        settings = get_settings()
        twilio_sid = getattr(settings, "twilio_account_sid", None)
        twilio_token = getattr(settings, "twilio_auth_token", None)
        twilio_from = getattr(settings, "twilio_from_number", None)

        if not twilio_sid or not twilio_token or not twilio_from:
            logger.warning(
                "Twilio credentials not configured, skipping SMS",
                extra={"to": to_number},
            )
            return False

        # Lazy import to avoid hard dependency
        from twilio.rest import Client  # type: ignore[import-untyped]

        client = Client(twilio_sid, twilio_token)
        sms = client.messages.create(
            body=message,
            from_=twilio_from,
            to=to_number,
        )
        logger.info(
            "SMS sent",
            extra={"to": to_number, "sid": sms.sid},
        )
        return True
    except ImportError:
        logger.warning(
            "Twilio package not installed, skipping SMS",
            extra={"to": to_number},
        )
        return False
    except Exception:
        logger.exception(
            "Failed to send SMS",
            extra={"to": to_number},
        )
        return False
