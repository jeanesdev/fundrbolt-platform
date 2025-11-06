"""Consent check middleware for GDPR compliance.

This middleware enforces that authenticated users have accepted the latest
legal documents before accessing protected endpoints.
"""

import logging
from collections.abc import Awaitable, Callable

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.database import AsyncSessionLocal
from app.services.consent_service import ConsentService

logger = logging.getLogger(__name__)


class ConsentCheckMiddleware(BaseHTTPMiddleware):
    """Middleware to check user consent status for authenticated requests.

    Business Rules:
    - Only checks authenticated requests (has valid JWT)
    - Exempt paths: /auth/*, /legal/*, /consent/*, /health, /metrics, /docs
    - If user has outdated consent, returns 409 Conflict
    - Does NOT block anonymous/public endpoints

    Response on outdated consent:
    - Status: 409 Conflict
    - Body: JSON with error code and current/required versions
    """

    EXEMPT_PATHS = [
        "/api/v1/auth",  # Authentication endpoints
        "/api/v1/legal",  # Legal document endpoints (public)
        "/api/v1/consent",  # Consent management endpoints
        "/api/v1/cookies",  # Cookie consent endpoints (public)
        "/api/v1/invitations",  # Invitation acceptance (user may not have consent yet)
        "/health",  # Health checks
        "/metrics",  # Prometheus metrics
        "/docs",  # API documentation
        "/redoc",  # ReDoc documentation
        "/openapi.json",  # OpenAPI schema
        "/",  # Root endpoint
    ]

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Check consent status before routing to endpoint.

        Args:
            request: FastAPI request
            call_next: Next middleware in chain

        Returns:
            Response from endpoint or 409 if consent required
        """
        # Skip exempt paths
        path = request.url.path
        if any(path.startswith(exempt) for exempt in self.EXEMPT_PATHS):
            return await call_next(request)

        # Skip if no Authorization header (anonymous/public endpoint)
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return await call_next(request)

        # Try to extract user ID from token (without full validation)
        try:
            token = auth_header.replace("Bearer ", "")

            # Import here to avoid circular dependency
            from app.core.security import decode_token

            payload = decode_token(token)
            user_id_str = payload.get("sub")

            if not user_id_str:
                # Invalid token - let auth middleware handle it
                return await call_next(request)

            # Check consent status
            async with AsyncSessionLocal() as db:
                # Get user
                from sqlalchemy import select

                from app.models.user import User

                stmt = select(User).where(User.id == user_id_str)
                result = await db.execute(stmt)
                user = result.scalar_one_or_none()

                if not user:
                    # User not found - let auth middleware handle it
                    return await call_next(request)

                # Check consent status
                service = ConsentService()
                consent_status = await service.get_consent_status(db=db, user=user)

                # If consent required, block request with 409
                if consent_status.consent_required:
                    logger.warning(
                        f"User {user.email} has outdated consent - blocking request to {path}"
                    )
                    return JSONResponse(
                        status_code=status.HTTP_409_CONFLICT,
                        content={
                            "error": {
                                "code": "CONSENT_REQUIRED",
                                "message": "You must accept the updated legal documents to continue",
                                "details": {
                                    "current_tos_version": consent_status.current_tos_version,
                                    "current_privacy_version": consent_status.current_privacy_version,
                                    "latest_tos_version": consent_status.latest_tos_version,
                                    "latest_privacy_version": consent_status.latest_privacy_version,
                                },
                            }
                        },
                    )

                # If no active consent at all, also block (except for initial consent)
                if not consent_status.has_active_consent:
                    logger.warning(
                        f"User {user.email} has no active consent - blocking request to {path}"
                    )
                    return JSONResponse(
                        status_code=status.HTTP_409_CONFLICT,
                        content={
                            "error": {
                                "code": "CONSENT_REQUIRED",
                                "message": "You must accept the legal documents to continue",
                                "details": {
                                    "latest_tos_version": consent_status.latest_tos_version,
                                    "latest_privacy_version": consent_status.latest_privacy_version,
                                },
                            }
                        },
                    )

        except Exception as e:
            # Any error in consent check - log and allow request
            # (auth middleware will handle invalid tokens)
            logger.error(f"Error checking consent status: {e}")

        # Consent is valid or check failed - proceed
        return await call_next(request)
