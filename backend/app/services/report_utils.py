"""Shared utilities for report PDF generation."""

from __future__ import annotations

import logging

import aiohttp

logger = logging.getLogger(__name__)


async def fetch_image_as_base64(
    url: str,
    session: aiohttp.ClientSession,
) -> str | None:
    """Fetch an image URL and return it as a base64-encoded data URI string.

    Returns None if the URL is empty, the request fails, or the response is
    not a successful image response. Never raises — callers should treat None
    as "no image available".
    """
    if not url:
        return None
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
            if resp.status != 200:
                logger.debug("Image fetch returned %d for %s", resp.status, url)
                return None
            content_type = resp.headers.get("Content-Type", "image/png")
            data = await resp.read()
            if not data:
                return None
            import base64

            b64 = base64.b64encode(data).decode("ascii")
            return f"data:{content_type.split(';')[0]};base64,{b64}"
    except Exception:
        logger.debug("Image fetch failed for %s", url, exc_info=True)
        return None
