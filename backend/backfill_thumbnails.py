"""Backfill thumbnails for auction item media records that have no thumbnail_path.

Queries all AuctionItemMedia records where thumbnail_path IS NULL, downloads the
original image from Azure Blob Storage, generates 200x200 and 800x600 thumbnails,
uploads them, and updates the database record with thumbnail_path.

Usage:
    cd backend && poetry run python backfill_thumbnails.py [--dry-run] [--limit N]
"""

import argparse
import asyncio
import logging

from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.database import get_db
from app.models.auction_item import AuctionItemMedia
from app.services.auction_item_media_service import AuctionItemMediaService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


async def backfill(dry_run: bool, limit: int | None) -> None:
    settings = get_settings()

    async for db in get_db():
        # Query media records with no thumbnail and an Azure blob URL
        stmt = (
            select(AuctionItemMedia)
            .where(
                AuctionItemMedia.thumbnail_path.is_(None),
                AuctionItemMedia.file_path.ilike("https://%"),
                AuctionItemMedia.mime_type.ilike("image/%"),
            )
            .order_by(AuctionItemMedia.created_at)
        )
        if limit:
            stmt = stmt.limit(limit)

        result = await db.execute(stmt)
        records = result.scalars().all()

        log.info(f"Found {len(records)} media records without thumbnails")

        media_service = AuctionItemMediaService(settings, db)

        if not media_service.blob_service_client:
            log.error("Azure Blob Storage not configured — set AZURE_STORAGE_CONNECTION_STRING")
            return

        success = 0
        skipped = 0
        failed = 0

        for record in records:
            # Extract blob name from URL (strip query string / SAS token)
            file_url = record.file_path.split("?")[0]
            container_path = f"{settings.azure_storage_container_name}/"
            if container_path not in file_url:
                log.warning(f"  SKIP {record.id}: URL doesn't match container — {file_url}")
                skipped += 1
                continue

            blob_name = file_url.split(container_path, 1)[1]
            log.info(f"  Processing {record.id} ({record.file_name}) — {blob_name}")

            if dry_run:
                log.info("    [DRY RUN] Would generate thumbnail")
                continue

            try:
                # Download original image
                blob_client = media_service.blob_service_client.get_blob_client(
                    container=media_service.container_name, blob=blob_name
                )
                downloader = blob_client.download_blob()
                file_content = downloader.readall()

                # Generate thumbnails
                thumbnails = await media_service._generate_thumbnails(file_content, blob_name)
                thumbnail_path = thumbnails.get("small")

                if not thumbnail_path:
                    log.warning(f"    No 'small' thumbnail returned for {record.id}")
                    skipped += 1
                    continue

                # Update the record
                await db.execute(
                    update(AuctionItemMedia)
                    .where(AuctionItemMedia.id == record.id)
                    .values(thumbnail_path=thumbnail_path)
                )
                await db.commit()

                log.info(f"    ✓ thumbnail_path = {thumbnail_path[-60:]}")
                success += 1

            except Exception as exc:
                log.error(f"    ✗ Failed for {record.id}: {exc}")
                await db.rollback()
                failed += 1

        log.info(
            f"\nDone. success={success}, skipped={skipped}, failed={failed}"
            + (" [DRY RUN]" if dry_run else "")
        )
        break  # Only one DB session needed


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill thumbnails for auction item media")
    parser.add_argument(
        "--dry-run", action="store_true", help="Show what would be done, don't write"
    )
    parser.add_argument("--limit", type=int, default=None, help="Process at most N records")
    args = parser.parse_args()

    asyncio.run(backfill(dry_run=args.dry_run, limit=args.limit))


if __name__ == "__main__":
    main()
