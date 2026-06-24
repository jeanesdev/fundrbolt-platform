"""Helpers for normalizing signed event media URLs in API responses."""

from typing import Any
from urllib.parse import unquote, urlparse

from app.models.event import EventMediaType, EventMediaUsageTag


def extract_blob_name(file_url: str) -> str | None:
    """Extract the blob name from an Azure Blob Storage URL."""
    parsed_url = urlparse(file_url)
    path = parsed_url.path.lstrip("/")
    if not path:
        return None

    path_parts = path.split("/", 1)
    if len(path_parts) < 2:
        return None

    return unquote(path_parts[1])


def add_sas_urls_to_event_media(
    response_dict: dict[str, Any], source_media: list[Any] | None = None
) -> None:
    """Replace event media URLs with read SAS URLs in-place."""
    from app.services.media_service import MediaService

    if response_dict.get("media"):
        source_media_by_id = {getattr(media, "id", None): media for media in (source_media or [])}

        for media_item in response_dict["media"]:
            file_url = media_item.get("file_url", "")
            if not file_url:
                continue

            source_item = source_media_by_id.get(media_item.get("id"))
            blob_name = getattr(source_item, "blob_name", None) or extract_blob_name(file_url)
            if not blob_name:
                continue

            media_item["file_url"] = MediaService.generate_read_sas_url(blob_name)

    layout_url = response_dict.get("seating_layout_image_url")
    if layout_url and "blob.core.windows.net" in layout_url:
        blob_name = extract_blob_name(layout_url)
        if blob_name:
            response_dict["seating_layout_image_url"] = MediaService.generate_read_sas_url(
                blob_name
            )


def get_signed_asset_url(file_url: str | None, blob_name: str | None = None) -> str | None:
    """Return a read SAS URL for private blob assets, otherwise return the original URL."""
    from app.services.media_service import MediaService

    if not file_url:
        return None

    resolved_blob_name = blob_name or extract_blob_name(file_url)
    if resolved_blob_name and "blob.core.windows.net" in file_url:
        return MediaService.generate_read_sas_url(resolved_blob_name)

    return file_url


def _resolve_logo_media_url(event: Any, usage_tags: tuple[str, ...]) -> str | None:
    """Resolve a signed logo asset URL from prioritized event media usage tags."""
    media_items = list(getattr(event, "media", []) or [])
    prioritized_tags = set(usage_tags)

    for usage_tag in usage_tags:
        match = next(
            (item for item in media_items if getattr(item, "usage_tag", None) == usage_tag), None
        )
        if match:
            return get_signed_asset_url(
                getattr(match, "file_url", None), getattr(match, "blob_name", None)
            )

    filename_match = next(
        (
            item
            for item in media_items
            if getattr(item, "usage_tag", None) not in prioritized_tags
            and "logo" in (getattr(item, "file_name", "") or "").lower()
        ),
        None,
    )
    if filename_match:
        return get_signed_asset_url(
            getattr(filename_match, "file_url", None),
            getattr(filename_match, "blob_name", None),
        )

    return get_signed_asset_url(getattr(event, "logo_url", None))


def resolve_event_logo_url(event: Any) -> str | None:
    """Resolve the preferred event logo URL using the same tag priority as the donor page."""
    return _resolve_logo_media_url(
        event,
        (
            EventMediaUsageTag.EVENT_LOGO.value,
            EventMediaUsageTag.EVENT_LOGO_ICON.value,
            EventMediaUsageTag.NPO_LOGO.value,
            EventMediaUsageTag.NPO_LOGO_ICON.value,
        ),
    )


def resolve_event_card_thumbnail_url(event: Any) -> str | None:
    """Resolve the preferred donor home-page card thumbnail for an event.

    Priority:
    1. Tagged event/NPO logo assets
    2. Legacy event.logo_url
    3. Tagged main hero image
    4. First non-map image fallback

    Layout-map assets are intentionally excluded so seating maps never appear
    as the event card image.
    """
    logo_url = _resolve_logo_media_url(
        event,
        (
            EventMediaUsageTag.EVENT_LOGO_ICON.value,
            EventMediaUsageTag.EVENT_LOGO.value,
            EventMediaUsageTag.NPO_LOGO_ICON.value,
            EventMediaUsageTag.NPO_LOGO.value,
        ),
    )
    if logo_url:
        return logo_url

    media_items = list(getattr(event, "media", []) or [])

    hero_match = next(
        (
            item
            for item in media_items
            if getattr(item, "usage_tag", None)
            in (
                EventMediaUsageTag.MAIN_EVENT_PAGE_HERO,
                EventMediaUsageTag.MAIN_EVENT_PAGE_HERO.value,
            )
        ),
        None,
    )
    if hero_match:
        return get_signed_asset_url(
            getattr(hero_match, "file_url", None), getattr(hero_match, "blob_name", None)
        )

    fallback_image = next(
        (
            item
            for item in media_items
            if getattr(item, "usage_tag", None)
            not in (EventMediaUsageTag.EVENT_LAYOUT_MAP, EventMediaUsageTag.EVENT_LAYOUT_MAP.value)
            and getattr(item, "media_type", None)
            in (EventMediaType.IMAGE, EventMediaType.IMAGE.value, "image")
        ),
        None,
    )
    if fallback_image:
        return get_signed_asset_url(
            getattr(fallback_image, "file_url", None),
            getattr(fallback_image, "blob_name", None),
        )

    return None


def get_media_variant_urls(blob_name: str) -> dict[str, str]:
    """
    Generate SAS URLs for image variants (thumbnail, medium, large) based on blob name.

    Variants are generated during upload as:
    - {base_name}_thumbnail.{ext}
    - {base_name}_medium.{ext}
    - {base_name}_large.{ext}

    Args:
        blob_name: Original blob name (e.g., events/{event_id}/{media_id}/banner.jpg)

    Returns:
        Dictionary with variant URLs, e.g. {
            'thumbnail': 'https://.../_thumbnail.jpg?token=...',
            'medium': 'https://.../_medium.jpg?token=...',
            'large': 'https://.../_large.jpg?token=...',
            'original': 'https://.../banner.jpg?token=...'
        }
    """
    from app.services.media_service import MediaService

    if not blob_name:
        return {}

    # Split filename from path
    path_parts = blob_name.rsplit("/", 1)
    if len(path_parts) != 2:
        return {}

    directory = path_parts[0]
    filename = path_parts[1]

    # Split base name and extension
    file_parts = filename.rsplit(".", 1)
    if len(file_parts) != 2:
        return {}

    base_name = file_parts[0]
    ext = file_parts[1]

    variants = {}
    for variant_name in ["thumbnail", "medium", "large"]:
        variant_blob_name = f"{directory}/{base_name}_{variant_name}.{ext}"
        try:
            variants[variant_name] = MediaService.generate_read_sas_url(variant_blob_name)
        except Exception:
            # Silently skip missing variants
            pass

    # Always include original
    variants["original"] = MediaService.generate_read_sas_url(blob_name)
    return variants
