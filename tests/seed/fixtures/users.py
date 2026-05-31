from __future__ import annotations

from datetime import UTC, datetime

from factories import UserFactory, create_factory_model
from helpers import bind_all_factories, get_role_map
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.consent import (
    ConsentAction,
    ConsentAuditLog,
    ConsentStatus,
    UserConsent,
)
from app.models.user import User

ROLE_MAP = {
    "super_admin": "super_admin",
    "npo_admin": "npo_admin",
    "npo_staff": "staff",
    "checkin_staff": "staff",
    "donor": "donor",
}


async def seed(session: AsyncSession, state: dict[str, object]) -> dict[str, int]:
    bind_all_factories(session)
    counts = {"created": 0, "unchanged": 0}
    role_ids = await get_role_map(session)
    legal_refs = state["legal_documents"]
    users: dict[str, User] = {}

    for seed_role, app_role in ROLE_MAP.items():
        email = f"automation+{seed_role}@fundrbolt.com"
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None:
            user = await create_factory_model(
                session,
                UserFactory,
                email=email,
                first_name=seed_role.replace("_", " ").title().split()[0],
                last_name="Automation",
                role_id=role_ids[app_role],
            )
            counts["created"] += 1
        else:
            user.is_active = True
            user.email_verified = True
            await session.commit()
            counts["unchanged"] += 1
        users[seed_role] = user

        consent_result = await session.execute(
            select(UserConsent).where(
                UserConsent.user_id == user.id,
                UserConsent.status == ConsentStatus.ACTIVE,
            )
        )
        if consent_result.scalar_one_or_none() is None:
            consent = UserConsent(
                user_id=user.id,
                tos_document_id=legal_refs["terms_of_service"],
                privacy_document_id=legal_refs["privacy_policy"],
                ip_address="127.0.0.1",
                user_agent="seed-script",
                status=ConsentStatus.ACTIVE,
            )
            session.add(consent)
            session.add(
                ConsentAuditLog(
                    user_id=user.id,
                    action=ConsentAction.CONSENT_GIVEN,
                    details={"seeded": True},
                    ip_address="127.0.0.1",
                    user_agent="seed-script",
                    created_at=datetime.now(UTC),
                )
            )
            await session.commit()

    state["users"] = users
    return counts
