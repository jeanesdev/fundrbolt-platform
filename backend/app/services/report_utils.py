"""Shared utilities for report PDF generation."""

from __future__ import annotations

import base64
import io
import ipaddress
import logging
import pathlib
import urllib.parse

import aiohttp

logger = logging.getLogger(__name__)

# Maximum image size accepted (5 MB) — prevents embedding huge files in PDFs
_MAX_IMAGE_BYTES = 5 * 1024 * 1024
# Maximum pixel dimension (width or height) for embedded report images.
# Beyond this the extra detail is invisible in print; keeping it small
# dramatically reduces the HTML payload WeasyPrint has to parse.
_MAX_IMAGE_PX = 1000

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


def _compress_image_for_print(data: bytes, mime: str) -> tuple[bytes, str]:
    """Resize and compress an image to a PDF-appropriate size.

    Resizes so the longest edge is at most *_MAX_IMAGE_PX* pixels and
    re-encodes as JPEG at quality 82.  Returns the (bytes, mime) tuple.
    Originals that are already small are passed through unchanged.
    Falls back to the original data on any Pillow error.
    """
    try:
        from PIL import Image  # noqa: PLC0415

        img: Image.Image = Image.open(io.BytesIO(data))
        # Convert palette / transparency modes to RGB for JPEG encoding
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        w, h = img.size
        if max(w, h) > _MAX_IMAGE_PX:
            ratio = _MAX_IMAGE_PX / max(w, h)
            img = img.resize(
                (int(w * ratio), int(h * ratio)),
                Image.Resampling.LANCZOS,
            )
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=82, optimize=True)
        return buf.getvalue(), "image/jpeg"
    except Exception:
        logger.debug("Image compression failed; using original", exc_info=True)
        return data, mime


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
            mime = content_type.split(";")[0].strip()
            # Resize/compress to print-appropriate dimensions so WeasyPrint
            # doesn't have to parse multi-megabyte base64 blobs per card.
            data, mime = _compress_image_for_print(data, mime)
            b64 = base64.b64encode(data).decode("ascii")
            return f"data:{mime};base64,{b64}"
    except Exception:
        logger.debug("Image fetch failed for %s", url, exc_info=True)
        return None
