from __future__ import annotations

from decimal import Decimal

from factories import PromotionFactory, TicketPackageFactory, create_factory_model
from helpers import bind_all_factories
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ticket_management import (
    CustomTicketOption,
    OptionType,
    PromoCode,
    TicketPackage,
)

PACKAGE_DEFINITIONS = (
    ("General Admission", Decimal("100.00"), 1, 100, False),
    ("VIP", Decimal("500.00"), 8, 20, False),
    ("Custom Package", Decimal("150.00"), 1, 50, False),
)


async def seed(session: AsyncSession, state: dict[str, object]) -> dict[str, int]:
    bind_all_factories(session)
    counts = {"created": 0, "unchanged": 0}
    users = state["users"]
    packages_by_event: dict[str, list[TicketPackage]] = {}

    for event_slug, event in state["events"].items():
        event_packages: list[TicketPackage] = []
        for order, (name, price, seats, quantity, sponsorship) in enumerate(
            PACKAGE_DEFINITIONS
        ):
            result = await session.execute(
                select(TicketPackage).where(
                    TicketPackage.event_id == event.id, TicketPackage.name == name
                )
            )
            package = result.scalar_one_or_none()
            if package is None:
                package = await create_factory_model(
                    session,
                    TicketPackageFactory,
                    event_id=event.id,
                    created_by=users["npo_admin"].id,
                    name=name,
                    price=price,
                    seats_per_package=seats,
                    quantity_limit=quantity,
                    display_order=order,
                    is_sponsorship=sponsorship,
                )
                counts["created"] += 1
            else:
                counts["unchanged"] += 1
            event_packages.append(package)

            if name == "Custom Package":
                for idx, (label, option_type, required) in enumerate(
                    (
                        ("meal_choice", OptionType.TEXT_INPUT, True),
                        ("plus_one", OptionType.BOOLEAN, False),
                    )
                ):
                    option_result = await session.execute(
                        select(CustomTicketOption).where(
                            CustomTicketOption.ticket_package_id == package.id,
                            CustomTicketOption.option_label == label,
                        )
                    )
                    if option_result.scalar_one_or_none() is None:
                        session.add(
                            CustomTicketOption(
                                ticket_package_id=package.id,
                                option_label=label,
                                option_type=option_type,
                                is_required=required,
                                display_order=idx,
                            )
                        )
                await session.commit()

        promo_result = await session.execute(
            select(PromoCode).where(
                PromoCode.event_id == event.id, PromoCode.code == "SEED10"
            )
        )
        if promo_result.scalar_one_or_none() is None:
            await create_factory_model(
                session,
                PromotionFactory,
                event_id=event.id,
                created_by=users["npo_admin"].id,
                code="SEED10",
                discount_value=Decimal("10.00"),
            )
            counts["created"] += 1
        else:
            counts["unchanged"] += 1
        packages_by_event[event_slug] = event_packages

    state["ticket_packages"] = packages_by_event
    return counts
