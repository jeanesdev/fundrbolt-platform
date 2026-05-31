from __future__ import annotations

from decimal import Decimal

import factory

from app.models.auction_item import AuctionItem, ItemStatus

from .base import BaseFactory


class AuctionItemFactory(BaseFactory):
    class Meta:
        model = AuctionItem

    external_id = factory.Sequence(lambda n: f"SEED-AUCTION-{n}")
    bid_number = factory.Sequence(lambda n: 100 + n)
    title = factory.Sequence(lambda n: f"Seed Auction Item {n}")
    description = "Automation auction item"
    auction_type = "silent"
    starting_bid = Decimal("100.00")
    bid_increment = Decimal("10.00")
    donor_value = Decimal("250.00")
    quantity_available = 1
    donated_by = "Seed Donor"
    status = ItemStatus.PUBLISHED.value
    bidding_open = True
    slide_presentation_layout = "below_image"
