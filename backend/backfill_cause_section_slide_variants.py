"""Backfill image variants for cause section slideshow uploads.

Generates thumbnail/medium/large variants for existing upload-backed cause section
slides whose variant blobs are missing.

Usage:
    cd backend && poetry run python backfill_cause_section_slide_variants.py [--dry-run] [--limit N] [--force]
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import re
import uuid

from azure.core.exceptions import ResourceNotFoundError
from sqlalchemy import select

from app.api.v1.event_media_urls import extract_blob_name
from app.core.config import get_settings
from app.core.database import get_db
from app.models.cause_section_card import CauseSectionSlideItem, MediaSourceEnum
from app.services.media_service import MediaService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

_EVENT_BLOB_RE = re.compile(
    r"^events/(?P<event_id>[0-9a-fA-F-]{36})/(?P<media_id>[0-9a-fA-F-]{36})/(?P<filename>.+)$"
)


def _get_medium_blob_name(blob_name: str) -> str | None:
    parts = blob_name.rsplit("/", 1)
    if len(parts) != 2:
        return None

    directory, filename = parts
    file_parts = filename.rsplit(".", 1)
    if len(file_parts) != 2:
        return None

    base_name, ext = file_parts
    return f"{directory}/{base_name}_medium.{ext}"


async def backfill(dry_run: bool, limit: int | None, force: bool) -> None:
    settings = get_settings()
    container_name = settings.azure_storage_container_name or "event-media"
    blob_service_client = MediaService._get_blob_client()

    async for db in get_db():
        stmt = (
            select(CauseSectionSlideItem)
            .where(
                CauseSectionSlideItem.media_source == MediaSourceEnum.UPLOAD,
                CauseSectionSlideItem.media_url.is_not(None),
            )
            .order_by(CauseSectionSlideItem.created_at.asc())
        )

        if limit:
            stmt = stmt.limit(limit)

        result = await db.execute(stmt)
        slides = result.scalars().all()

        log.info("Found %s upload-backed cause section slides", len(slides))

        generated = 0
        skipped = 0
        failed = 0

        for slide in slides:
            if not slide.media_url:
                skipped += 1
                continue

            blob_name = extract_blob_name(slide.media_url)
            if not blob_name:
                log.warning("SKIP %s: unable to parse blob name", slide.id)
                skipped += 1
                continue

            match = _EVENT_BLOB_RE.match(blob_name)
            if not match:
                log.warning(
                    "SKIP %s: blob path does not match event media pattern (%s)",
                    slide.id,
                    blob_name,
                )
                skipped += 1
                continue

            event_id = uuid.UUID(match.group("event_id"))
            media_id = uuid.UUID(match.group("media_id"))
            filename = match.group("filename")

            medium_blob_name = _get_medium_blob_name(blob_name)
            if not medium_blob_name:
                log.warning(
                    "SKIP %s: invalid filename for variant generation (%s)", slide.id, blob_name
                )
                skipped += 1
                continue

            if not force:
                try:
                    medium_blob = blob_service_client.get_blob_client(
                        container=container_name,
                        blob=medium_blob_name,
                    )
                    medium_blob.get_blob_properties()
                    skipped += 1
                    continue
                except ResourceNotFoundError:
                    pass
                except Exception as exc:
                    log.warning(
                        "WARN %s: unable to check medium variant existence (%s)", slide.id, exc
                    )

            log.info("Processing slide=%s blob=%s", slide.id, blob_name)

            if dry_run:
                generated += 1
                continue

            try:
                source_blob = blob_service_client.get_blob_client(
                    container=container_name,
                    blob=blob_name,
                )
                file_bytes = source_blob.download_blob().readall()

                await MediaService._generate_and_upload_image_variants(
                    container_name=container_name,
                    event_id=event_id,
                    media_id=media_id,
                    filename=filename,
                    file_bytes=file_bytes,
                )
                generated += 1
            except Exception as exc:
                failed += 1
                log.error("FAIL %s: %s", slide.id, exc)

        log.info(
            "Done. generated=%s skipped=%s failed=%s%s",
            generated,
            skipped,
            failed,
            " [DRY RUN]" if dry_run else "",
        )
        break


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill thumbnail/medium/large image variants for cause section slide uploads"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be generated without writing blobs",
    )
    parser.add_argument("--limit", type=int, default=None, help="Process at most N slides")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate variants even when medium variant already exists",
    )
    args = parser.parse_args()

    asyncio.run(backfill(dry_run=args.dry_run, limit=args.limit, force=args.force))


if __name__ == "__main__":
    main()
