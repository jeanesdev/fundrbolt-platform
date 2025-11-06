# type: ignore
"""
Seed demo NPO data for testing and development.

This script creates:
- 5 NPO organizations with various statuses
- Multiple team members per NPO
- Branding configurations
- Sample applications

Usage:
    poetry run python seed_npo_demo_data.py
"""

import asyncio
import random
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.npo import NPO, NPOStatus
from app.models.npo_application import ApplicationStatus, NPOApplication
from app.models.npo_branding import NPOBranding
from app.models.npo_member import MemberRole, MemberStatus, NPOMember
from app.models.role import Role
from app.models.user import User

# Demo NPO data
DEMO_NPOS = [
    {
        "name": "Hope Foundation",
        "description": "Supporting education in underserved communities worldwide. We provide scholarships, school supplies, and mentorship programs to help children reach their full potential.",
        "email": "contact@hopefoundation.org",
        "phone": "+1 (555) 123-4567",
        "address": {
            "street": "123 Education Lane",
            "city": "Learning City",
            "state": "CA",
            "postal_code": "90210",
            "country": "USA",
        },
        "tax_id": "12-3456789",
        "registration_number": "NPO-2024-001",
        "website_url": "https://hopefoundation.org",
        "status": NPOStatus.APPROVED,
        "branding": {
            "primary_color": "#1E40AF",
            "secondary_color": "#3B82F6",
            "accent_color": "#60A5FA",
            "background_color": "#FFFFFF",
            "social_media_links": {
                "facebook": "https://facebook.com/hopefoundation",
                "twitter": "https://twitter.com/hopefound",
                "instagram": "https://instagram.com/hopefoundation",
            },
        },
        "members": [
            {
                "email": "sarah.admin@hopefoundation.org",
                "role": MemberRole.ADMIN,
                "first_name": "Sarah",
                "last_name": "Johnson",
            },
            {
                "email": "mike.coadmin@hopefoundation.org",
                "role": MemberRole.CO_ADMIN,
                "first_name": "Mike",
                "last_name": "Chen",
            },
            {
                "email": "lisa.staff@hopefoundation.org",
                "role": MemberRole.STAFF,
                "first_name": "Lisa",
                "last_name": "Rodriguez",
            },
        ],
    },
    {
        "name": "Green Earth Initiative",
        "description": "Environmental conservation and sustainability programs. We focus on reforestation, ocean cleanup, and renewable energy education.",
        "email": "info@greenearthinitiative.org",
        "phone": "+1 (555) 234-5678",
        "address": {
            "street": "456 Forest Drive",
            "city": "Eco City",
            "state": "OR",
            "postal_code": "97201",
            "country": "USA",
        },
        "tax_id": "23-4567890",
        "registration_number": "NPO-2024-002",
        "website_url": "https://greenearthinitiative.org",
        "status": NPOStatus.PENDING_APPROVAL,
        "branding": {
            "primary_color": "#10B981",
            "secondary_color": "#34D399",
            "accent_color": "#6EE7B7",
            "background_color": "#FFFFFF",
            "social_media_links": {
                "facebook": "https://facebook.com/greenearth",
                "twitter": "https://twitter.com/greenearthinit",
                "instagram": "https://instagram.com/greenearth",
                "linkedin": "https://linkedin.com/company/green-earth-initiative",
            },
        },
        "members": [
            {
                "email": "james.admin@greenearthinitiative.org",
                "role": MemberRole.ADMIN,
                "first_name": "James",
                "last_name": "Green",
            },
            {
                "email": "emma.coadmin@greenearthinitiative.org",
                "role": MemberRole.CO_ADMIN,
                "first_name": "Emma",
                "last_name": "Woods",
            },
        ],
    },
    {
        "name": "Community Health Network",
        "description": "Providing free healthcare services to underserved populations. Mobile clinics, health education, and preventive care programs.",
        "email": "contact@communityhealthnetwork.org",
        "phone": "+1 (555) 345-6789",
        "address": {
            "street": "789 Medical Plaza",
            "city": "Healthcare City",
            "state": "NY",
            "postal_code": "10001",
            "country": "USA",
        },
        "tax_id": "34-5678901",
        "registration_number": "NPO-2024-003",
        "website_url": "https://communityhealthnetwork.org",
        "status": NPOStatus.APPROVED,
        "branding": {
            "primary_color": "#DC2626",
            "secondary_color": "#EF4444",
            "accent_color": "#F87171",
            "background_color": "#FFFFFF",
            "social_media_links": {
                "facebook": "https://facebook.com/communityhealthnetwork",
                "twitter": "https://twitter.com/communityhealth",
                "linkedin": "https://linkedin.com/company/community-health-network",
                "youtube": "https://youtube.com/@communityhealthnetwork",
            },
        },
        "members": [
            {
                "email": "dr.maria@communityhealthnetwork.org",
                "role": MemberRole.ADMIN,
                "first_name": "Maria",
                "last_name": "Garcia",
            },
            {
                "email": "john.coadmin@communityhealthnetwork.org",
                "role": MemberRole.CO_ADMIN,
                "first_name": "John",
                "last_name": "Smith",
            },
            {
                "email": "susan.staff@communityhealthnetwork.org",
                "role": MemberRole.STAFF,
                "first_name": "Susan",
                "last_name": "Lee",
            },
            {
                "email": "robert.staff@communityhealthnetwork.org",
                "role": MemberRole.STAFF,
                "first_name": "Robert",
                "last_name": "Brown",
            },
        ],
    },
    {
        "name": "Youth Arts Academy",
        "description": "Empowering youth through creative arts programs. Music, dance, theater, and visual arts education for children and teens.",
        "email": "hello@youthartsacademy.org",
        "phone": "+1 (555) 456-7890",
        "address": {
            "street": "321 Creative Way",
            "city": "Arts District",
            "state": "TX",
            "postal_code": "75001",
            "country": "USA",
        },
        "tax_id": "45-6789012",
        "website_url": "https://youthartsacademy.org",
        "status": NPOStatus.DRAFT,
        "branding": {
            "primary_color": "#7C3AED",
            "secondary_color": "#8B5CF6",
            "accent_color": "#A78BFA",
            "background_color": "#FFFFFF",
            "social_media_links": {
                "instagram": "https://instagram.com/youthartsacademy",
                "facebook": "https://facebook.com/youthartsacademy",
            },
        },
        "members": [
            {
                "email": "alex.admin@youthartsacademy.org",
                "role": MemberRole.ADMIN,
                "first_name": "Alex",
                "last_name": "Taylor",
            },
        ],
    },
    {
        "name": "Animal Rescue Alliance",
        "description": "Rescuing and rehoming abandoned animals. We provide veterinary care, foster programs, and adoption services.",
        "email": "info@animalrescuealliance.org",
        "phone": "+1 (555) 567-8901",
        "address": {
            "street": "654 Rescue Road",
            "city": "Pet City",
            "state": "FL",
            "postal_code": "33101",
            "country": "USA",
        },
        "tax_id": "56-7890123",
        "registration_number": "NPO-2024-005",
        "website_url": "https://animalrescuealliance.org",
        "status": NPOStatus.REJECTED,
        "branding": {
            "primary_color": "#EA580C",
            "secondary_color": "#F97316",
            "accent_color": "#FB923C",
            "background_color": "#FFFFFF",
            "social_media_links": {
                "facebook": "https://facebook.com/animalrescuealliance",
                "instagram": "https://instagram.com/animalrescuealliance",
                "twitter": "https://twitter.com/animalrescue",
            },
        },
        "members": [
            {
                "email": "jennifer.admin@animalrescuealliance.org",
                "role": MemberRole.ADMIN,
                "first_name": "Jennifer",
                "last_name": "Martinez",
            },
            {
                "email": "david.staff@animalrescuealliance.org",
                "role": MemberRole.STAFF,
                "first_name": "David",
                "last_name": "Wilson",
            },
        ],
    },
]


async def get_or_create_user(
    db: AsyncSession, email: str, first_name: str, last_name: str, role_name: str = "npo_admin"
) -> User:
    """Get existing user or create new one."""
    # Check if user exists
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        return user

    # Get role
    result = await db.execute(select(Role).where(Role.name == role_name))
    role = result.scalar_one_or_none()

    if not role:
        # Create role if it doesn't exist (shouldn't happen in production)
        scope_map = {
            "super_admin": "platform",
            "npo_admin": "npo",
            "event_coordinator": "npo",
            "staff": "event",
            "donor": "own",
        }
        scope = scope_map.get(role_name, "npo")

        role = Role(
            id=uuid4(),
            name=role_name,
            description=f"{role_name.replace('_', ' ').title()} role",
            scope=scope,
        )
        db.add(role)
        await db.flush()

    # Create user
    user = User(
        id=uuid4(),
        email=email,
        first_name=first_name,
        last_name=last_name,
        password_hash=hash_password("demo123"),  # Demo password
        role_id=role.id,
        is_active=True,
        email_verified=True,
    )
    db.add(user)
    await db.flush()

    return user


async def seed_npo_data() -> None:
    """Seed NPO demo data."""
    print("🌱 Seeding NPO demo data...\n")

    async with AsyncSessionLocal() as db:
        # Check if demo data already exists
        result = await db.execute(select(NPO).where(NPO.name == "Hope Foundation"))
        if result.scalar_one_or_none():
            print("⚠️  Demo NPO data already exists. Skipping seed.\n")
            return

        # Create NPOs
        for npo_data in DEMO_NPOS:
            print(f"Creating NPO: {npo_data['name']} ({npo_data['status'].value})")

            # Get or create creator (first member as admin)
            admin_member = npo_data["members"][0]
            creator = await get_or_create_user(
                db,
                admin_member["email"],
                admin_member["first_name"],
                admin_member["last_name"],
            )

            # Create NPO
            npo = NPO(
                id=uuid4(),
                name=npo_data["name"],
                description=npo_data["description"],
                email=npo_data["email"],
                phone=npo_data["phone"],
                address=npo_data["address"],
                tax_id=npo_data.get("tax_id"),
                registration_number=npo_data.get("registration_number"),
                website_url=npo_data.get("website_url"),
                status=npo_data["status"],
                created_by_user_id=creator.id,
            )
            db.add(npo)
            await db.flush()

            # Create branding if provided
            if "branding" in npo_data:
                branding = NPOBranding(
                    id=uuid4(),
                    npo_id=npo.id,
                    **npo_data["branding"],
                )
                db.add(branding)

            # Create members
            for member_data in npo_data["members"]:
                user = await get_or_create_user(
                    db,
                    member_data["email"],
                    member_data["first_name"],
                    member_data["last_name"],
                )

                member = NPOMember(
                    id=uuid4(),
                    npo_id=npo.id,
                    user_id=user.id,
                    role=member_data["role"],
                    status=MemberStatus.ACTIVE,
                    joined_at=datetime.utcnow() - timedelta(days=random.randint(1, 90)),
                )
                db.add(member)

            # Create application if not draft
            if npo_data["status"] != NPOStatus.DRAFT:
                app_status = ApplicationStatus.SUBMITTED
                if npo_data["status"] == NPOStatus.APPROVED:
                    app_status = ApplicationStatus.APPROVED
                elif npo_data["status"] == NPOStatus.REJECTED:
                    app_status = ApplicationStatus.REJECTED

                application = NPOApplication(
                    id=uuid4(),
                    npo_id=npo.id,
                    status=app_status,  # Pass enum directly, model handles conversion
                    submitted_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
                )

                # Add review details if approved or rejected
                if app_status in (ApplicationStatus.APPROVED, ApplicationStatus.REJECTED):
                    # Get or create SuperAdmin for reviewer
                    superadmin = await get_or_create_user(
                        db,
                        "superadmin@augeo.app",
                        "Super",
                        "Admin",
                        "super_admin",
                    )

                    application.reviewed_at = datetime.utcnow() - timedelta(
                        days=random.randint(1, 15)
                    )
                    application.reviewed_by_user_id = superadmin.id

                    if app_status == ApplicationStatus.APPROVED:
                        application.review_notes = {
                            "notes": "All information verified and complete. Organization meets all requirements."
                        }
                    else:
                        application.review_notes = {
                            "notes": "Tax ID verification failed. Please provide valid EIN documentation and resubmit."
                        }

                db.add(application)

            await db.flush()

        await db.commit()

        print("\n✅ Demo NPO data seeded successfully!\n")
        print("Demo NPOs created:")
        for npo_data in DEMO_NPOS:
            print(f"  - {npo_data['name']} ({npo_data['status'].value})")

        print("\nDemo credentials (password: demo123):")
        for npo_data in DEMO_NPOS:
            for member in npo_data["members"]:
                print(f"  - {member['email']} ({member['role'].value})")

        print("\n  - superadmin@augeo.app (super_admin)")


async def main() -> None:
    """Run seeding script."""
    try:
        await seed_npo_data()
    except Exception as e:
        print(f"\n❌ Error seeding data: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
