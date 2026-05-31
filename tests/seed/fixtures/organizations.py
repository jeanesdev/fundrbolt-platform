from __future__ import annotations

from datetime import UTC, datetime

from factories import NPOFactory, create_factory_model
from helpers import bind_all_factories
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.npo import NPO
from app.models.npo_member import MemberRole, MemberStatus, NPOMember


async def seed(session: AsyncSession, state: dict[str, object]) -> dict[str, int]:
    bind_all_factories(session)
    counts = {"created": 0, "unchanged": 0}
    users = state["users"]
    result = await session.execute(select(NPO).where(NPO.slug == "seed-nonprofit"))
    npo = result.scalar_one_or_none()
    if npo is None:
        npo = await create_factory_model(
            session,
            NPOFactory,
            name="Seed Nonprofit Organization",
            slug="seed-nonprofit",
            email="automation+seed-nonprofit@fundrbolt.com",
            created_by_user_id=users["npo_admin"].id,
        )
        counts["created"] += 1
    else:
        counts["unchanged"] += 1

    memberships = [
        ("npo_admin", MemberRole.ADMIN),
        ("npo_staff", MemberRole.STAFF),
        ("checkin_staff", MemberRole.STAFF),
    ]
    for key, role in memberships:
        existing = await session.execute(
            select(NPOMember).where(
                NPOMember.npo_id == npo.id, NPOMember.user_id == users[key].id
            )
        )
        if existing.scalar_one_or_none() is None:
            session.add(
                NPOMember(
                    npo_id=npo.id,
                    user_id=users[key].id,
                    role=role,
                    status=MemberStatus.ACTIVE,
                    joined_at=datetime.now(UTC),
                    invited_by_user_id=users["super_admin"].id,
                )
            )
    await session.commit()
    state["npo"] = npo
    return counts
