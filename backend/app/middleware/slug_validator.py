"""
Slug Validation Middleware

Validates event slug format before processing requests.
Ensures slugs are URL-safe and match expected pattern.
"""

import re
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Slug must be lowercase alphanumeric with hyphens
# Length: 3-100 characters
# Format: letters, numbers, hyphens only (no consecutive hyphens)
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MIN_SLUG_LENGTH = 3
MAX_SLUG_LENGTH = 100


class SlugValidationMiddleware(BaseHTTPMiddleware):
    """
    Validates event slug format in URL paths.

    Applies to routes matching /events/{slug} pattern.
    Returns 400 Bad Request for invalid slug formats.
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # Only validate event slug routes
        path = request.url.path
        if not path.startswith("/api/v1/events/") and not path.startswith("/api/v1/public/events/"):
            return await call_next(request)

        # Extract slug from path (format: /api/v1/events/{slug}/... or /api/v1/public/events/{slug})
        parts = path.split("/")
        try:
            # Find 'events' in path, slug is next part
            events_index = parts.index("events")
            if events_index + 1 < len(parts):
                slug = parts[events_index + 1]

                # Skip validation for non-slug routes (numeric IDs, special endpoints)
                if slug.isdigit() or slug in [
                    "public",
                    "search",
                    "featured",
                    "",
                ]:
                    return await call_next(request)

                # Validate slug format
                if not self._is_valid_slug(slug):
                    return Response(
                        content=f"Invalid event slug format: {slug}. Slugs must be 3-100 characters, lowercase letters, numbers, and hyphens only.",
                        status_code=400,
                        media_type="text/plain",
                    )
        except (ValueError, IndexError):
            # No 'events' in path or malformed path, skip validation
            pass

        return await call_next(request)

    def _is_valid_slug(self, slug: str) -> bool:
        """
        Validates slug format.

        Args:
            slug: Slug string to validate

        Returns:
            True if valid, False otherwise
        """
        # Check length
        if len(slug) < MIN_SLUG_LENGTH or len(slug) > MAX_SLUG_LENGTH:
            return False

        # Check pattern (lowercase alphanumeric + hyphens, no consecutive hyphens)
        if not SLUG_PATTERN.match(slug):
            return False

        return True
