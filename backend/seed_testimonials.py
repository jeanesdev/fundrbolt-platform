"""Seed testimonials for landing page."""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_engine
from app.models.testimonial import Testimonial
from app.models.user import User


async def seed_testimonials() -> None:
    """Create sample testimonials for landing page."""
    async with async_engine.begin() as conn:
        session = AsyncSession(bind=conn, expire_on_commit=False)

        # Get a superadmin user to be the creator
        result = await session.execute(
            select(User).where(User.email == "super_admin@test.com").limit(1)
        )
        admin_user = result.scalar_one_or_none()

        if not admin_user:
            print("❌ Error: No admin user found. Run seed_test_users.py first.")
            return

        # Check if testimonials already exist
        result = await session.execute(select(Testimonial).limit(1))
        if result.scalar_one_or_none():
            print("ℹ️  Testimonials already exist. Skipping seed.")
            return

        testimonials_data = [
            {
                "quote_text": "Fundrbolt completely transformed our annual gala. The mobile bidding feature was a game-changer - our donors loved being able to bid from their seats without missing a moment of the program. We raised 40% more than last year!",
                "author_name": "Sarah Johnson",
                "author_role": "npo_admin",
                "organization_name": "Hope for Tomorrow Foundation",
                "photo_url": None,
                "display_order": 1,
                "is_published": True,
            },
            {
                "quote_text": "As a donor, I appreciate how easy Fundrbolt makes it to support the causes I care about. The real-time notifications kept me engaged throughout the event, and the checkout process was seamless. I've bid on items at three different galas using Fundrbolt and had a great experience every time.",
                "author_name": "Michael Chen",
                "author_role": "donor",
                "organization_name": None,
                "photo_url": None,
                "display_order": 2,
                "is_published": True,
            },
            {
                "quote_text": "I've been an auctioneer for over 15 years, and Fundrbolt is hands down the best platform I've used. The dashboard gives me real-time insights into bidding activity, and the automated notifications keep donors engaged without me having to do anything. It makes my job so much easier!",
                "author_name": "Jennifer Martinez",
                "author_role": "auctioneer",
                "organization_name": "Professional Auctioneers Association",
                "photo_url": None,
                "display_order": 3,
                "is_published": True,
            },
            {
                "quote_text": "The analytics provided by Fundrbolt helped us understand our donor behavior better than ever before. We could see which items generated the most interest and adjust our strategy in real-time. The platform paid for itself many times over.",
                "author_name": "Robert Williams",
                "author_role": "npo_admin",
                "organization_name": "Community Arts Center",
                "photo_url": None,
                "display_order": 4,
                "is_published": True,
            },
            {
                "quote_text": "I was skeptical about mobile bidding at first, but Fundrbolt won me over immediately. The interface is so intuitive that even my less tech-savvy friends had no trouble using it. Plus, getting notifications when someone outbids you adds a fun, competitive element to the event!",
                "author_name": "Emily Davis",
                "author_role": "donor",
                "organization_name": None,
                "photo_url": None,
                "display_order": 5,
                "is_published": True,
            },
        ]

        for data in testimonials_data:
            testimonial = Testimonial(
                quote_text=data["quote_text"],
                author_name=data["author_name"],
                author_role=data["author_role"],
                organization_name=data["organization_name"],
                photo_url=data["photo_url"],
                display_order=data["display_order"],
                is_published=data["is_published"],
                created_by=admin_user.id,
            )
            session.add(testimonial)

        await session.commit()
        print(f"✅ Created {len(testimonials_data)} testimonials")


if __name__ == "__main__":
    asyncio.run(seed_testimonials())
