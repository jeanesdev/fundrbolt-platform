"""Contact form submission endpoints (public)."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.metrics import CONTACT_SUBMISSIONS_TOTAL
from app.middleware.rate_limit import rate_limit
from app.schemas.contact import ContactSubmissionCreate, ContactSubmissionResponse
from app.services.contact_service import ContactService
from app.services.email_service import EmailService

router = APIRouter(prefix="/contact", tags=["public-contact"])
logger = get_logger(__name__)


@router.post(
    "/submit",
    response_model=ContactSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit contact form",
    description="Submit a contact form message. Rate limited to 5 submissions per hour per IP address.",
)
@rate_limit(max_requests=5, window_seconds=3600)  # 5 requests per hour
async def submit_contact_form(
    data: ContactSubmissionCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ContactSubmissionResponse:
    """
    Submit contact form from landing page.

    **Rate Limit**: 5 submissions per hour per IP address

    **Request Body**:
    - sender_name: Full name (2-100 characters)
    - sender_email: Valid email address
    - subject: Message subject (1-200 characters)
    - message: Message content (1-5000 characters)

    **Returns**:
    - Contact submission confirmation with ID and status

    **Errors**:
    - 422: Validation error (invalid fields)
    - 429: Too many requests (rate limit exceeded)
    - 500: Server error
    """
    try:
        # Initialize services
        email_service = EmailService()
        contact_service = ContactService(db=db, email_service=email_service)

        # Create submission
        submission = await contact_service.create_submission(data=data, request=request)

        # Track successful submission
        CONTACT_SUBMISSIONS_TOTAL.labels(status="success").inc()

        return submission

    except Exception as e:
        # Track failed submission
        CONTACT_SUBMISSIONS_TOTAL.labels(status="failure").inc()

        # Log error with context AND full exception details
        logger.error(
            "Contact form submission failed",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "sender_email": data.sender_email,
            },
            exc_info=True,  # This will log the full traceback
        )

        # Don't expose details to client
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit contact form. Please try again later.",
        ) from e
