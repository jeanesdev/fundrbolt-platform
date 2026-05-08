"""Shared utilities for report PDF generation."""

from __future__ import annotations

import base64
import ipaddress
import logging
import pathlib
import urllib.parse

import aiohttp

logger = logging.getLogger(__name__)

# Maximum image size accepted (5 MB) — prevents embedding huge files in PDFs
_MAX_IMAGE_BYTES = 5 * 1024 * 1024

_ASSETS_DIR = pathlib.Path(__file__).parent.parent / "templates" / "assets"


def get_fundrbolt_logo_b64() -> str | None:
    """Return the Fundrbolt logo as a base64-encoded PNG data URI.

    Reads the bundled logo from the templates/assets directory so that PDF
    generation works without any network access.  Returns None if the file
    is missing (should never happen in a correctly packaged deployment).
    """
    logo_path = _ASSETS_DIR / "fundrbolt-logo-navy-gold.png"
    try:
        data = logo_path.read_bytes()
        b64 = base64.b64encode(data).decode("ascii")
        return f"data:image/png;base64,{b64}"
    except OSError:
        logger.warning("Fundrbolt logo not found at %s", logo_path)
        return None


# Private / special-purpose address ranges to block (SSRF protection)
_BLOCKED_NETWORKS = [
    ipaddress.ip_network(cidr)
    for cidr in (
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "127.0.0.0/8",
        "169.254.0.0/16",  # link-local / Azure IMDS
        "100.64.0.0/10",  # shared address space
        "::1/128",
        "fc00::/7",
        "fe80::/10",
    )
]


def _is_safe_image_url(url: str) -> bool:
    """Return True only if the URL is safe to fetch for report images.

    Rejects:
    - Non-HTTPS schemes (file://, http://, etc.)
    - Private/loopback/link-local IP addresses (SSRF protection)
    """
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception:
        return False

    if parsed.scheme != "https":
        return False

    hostname = parsed.hostname or ""
    # Try to parse as IP — if it resolves to a blocked range, reject it.
    try:
        addr = ipaddress.ip_address(hostname)
        for network in _BLOCKED_NETWORKS:
            if addr in network:
                logger.warning("Blocked SSRF attempt to IP %s", hostname)
                return False
    except ValueError:
        # Not a bare IP — hostname-based URLs are allowed (DNS resolution
        # happens inside aiohttp; we can't prevent all DNS-rebinding here,
        # but blocking bare private IPs covers the most common vectors).
        pass

    return True


async def fetch_image_as_base64(
    url: str,
    session: aiohttp.ClientSession,
) -> str | None:
    """Fetch an image URL and return it as a base64-encoded data URI string.

    Returns None if the URL is empty, unsafe, the request fails, the response
    is not a successful image response, or the payload exceeds the size limit.
    Never raises — callers should treat None as "no image available".
    """
    if not url:
        return None
    if not _is_safe_image_url(url):
        logger.debug("Skipping unsafe/non-HTTPS image URL: %s", url)
        return None
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
            if resp.status != 200:
                logger.debug("Image fetch returned %d for %s", resp.status, url)
                return None
            content_type = resp.headers.get("Content-Type", "")
            # Only embed actual image content to prevent non-image injection
            if not content_type.startswith("image/"):
                logger.debug("Skipping non-image Content-Type %r for %s", content_type, url)
                return None
            # Guard against oversized payloads
            data = await resp.read()
            if not data or len(data) > _MAX_IMAGE_BYTES:
                logger.debug("Image data empty or too large (%d bytes) for %s", len(data), url)
                return None
            b64 = base64.b64encode(data).decode("ascii")
            mime = content_type.split(";")[0].strip()
            return f"data:{mime};base64,{b64}"
    except Exception:
        logger.debug("Image fetch failed for %s", url, exc_info=True)
        return None
