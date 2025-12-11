#!/usr/bin/env python3
"""
Publish all draft auction items in the database.

This script updates all auction items with status='draft' to status='published'
so they will be visible to donors in the donor portal PWA.
"""

import asyncio
import sys

from sqlalchemy import select, update

from app.core.database import AsyncSessionLocal
from app.models.auction_item import AuctionItem, ItemStatus


async def publish_all_items():
    """Publish all draft auction items."""
    async with AsyncSessionLocal() as db:
        # Get all draft items
        draft_stmt = select(AuctionItem).where(AuctionItem.status == ItemStatus.DRAFT)
        result = await db.execute(draft_stmt)
        draft_items = result.scalars().all()

        if not draft_items:
            print("✓ No draft auction items found. All items are already published.")
            return 0

        print(f"\nFound {len(draft_items)} draft auction items:")
        for item in draft_items:
            print(f"  - {item.title} (ID: {item.id})")

        # Confirm before proceeding
        response = input(f"\nPublish all {len(draft_items)} items? (y/n): ")
        if response.lower() != "y":
            print("❌ Cancelled. No changes made.")
            return 1

        # Update all draft items to published
        update_stmt = (
            update(AuctionItem)
            .where(AuctionItem.status == ItemStatus.DRAFT)
            .values(status=ItemStatus.PUBLISHED)
        )
        await db.execute(update_stmt)
        await db.commit()

        print(f"\n✅ Successfully published {len(draft_items)} auction items!")
        print("Items are now visible to donors in the donor portal.\n")
        return 0


async def main():
    """Main entry point."""
    try:
        exit_code = await publish_all_items()
        sys.exit(exit_code)
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
