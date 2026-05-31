from __future__ import annotations

import uuid
from typing import Any

from factories import (
    AuctionItemFactory,
    EventFactory,
    EventTableFactory,
    LegalDocumentFactory,
    NPOFactory,
    PromotionFactory,
    RegistrationFactory,
    RegistrationGuestFactory,
    SponsorFactory,
    TicketPackageFactory,
    UserFactory,
    bind_factory_session,
    create_factory_model,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem
from app.models.event import Event
from app.models.event_registration import EventRegistration
from app.models.role import Role
from app.models.ticket_management import TicketPackage
from app.models.user import User

DEFAULT_BLOB_BASE_URL = "http://127.0.0.1:10000/devstoreaccount1/fundrbolt-test-assets"


def make_blob_url(*parts: str) -> str:
    return "/".join([DEFAULT_BLOB_BASE_URL, *parts])


async def get_role_map(session: AsyncSession) -> dict[str, uuid.UUID]:
    result = await session.execute(select(Role.name, Role.id))
    return dict(result.all())


def bind_all_factories(session: AsyncSession) -> None:
    bind_factory_session(
        session,
        AuctionItemFactory,
        EventFactory,
        EventTableFactory,
        LegalDocumentFactory,
        NPOFactory,
        PromotionFactory,
        RegistrationFactory,
        RegistrationGuestFactory,
        SponsorFactory,
        TicketPackageFactory,
        UserFactory,
    )


async def provision_event(
    session: AsyncSession, npo_id: uuid.UUID, **kwargs: Any
) -> Event:
    bind_all_factories(session)
    unique = uuid.uuid4().hex[:8]
    return await create_factory_model(
        session,
        EventFactory,
        npo_id=npo_id,
        name=kwargs.pop("name", f"Provisioned Event {unique}"),
        slug=kwargs.pop("slug", f"provisioned-event-{unique}"),
        **kwargs,
    )


async def provision_user(session: AsyncSession, role: str, **kwargs: Any) -> User:
    bind_all_factories(session)
    role_map = await get_role_map(session)
    unique = uuid.uuid4().hex[:8]
    return await create_factory_model(
        session,
        UserFactory,
        role_id=role_map[role],
        email=kwargs.pop("email", f"automation+{role}-{unique}@fundrbolt.com"),
        **kwargs,
    )


async def provision_ticket_package(
    session: AsyncSession, event_id: uuid.UUID, **kwargs: Any
) -> TicketPackage:
    bind_all_factories(session)
    unique = uuid.uuid4().hex[:8]
    return await create_factory_model(
        session,
        TicketPackageFactory,
        event_id=event_id,
        created_by=kwargs.pop("created_by"),
        name=kwargs.pop("name", f"Provisioned Package {unique}"),
        **kwargs,
    )


async def provision_auction_item(
    session: AsyncSession, event_id: uuid.UUID, **kwargs: Any
) -> AuctionItem:
    bind_all_factories(session)
    unique = uuid.uuid4().hex[:8]
    return await create_factory_model(
        session,
        AuctionItemFactory,
        event_id=event_id,
        created_by=kwargs.pop("created_by"),
        title=kwargs.pop("title", f"Provisioned Auction Item {unique}"),
        **kwargs,
    )


async def provision_registration(
    session: AsyncSession,
    event_id: uuid.UUID,
    user_id: uuid.UUID,
    **kwargs: Any,
) -> EventRegistration:
    bind_all_factories(session)
    return await create_factory_model(
        session,
        RegistrationFactory,
        event_id=event_id,
        user_id=user_id,
        **kwargs,
    )
