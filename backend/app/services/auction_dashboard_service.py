"""Service layer for auction dashboard analytics (read-only)."""

from __future__ import annotations

import csv
import io
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_bid import AuctionBid
from app.models.auction_item import AuctionItem
from app.models.event import Event
from app.models.user import User
from app.schemas.auction_dashboard import (
    AuctionDashboardCharts,
    AuctionDashboardSummary,
    AuctionItemDetailResponse,
    AuctionItemFull,
    AuctionItemRow,
    AuctionItemsListResponse,
    BidHistoryEntry,
    BidTimelinePoint,
    ChartDataPoint,
)

# Bid statuses to exclude from analytics
_EXCLUDED_BID_STATUSES = ("cancelled", "withdrawn")

# Valid sort columns for the items list
_SORT_COLUMNS = {
    "title": AuctionItem.title,
    "auction_type": AuctionItem.auction_type,
    "category": AuctionItem.category,
    "current_bid_amount": AuctionItem.current_bid_amount,
    "bid_count": AuctionItem.bid_count,
    "watcher_count": AuctionItem.watcher_count,
    "status": AuctionItem.status,
}


def _decimal_to_float(val: Decimal | float | None) -> float:
    if val is None:
        return 0.0
    return float(val)


class AuctionDashboardService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # ------------------------------------------------------------------
    # Filtering helpers
    # ------------------------------------------------------------------

    def _base_item_filter(
        self,
        stmt: Any,
        npo_ids: list[UUID],
        *,
        event_id: UUID | None = None,
        auction_type: str | None = None,
        category: str | None = None,
    ) -> Any:
        """Apply common filters to an auction items query."""
        stmt = stmt.where(
            AuctionItem.event_id == Event.id,
            Event.npo_id.in_(npo_ids),
            AuctionItem.deleted_at.is_(None),
        )
        if event_id:
            stmt = stmt.where(AuctionItem.event_id == event_id)
        if auction_type:
            types = [t.strip() for t in auction_type.split(",")]
            # Handle "buy_now" as a virtual type
            if "buy_now" in types:
                remaining = [t for t in types if t != "buy_now"]
                if remaining:
                    stmt = stmt.where(
                        (AuctionItem.auction_type.in_(remaining))
                        | (AuctionItem.buy_now_enabled.is_(True))
                    )
                else:
                    stmt = stmt.where(AuctionItem.buy_now_enabled.is_(True))
            else:
                stmt = stmt.where(AuctionItem.auction_type.in_(types))
        if category:
            cats = [c.strip() for c in category.split(",")]
            stmt = stmt.where(AuctionItem.category.in_(cats))
        return stmt

    # ------------------------------------------------------------------
    # Summary stats
    # ------------------------------------------------------------------

    async def get_summary(
        self,
        npo_ids: list[UUID],
        *,
        event_id: UUID | None = None,
        auction_type: str | None = None,
        category: str | None = None,
    ) -> AuctionDashboardSummary:
        # Total items
        item_stmt = (
            select(func.count(AuctionItem.id))
            .select_from(AuctionItem)
            .join(Event, AuctionItem.event_id == Event.id)
        )
        item_stmt = self._base_item_filter(
            item_stmt, npo_ids, event_id=event_id, auction_type=auction_type, category=category
        )
        total_items = await self._db.scalar(item_stmt) or 0

        # Bid aggregation (exclude cancelled/withdrawn bids)
        bid_stmt = (
            select(
                func.count(AuctionBid.id),
                func.coalesce(func.sum(AuctionBid.bid_amount), 0),
                func.coalesce(func.avg(AuctionBid.bid_amount), 0),
            )
            .select_from(AuctionBid)
            .join(AuctionItem, AuctionBid.auction_item_id == AuctionItem.id)
            .join(Event, AuctionItem.event_id == Event.id)
            .where(
                Event.npo_id.in_(npo_ids),
                AuctionItem.deleted_at.is_(None),
                AuctionBid.bid_status.notin_(_EXCLUDED_BID_STATUSES),
            )
        )
        if event_id:
            bid_stmt = bid_stmt.where(AuctionBid.event_id == event_id)
        if auction_type:
            types = [t.strip() for t in auction_type.split(",")]
            if "buy_now" in types:
                remaining = [t for t in types if t != "buy_now"]
                if remaining:
                    bid_stmt = bid_stmt.where(
                        (AuctionItem.auction_type.in_(remaining))
                        | (AuctionItem.buy_now_enabled.is_(True))
                    )
                else:
                    bid_stmt = bid_stmt.where(AuctionItem.buy_now_enabled.is_(True))
            else:
                bid_stmt = bid_stmt.where(AuctionItem.auction_type.in_(types))
        if category:
            cats = [c.strip() for c in category.split(",")]
            bid_stmt = bid_stmt.where(AuctionItem.category.in_(cats))

        result = await self._db.execute(bid_stmt)
        row = result.one()
        total_bids, total_revenue, avg_bid = row[0], row[1], row[2]

        return AuctionDashboardSummary(
            total_items=total_items,
            total_bids=total_bids,
            total_revenue=_decimal_to_float(total_revenue),
            average_bid_amount=_decimal_to_float(avg_bid),
        )

    # ------------------------------------------------------------------
    # Items list (paginated, sortable, searchable)
    # ------------------------------------------------------------------

    async def get_items(
        self,
        npo_ids: list[UUID],
        *,
        event_id: UUID | None = None,
        auction_type: str | None = None,
        category: str | None = None,
        search: str | None = None,
        sort_by: str = "current_bid_amount",
        sort_order: str = "desc",
        page: int = 1,
        per_page: int = 25,
    ) -> AuctionItemsListResponse:
        # Base query
        base = (
            select(
                AuctionItem.id,
                AuctionItem.title,
                AuctionItem.auction_type,
                AuctionItem.buy_now_enabled,
                AuctionItem.category,
                AuctionItem.current_bid_amount,
                AuctionItem.bid_count,
                AuctionItem.watcher_count,
                AuctionItem.status,
                AuctionItem.event_id,
                Event.name.label("event_name"),
                AuctionItem.donated_by,
            )
            .select_from(AuctionItem)
            .join(Event, AuctionItem.event_id == Event.id)
        )
        base = self._base_item_filter(
            base, npo_ids, event_id=event_id, auction_type=auction_type, category=category
        )
        if search:
            pattern = f"%{search}%"
            base = base.where(
                (AuctionItem.title.ilike(pattern)) | (AuctionItem.donated_by.ilike(pattern))
            )

        # Count
        count_stmt = select(func.count()).select_from(base.subquery())
        total = await self._db.scalar(count_stmt) or 0

        # Sort
        col = _SORT_COLUMNS.get(sort_by, AuctionItem.current_bid_amount)
        order = col.desc() if sort_order == "desc" else col.asc()
        base = base.order_by(order)

        # Paginate
        offset = (page - 1) * per_page
        base = base.offset(offset).limit(per_page)

        result = await self._db.execute(base)
        rows = result.all()

        items = [
            AuctionItemRow(
                id=r.id,
                title=r.title,
                auction_type=r.auction_type,
                buy_now_enabled=r.buy_now_enabled,
                category=r.category,
                current_bid_amount=_decimal_to_float(r.current_bid_amount)
                if r.current_bid_amount
                else None,
                bid_count=r.bid_count,
                watcher_count=r.watcher_count,
                status=r.status,
                event_id=r.event_id,
                event_name=r.event_name,
                donated_by=r.donated_by,
            )
            for r in rows
        ]

        total_pages = (total + per_page - 1) // per_page if per_page > 0 else 0

        return AuctionItemsListResponse(
            items=items,
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
        )

    # ------------------------------------------------------------------
    # CSV export
    # ------------------------------------------------------------------

    async def export_items_csv(
        self,
        npo_ids: list[UUID],
        *,
        event_id: UUID | None = None,
        auction_type: str | None = None,
        category: str | None = None,
        search: str | None = None,
        sort_by: str = "current_bid_amount",
        sort_order: str = "desc",
    ) -> str:
        # Reuse get_items but without pagination
        result = await self.get_items(
            npo_ids,
            event_id=event_id,
            auction_type=auction_type,
            category=category,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order,
            page=1,
            per_page=10000,
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "Title",
                "Auction Type",
                "Buy Now",
                "Category",
                "Current Bid",
                "Bid Count",
                "Watcher Count",
                "Status",
                "Event",
                "Donated By",
            ]
        )
        for item in result.items:
            writer.writerow(
                [
                    item.title,
                    item.auction_type,
                    "Yes" if item.buy_now_enabled else "No",
                    item.category or "",
                    item.current_bid_amount if item.current_bid_amount is not None else "",
                    item.bid_count,
                    item.watcher_count,
                    item.status,
                    item.event_name,
                    item.donated_by or "",
                ]
            )
        return output.getvalue()

    # ------------------------------------------------------------------
    # Charts
    # ------------------------------------------------------------------

    async def get_charts(
        self,
        npo_ids: list[UUID],
        *,
        event_id: UUID | None = None,
        auction_type: str | None = None,
        category: str | None = None,
    ) -> AuctionDashboardCharts:
        # Revenue by type
        rev_type_stmt = (
            select(
                AuctionItem.auction_type,
                func.coalesce(func.sum(AuctionBid.bid_amount), 0).label("revenue"),
            )
            .select_from(AuctionBid)
            .join(AuctionItem, AuctionBid.auction_item_id == AuctionItem.id)
            .join(Event, AuctionItem.event_id == Event.id)
            .where(
                Event.npo_id.in_(npo_ids),
                AuctionItem.deleted_at.is_(None),
                AuctionBid.bid_status.notin_(_EXCLUDED_BID_STATUSES),
            )
            .group_by(AuctionItem.auction_type)
        )
        if event_id:
            rev_type_stmt = rev_type_stmt.where(AuctionBid.event_id == event_id)
        result = await self._db.execute(rev_type_stmt)
        revenue_by_type = [
            ChartDataPoint(label=r[0], value=_decimal_to_float(r[1])) for r in result.all()
        ]

        # Revenue by category
        rev_cat_stmt = (
            select(
                func.coalesce(AuctionItem.category, "Uncategorized").label("cat"),
                func.coalesce(func.sum(AuctionBid.bid_amount), 0).label("revenue"),
            )
            .select_from(AuctionBid)
            .join(AuctionItem, AuctionBid.auction_item_id == AuctionItem.id)
            .join(Event, AuctionItem.event_id == Event.id)
            .where(
                Event.npo_id.in_(npo_ids),
                AuctionItem.deleted_at.is_(None),
                AuctionBid.bid_status.notin_(_EXCLUDED_BID_STATUSES),
            )
            .group_by("cat")
            .order_by(func.sum(AuctionBid.bid_amount).desc())
        )
        if event_id:
            rev_cat_stmt = rev_cat_stmt.where(AuctionBid.event_id == event_id)
        result = await self._db.execute(rev_cat_stmt)
        revenue_by_category = [
            ChartDataPoint(label=r[0], value=_decimal_to_float(r[1])) for r in result.all()
        ]

        # Bid count by type
        bid_type_stmt = (
            select(
                case(
                    (AuctionBid.bid_type == "buy_now", "buy_now"),
                    else_=AuctionItem.auction_type,
                ).label("type_label"),
                func.count(AuctionBid.id).label("cnt"),
            )
            .select_from(AuctionBid)
            .join(AuctionItem, AuctionBid.auction_item_id == AuctionItem.id)
            .join(Event, AuctionItem.event_id == Event.id)
            .where(
                Event.npo_id.in_(npo_ids),
                AuctionItem.deleted_at.is_(None),
                AuctionBid.bid_status.notin_(_EXCLUDED_BID_STATUSES),
            )
            .group_by("type_label")
        )
        if event_id:
            bid_type_stmt = bid_type_stmt.where(AuctionBid.event_id == event_id)
        result = await self._db.execute(bid_type_stmt)
        bid_count_by_type = [ChartDataPoint(label=r[0], value=float(r[1])) for r in result.all()]

        # Top 10 items by revenue
        top_rev_stmt = (
            select(
                AuctionItem.title,
                func.coalesce(func.sum(AuctionBid.bid_amount), 0).label("revenue"),
            )
            .select_from(AuctionBid)
            .join(AuctionItem, AuctionBid.auction_item_id == AuctionItem.id)
            .join(Event, AuctionItem.event_id == Event.id)
            .where(
                Event.npo_id.in_(npo_ids),
                AuctionItem.deleted_at.is_(None),
                AuctionBid.bid_status.notin_(_EXCLUDED_BID_STATUSES),
            )
            .group_by(AuctionItem.id, AuctionItem.title)
            .order_by(func.sum(AuctionBid.bid_amount).desc())
            .limit(10)
        )
        if event_id:
            top_rev_stmt = top_rev_stmt.where(AuctionBid.event_id == event_id)
        result = await self._db.execute(top_rev_stmt)
        top_items_by_revenue = [
            ChartDataPoint(label=r[0], value=_decimal_to_float(r[1])) for r in result.all()
        ]

        # Top 10 items by bid count
        top_bids_stmt = (
            select(
                AuctionItem.title,
                AuctionItem.bid_count.label("cnt"),
            )
            .select_from(AuctionItem)
            .join(Event, AuctionItem.event_id == Event.id)
            .where(
                Event.npo_id.in_(npo_ids),
                AuctionItem.deleted_at.is_(None),
            )
            .order_by(AuctionItem.bid_count.desc())
            .limit(10)
        )
        if event_id:
            top_bids_stmt = top_bids_stmt.where(AuctionItem.event_id == event_id)
        result = await self._db.execute(top_bids_stmt)
        top_items_by_bid_count = [
            ChartDataPoint(label=r[0], value=float(r[1])) for r in result.all()
        ]

        # Top 10 items by watchers
        top_watch_stmt = (
            select(
                AuctionItem.title,
                AuctionItem.watcher_count.label("cnt"),
            )
            .select_from(AuctionItem)
            .join(Event, AuctionItem.event_id == Event.id)
            .where(
                Event.npo_id.in_(npo_ids),
                AuctionItem.deleted_at.is_(None),
            )
            .order_by(AuctionItem.watcher_count.desc())
            .limit(10)
        )
        if event_id:
            top_watch_stmt = top_watch_stmt.where(AuctionItem.event_id == event_id)
        result = await self._db.execute(top_watch_stmt)
        top_items_by_watchers = [
            ChartDataPoint(label=r[0], value=float(r[1])) for r in result.all()
        ]

        return AuctionDashboardCharts(
            revenue_by_type=revenue_by_type,
            revenue_by_category=revenue_by_category,
            bid_count_by_type=bid_count_by_type,
            top_items_by_revenue=top_items_by_revenue,
            top_items_by_bid_count=top_items_by_bid_count,
            top_items_by_watchers=top_items_by_watchers,
        )

    # ------------------------------------------------------------------
    # Item detail
    # ------------------------------------------------------------------

    async def get_item_detail(
        self,
        item_id: UUID,
        npo_ids: list[UUID],
    ) -> AuctionItemDetailResponse | None:
        # Fetch item with event
        item_stmt = (
            select(AuctionItem, Event.name.label("event_name"))
            .join(Event, AuctionItem.event_id == Event.id)
            .where(
                AuctionItem.id == item_id,
                AuctionItem.deleted_at.is_(None),
                Event.npo_id.in_(npo_ids),
            )
        )
        result = await self._db.execute(item_stmt)
        row = result.first()
        if row is None:
            return None

        ai: AuctionItem = row[0]
        event_name: str = row[1]

        item = AuctionItemFull(
            id=ai.id,
            title=ai.title,
            description=ai.description,
            auction_type=ai.auction_type,
            category=ai.category,
            status=ai.status,
            starting_bid=_decimal_to_float(ai.starting_bid),
            current_bid_amount=_decimal_to_float(ai.current_bid_amount)
            if ai.current_bid_amount
            else None,
            bid_count=ai.bid_count,
            watcher_count=ai.watcher_count,
            buy_now_enabled=ai.buy_now_enabled,
            buy_now_price=_decimal_to_float(ai.buy_now_price) if ai.buy_now_price else None,
            bid_increment=_decimal_to_float(ai.bid_increment),
            donated_by=ai.donated_by,
            donor_value=_decimal_to_float(ai.donor_value) if ai.donor_value else None,
            bidding_open=ai.bidding_open,
            event_id=ai.event_id,
            event_name=event_name,
        )

        # Bid history (exclude cancelled/withdrawn)
        bid_stmt = (
            select(
                AuctionBid.id,
                AuctionBid.bidder_number,
                User.first_name,
                User.last_name,
                AuctionBid.bid_amount,
                AuctionBid.bid_type,
                AuctionBid.bid_status,
                AuctionBid.placed_at,
            )
            .join(User, AuctionBid.user_id == User.id)
            .where(
                AuctionBid.auction_item_id == item_id,
                AuctionBid.bid_status.notin_(_EXCLUDED_BID_STATUSES),
            )
            .order_by(AuctionBid.placed_at.desc())
        )
        result = await self._db.execute(bid_stmt)
        bids = result.all()

        bid_history = [
            BidHistoryEntry(
                id=b[0],
                bidder_number=b[1],
                bidder_name=f"#{b[1]} — {b[2]} {b[3]}",
                bid_amount=_decimal_to_float(b[4]),
                bid_type=b[5],
                bid_status=b[6],
                placed_at=b[7],
            )
            for b in bids
        ]

        # Bid timeline (ascending for chart)
        bid_timeline = [
            BidTimelinePoint(
                timestamp=b[7],
                bid_amount=_decimal_to_float(b[4]),
            )
            for b in reversed(bids)
        ]

        return AuctionItemDetailResponse(
            item=item,
            bid_history=bid_history,
            bid_timeline=bid_timeline,
        )
