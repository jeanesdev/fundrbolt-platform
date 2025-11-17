"""
Seed auction items for development/testing.

This script creates realistic auction items across different events.
Run with: poetry run python seed_auction_items_simple.py
"""

import asyncio
import os
import sys

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from decimal import Decimal

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.auction_item import AuctionType
from app.models.event import Event
from app.models.user import User
from app.schemas.auction_item import AuctionItemCreate
from app.services.auction_item_service import AuctionItemService, calculate_bid_increment


async def seed_auction_items():
    """Create sample auction items across events."""
    async with AsyncSessionLocal() as session:
        # Get a super admin user to create items
        result = await session.execute(select(User).where(User.email == "super_admin@test.com"))
        user = result.scalar_one_or_none()

        if not user:
            print("❌ No super admin user found. Please run seed_test_users.py first.")
            return

        # Get all events
        stmt = select(Event).order_by(Event.event_datetime)
        result = await session.execute(stmt)
        events = result.scalars().all()

        if not events:
            print("❌ No events found. Please create at least one event first.")
            return

        print(f"✅ Found {len(events)} event(s) to seed with auction items\n")

        # Create auction item service
        auction_service = AuctionItemService(session)

        # Sample auction items
        items_data = [
            AuctionItemCreate(
                title="Weekend Getaway at Luxury Resort",
                description="Enjoy a relaxing 3-night stay at the Grand Mountain Resort. Includes spa treatment for two, gourmet breakfast, and resort credits. Valid for 1 year.",
                auction_type=AuctionType.LIVE,
                starting_bid=Decimal("500.00"),
                bid_increment=calculate_bid_increment(Decimal("500.00")),
                buy_now_price=Decimal("1200.00"),
                buy_now_enabled=True,
                donor_value=Decimal("1500.00"),
                cost=Decimal("0.00"),
                quantity_available=1,
                donated_by="Grand Mountain Resort & Spa",
                item_webpage="https://grandmountainresort.example.com",
                display_priority=100,
            ),
            AuctionItemCreate(
                title="Wine Tasting Experience for Four",
                description="Private wine tasting at Vineyard Estate with sommelier-guided tour. Includes tasting of 8 premium wines and gourmet cheese pairing.",
                auction_type=AuctionType.LIVE,
                starting_bid=Decimal("300.00"),
                bid_increment=calculate_bid_increment(Decimal("300.00")),
                buy_now_price=Decimal("600.00"),
                buy_now_enabled=True,
                donor_value=Decimal("800.00"),
                cost=Decimal("0.00"),
                quantity_available=2,
                donated_by="Vineyard Estate Wines",
                item_webpage="https://vineyardestate.example.com",
                display_priority=90,
            ),
            AuctionItemCreate(
                title="Original Artwork by Local Artist",
                description="Beautiful 24x36 canvas painting featuring mountain landscape. Professionally framed and ready to hang. One-of-a-kind piece.",
                auction_type=AuctionType.LIVE,
                starting_bid=Decimal("400.00"),
                bid_increment=calculate_bid_increment(Decimal("400.00")),
                buy_now_price=Decimal("1000.00"),
                buy_now_enabled=True,
                donor_value=Decimal("1200.00"),
                cost=Decimal("0.00"),
                quantity_available=1,
                donated_by="Sarah Mitchell Art Studio",
                item_webpage="https://sarahmitchellart.example.com",
                display_priority=80,
            ),
            AuctionItemCreate(
                title="Golf Package at Championship Course",
                description="Foursome golf package at Pebble Creek Championship Golf Course. Includes cart, range balls, and lunch at the clubhouse.",
                auction_type=AuctionType.LIVE,
                starting_bid=Decimal("200.00"),
                bid_increment=calculate_bid_increment(Decimal("200.00")),
                buy_now_price=Decimal("500.00"),
                buy_now_enabled=True,
                donor_value=Decimal("600.00"),
                cost=Decimal("0.00"),
                quantity_available=3,
                donated_by="Pebble Creek Golf Club",
                item_webpage="https://pebblecreekgolf.example.com",
                display_priority=70,
            ),
            AuctionItemCreate(
                title="Gourmet Coffee Gift Basket",
                description="Premium coffee lovers bundle with artisan roasted beans, French press, and gourmet treats. Perfect gift for coffee enthusiasts.",
                auction_type=AuctionType.SILENT,
                starting_bid=Decimal("25.00"),
                bid_increment=calculate_bid_increment(Decimal("25.00")),
                buy_now_price=Decimal("75.00"),
                buy_now_enabled=True,
                donor_value=Decimal("100.00"),
                cost=Decimal("0.00"),
                quantity_available=5,
                donated_by="Roastery Coffee Co.",
                item_webpage="https://roasterycoffee.example.com",
                display_priority=60,
            ),
            AuctionItemCreate(
                title="Spa Day Package",
                description="Full day spa package including massage, facial, manicure, and access to spa facilities. Valid for 6 months.",
                auction_type=AuctionType.SILENT,
                starting_bid=Decimal("100.00"),
                bid_increment=calculate_bid_increment(Decimal("100.00")),
                buy_now_price=Decimal("200.00"),
                buy_now_enabled=True,
                donor_value=Decimal("250.00"),
                cost=Decimal("0.00"),
                quantity_available=2,
                donated_by="Serenity Spa & Wellness",
                item_webpage="https://serenityspa.example.com",
                display_priority=55,
            ),
            AuctionItemCreate(
                title="Professional Photography Session",
                description="2-hour family or portrait photography session with professional photographer. Includes 20 edited digital images.",
                auction_type=AuctionType.SILENT,
                starting_bid=Decimal("75.00"),
                bid_increment=calculate_bid_increment(Decimal("75.00")),
                buy_now_price=Decimal("250.00"),
                buy_now_enabled=True,
                donor_value=Decimal("300.00"),
                cost=Decimal("0.00"),
                quantity_available=3,
                donated_by="Capture Moments Photography",
                item_webpage="https://capturemoments.example.com",
                display_priority=50,
            ),
            AuctionItemCreate(
                title="Cooking Class with Celebrity Chef",
                description="Hands-on cooking class featuring Italian cuisine. Learn to make fresh pasta, sauces, and authentic dishes. Includes dinner and wine.",
                auction_type=AuctionType.SILENT,
                starting_bid=Decimal("80.00"),
                bid_increment=calculate_bid_increment(Decimal("80.00")),
                buy_now_price=Decimal("150.00"),
                buy_now_enabled=True,
                donor_value=Decimal("200.00"),
                cost=Decimal("0.00"),
                quantity_available=10,
                donated_by="Chef Marco's Culinary School",
                item_webpage="https://chefmarcos.example.com",
                display_priority=45,
            ),
            AuctionItemCreate(
                title="Designer Handbag",
                description="Authentic designer leather handbag from premium collection. Brand new with tags and authentication certificate.",
                auction_type=AuctionType.SILENT,
                starting_bid=Decimal("60.00"),
                bid_increment=calculate_bid_increment(Decimal("60.00")),
                buy_now_price=Decimal("300.00"),
                buy_now_enabled=True,
                donor_value=Decimal("400.00"),
                cost=Decimal("0.00"),
                quantity_available=1,
                donated_by="Luxe Fashion Boutique",
                item_webpage="https://luxefashion.example.com",
                display_priority=40,
            ),
            AuctionItemCreate(
                title="Art Supplies Bundle",
                description="Complete art supplies set including professional-grade paints, brushes, canvas, and easel. Perfect for beginners or experienced artists.",
                auction_type=AuctionType.SILENT,
                starting_bid=Decimal("30.00"),
                bid_increment=calculate_bid_increment(Decimal("30.00")),
                buy_now_price=Decimal("100.00"),
                buy_now_enabled=True,
                donor_value=Decimal("150.00"),
                cost=Decimal("0.00"),
                quantity_available=4,
                donated_by="Creative Arts Supply Store",
                item_webpage="https://creativeartssupply.example.com",
                display_priority=35,
            ),
        ]

        created_count = 0
        # Distribute items across events
        for idx, item_data in enumerate(items_data):
            event = events[idx % len(events)]

            print(f"Creating: {item_data.title} for event {event.name}")
            try:
                created_item = await auction_service.create_auction_item(
                    event_id=event.id,
                    item_data=item_data,
                    created_by=user.id,
                )
                print(f"  ✅ Created with bid number: {created_item.bid_number}")
                created_count += 1
            except Exception as e:
                print(f"  ❌ Error: {str(e)}")

        await session.commit()

        print(f"\n🎉 Successfully created {created_count} auction items!")
        print("💡 Note: To add images, use the admin UI to upload media for these items.")


async def main():
    """Main entry point."""
    print("🌱 Seeding auction items...\n")
    try:
        await seed_auction_items()
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback

        traceback.print_exc()
        return 1
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
