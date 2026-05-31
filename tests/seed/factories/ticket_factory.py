from __future__ import annotations

from decimal import Decimal

import factory

from app.models.ticket_management import DiscountType, PromoCode, TicketPackage

from .base import BaseFactory


class TicketPackageFactory(BaseFactory):
    class Meta:
        model = TicketPackage

    name = factory.Sequence(lambda n: f"Seed Ticket Package {n}")
    description = "Automation ticket package"
    price = Decimal("100.00")
    seats_per_package = 1
    quantity_limit = 100
    sold_count = 0
    display_order = factory.Sequence(lambda n: n)
    is_enabled = True
    is_sponsorship = False


class PromotionFactory(BaseFactory):
    class Meta:
        model = PromoCode

    code = factory.Sequence(lambda n: f"SEED{n}")
    discount_type = DiscountType.PERCENTAGE
    discount_value = Decimal("10.00")
    max_uses = None
    used_count = 0
    is_active = True
    version = 1
