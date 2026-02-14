"""Sales tracking service for ticket management analytics."""

import csv
import io
import json
import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.logging import get_logger
from app.core.redis import get_redis
from app.models.ticket_management import (
    PromoCode,
    PromoCodeApplication,
    TicketPackage,
    TicketPurchase,
)
from app.models.user import User

logger = get_logger(__name__)


class SalesTrackingService:
    """Service for tracking and reporting ticket sales analytics."""

    # Cache TTL in seconds
    SALES_SUMMARY_CACHE_TTL = 60  # 60 seconds for sales summaries

    def __init__(self, db: AsyncSession):
        """Initialize service with database session."""
        self.db = db

    async def get_package_sales_summary(self, package_id: uuid.UUID) -> dict[str, Any]:
        """Get sales summary for a specific ticket package.

        Returns:
            dict with keys: package_id, package_name, quantity_sold, total_revenue,
            quantity_limit, available_quantity, is_sold_out
        """
        # Try to get from cache first
        cache_key = f"sales:package:{package_id}"
        try:
            redis_client = await get_redis()
            cached_data = await redis_client.get(cache_key)
            if cached_data:
                logger.debug(f"Cache hit for package sales summary: {package_id}")
                cached_dict: dict[str, Any] = json.loads(cached_data)
                return cached_dict
        except Exception as e:
            logger.warning(f"Redis cache read failed for {cache_key}: {e}")

        # Get package with sales data
        result = await self.db.execute(select(TicketPackage).where(TicketPackage.id == package_id))
        package = result.scalar_one_or_none()
        if not package:
            return {}

        # Calculate revenue from purchases
        revenue_result = await self.db.execute(
            select(func.sum(TicketPurchase.total_price))
            .where(TicketPurchase.ticket_package_id == package_id)
            .where(TicketPurchase.payment_status == "completed")
        )
        total_revenue = revenue_result.scalar_one() or Decimal("0.00")

        # Calculate availability
        available_quantity = None
        is_sold_out = False
        if package.quantity_limit is not None:
            available_quantity = max(0, package.quantity_limit - package.sold_count)
            is_sold_out = package.sold_count >= package.quantity_limit

        summary = {
            "package_id": str(package.id),
            "package_name": package.name,
            "quantity_sold": package.sold_count,
            "total_revenue": float(total_revenue),  # Convert Decimal for JSON serialization
            "quantity_limit": package.quantity_limit,
            "available_quantity": available_quantity,
            "is_sold_out": is_sold_out,
        }

        # Cache the result
        try:
            redis_client = await get_redis()
            await redis_client.setex(cache_key, self.SALES_SUMMARY_CACHE_TTL, json.dumps(summary))
            logger.debug(f"Cached package sales summary: {package_id}")
        except Exception as e:
            logger.warning(f"Redis cache write failed for {cache_key}: {e}")

        return summary

    async def get_event_revenue_summary(
        self, event_id: uuid.UUID, sponsorships_only: bool = False
    ) -> dict[str, Any]:
        """Get aggregated revenue summary for entire event.

        Args:
            event_id: The event ID
            sponsorships_only: If True, only include sponsorship packages

        Returns:
            dict with keys: event_id, total_packages_sold, total_tickets_sold,
            total_revenue, packages_sold_out_count
        """
        # Try to get from cache first (cache key includes sponsorships_only flag)
        cache_key = f"sales:event:{event_id}:sponsorships_only={sponsorships_only}"
        try:
            redis_client = await get_redis()
            cached_data = await redis_client.get(cache_key)
            if cached_data:
                logger.debug(f"Cache hit for event revenue summary: {event_id}")
                cached_dict: dict[str, Any] = json.loads(cached_data)
                return cached_dict
        except Exception as e:
            logger.warning(f"Redis cache read failed for {cache_key}: {e}")

        # Get all packages for event, optionally filtering by sponsorships
        query = select(TicketPackage).where(TicketPackage.event_id == event_id)
        if sponsorships_only:
            query = query.where(TicketPackage.is_sponsorship == True)  # noqa: E712

        packages_result = await self.db.execute(query)
        packages = packages_result.scalars().all()

        # Calculate totals
        total_packages_sold = len(packages)
        total_tickets_sold = sum(pkg.sold_count for pkg in packages)
        packages_sold_out_count = sum(
            1
            for pkg in packages
            if pkg.quantity_limit is not None and pkg.sold_count >= pkg.quantity_limit
        )

        # Calculate total revenue from completed purchases
        revenue_result = await self.db.execute(
            select(func.sum(TicketPurchase.total_price))
            .where(TicketPurchase.event_id == event_id)
            .where(TicketPurchase.payment_status == "completed")
        )
        total_revenue = revenue_result.scalar_one() or Decimal("0.00")

        summary = {
            "event_id": str(event_id),
            "total_packages_sold": total_packages_sold,
            "total_tickets_sold": total_tickets_sold,
            "total_revenue": float(total_revenue),  # Convert Decimal for JSON serialization
            "packages_sold_out_count": packages_sold_out_count,
        }

        # Cache the result
        try:
            redis_client = await get_redis()
            await redis_client.setex(cache_key, self.SALES_SUMMARY_CACHE_TTL, json.dumps(summary))
            logger.debug(f"Cached event revenue summary: {event_id}")
        except Exception as e:
            logger.warning(f"Redis cache write failed for {cache_key}: {e}")

        return summary

    async def get_purchasers_list(
        self,
        package_id: uuid.UUID,
        page: int = 1,
        per_page: int = 50,
    ) -> dict[str, Any]:
        """Get list of purchasers for a package with pagination.

        Returns:
            dict with keys: purchasers (list), total_count, page, per_page
        """
        # Calculate offset
        offset = (page - 1) * per_page

        # Get total count
        count_result = await self.db.execute(
            select(func.count(TicketPurchase.id)).where(
                TicketPurchase.ticket_package_id == package_id
            )
        )
        total_count = count_result.scalar_one()

        # Get purchases with related data
        result = await self.db.execute(
            select(TicketPurchase)
            .where(TicketPurchase.ticket_package_id == package_id)
            .options(
                joinedload(TicketPurchase.user),
                joinedload(TicketPurchase.promo_application).joinedload(
                    PromoCode  # type: ignore
                ),
                selectinload(TicketPurchase.assigned_tickets),
            )
            .order_by(TicketPurchase.purchased_at.desc())
            .limit(per_page)
            .offset(offset)
        )
        purchases = result.unique().scalars().all()

        # Format purchaser data
        purchasers = []
        for purchase in purchases:
            promo_code = None
            discount_amount = None
            if purchase.promo_application:
                promo_code = purchase.promo_application.promo_code.code
                discount_amount = purchase.promo_application.discount_amount

            purchasers.append(
                {
                    "purchase_id": str(purchase.id),
                    "purchaser_name": f"{purchase.user.first_name} {purchase.user.last_name}",
                    "purchaser_email": purchase.user.email,
                    "quantity": purchase.quantity,
                    "total_price": purchase.total_price,
                    "payment_status": purchase.payment_status.value,
                    "purchased_at": purchase.purchased_at.isoformat(),
                    "promo_code": promo_code,
                    "discount_amount": discount_amount,
                    "assigned_tickets_count": len(purchase.assigned_tickets),
                }
            )

        return {
            "purchasers": purchasers,
            "total_count": total_count,
            "page": page,
            "per_page": per_page,
        }

    async def get_event_sales_list(
        self,
        event_id: uuid.UUID,
        search: str | None = None,
        sort_by: str = "purchased_at",
        sort_dir: str = "desc",
        page: int = 1,
        per_page: int = 50,
    ) -> dict[str, Any]:
        """Get paginated list of ticket purchases for an event with search and sorting."""
        offset = (page - 1) * per_page

        purchaser_name_expr = func.coalesce(
            TicketPurchase.purchaser_name,
            func.concat(User.first_name, " ", User.last_name),
        )
        purchaser_email_expr = func.coalesce(TicketPurchase.purchaser_email, User.email)

        sort_map = {
            "purchased_at": TicketPurchase.purchased_at,
            "purchaser_name": purchaser_name_expr,
            "purchaser_email": purchaser_email_expr,
            "package_name": TicketPackage.name,
            "quantity": TicketPurchase.quantity,
            "total_price": TicketPurchase.total_price,
            "payment_status": TicketPurchase.payment_status,
            "promo_code": PromoCode.code,
            "discount_amount": PromoCodeApplication.discount_amount,
            "external_sale_id": TicketPurchase.external_sale_id,
        }

        sort_expression = sort_map.get(sort_by, TicketPurchase.purchased_at)
        sort_direction = asc if sort_dir.lower() == "asc" else desc

        base_query = (
            select(TicketPurchase)
            .join(TicketPurchase.ticket_package)
            .join(TicketPurchase.user)
            .outerjoin(TicketPurchase.promo_application)
            .outerjoin(PromoCodeApplication.promo_code)
            .where(TicketPurchase.event_id == event_id)
            .options(
                joinedload(TicketPurchase.ticket_package),
                joinedload(TicketPurchase.user),
                joinedload(TicketPurchase.promo_application).joinedload(
                    PromoCodeApplication.promo_code
                ),
            )
        )

        filters = []
        if search:
            trimmed = search.strip()
            if trimmed:
                like = f"%{trimmed}%"
                filters.append(
                    or_(
                        TicketPurchase.purchaser_name.ilike(like),
                        TicketPurchase.purchaser_email.ilike(like),
                        TicketPurchase.purchaser_phone.ilike(like),
                        TicketPurchase.external_sale_id.ilike(like),
                        TicketPurchase.notes.ilike(like),
                        TicketPackage.name.ilike(like),
                        purchaser_name_expr.ilike(like),
                        purchaser_email_expr.ilike(like),
                        PromoCode.code.ilike(like),
                    )
                )

        if filters:
            base_query = base_query.where(*filters)

        count_query = (
            select(func.count(TicketPurchase.id))
            .select_from(TicketPurchase)
            .join(TicketPurchase.ticket_package)
            .join(TicketPurchase.user)
            .outerjoin(TicketPurchase.promo_application)
            .outerjoin(PromoCodeApplication.promo_code)
            .where(TicketPurchase.event_id == event_id)
        )
        if filters:
            count_query = count_query.where(*filters)

        count_result = await self.db.execute(count_query)
        total_count = count_result.scalar_one()

        result = await self.db.execute(
            base_query.order_by(sort_direction(sort_expression)).limit(per_page).offset(offset)
        )
        purchases = result.unique().scalars().all()

        sales = []
        for purchase in purchases:
            promo_code = None
            discount_amount = None
            if purchase.promo_application and purchase.promo_application.promo_code:
                promo_code = purchase.promo_application.promo_code.code
                discount_amount = purchase.promo_application.discount_amount

            purchaser_name = purchase.purchaser_name
            purchaser_email = purchase.purchaser_email
            if not purchaser_name and purchase.user:
                purchaser_name = f"{purchase.user.first_name} {purchase.user.last_name}".strip()
            if not purchaser_email and purchase.user:
                purchaser_email = purchase.user.email

            payment_status = purchase.payment_status
            payment_status_value = (
                payment_status.value if hasattr(payment_status, "value") else str(payment_status)
            )

            sales.append(
                {
                    "purchase_id": str(purchase.id),
                    "package_name": purchase.ticket_package.name,
                    "purchaser_name": purchaser_name,
                    "purchaser_email": purchaser_email,
                    "purchaser_phone": purchase.purchaser_phone,
                    "quantity": purchase.quantity,
                    "total_price": purchase.total_price,
                    "payment_status": payment_status_value,
                    "purchased_at": purchase.purchased_at.isoformat(),
                    "promo_code": promo_code,
                    "discount_amount": discount_amount,
                    "external_sale_id": purchase.external_sale_id,
                    "notes": purchase.notes,
                }
            )

        return {
            "sales": sales,
            "total_count": total_count,
            "page": page,
            "per_page": per_page,
        }

    async def get_assigned_guests_list(
        self,
        purchase_id: uuid.UUID,
        page: int = 1,
        per_page: int = 50,
    ) -> dict[str, Any]:
        """Get list of assigned tickets for a purchase.

        Returns:
            dict with keys: assigned_tickets (list), total_count, page, per_page
        """
        # Get purchase with assigned tickets
        result = await self.db.execute(
            select(TicketPurchase)
            .where(TicketPurchase.id == purchase_id)
            .options(selectinload(TicketPurchase.assigned_tickets))
        )
        purchase = result.scalar_one_or_none()
        if not purchase:
            return {"assigned_tickets": [], "total_count": 0, "page": page, "per_page": per_page}

        # Calculate offset and slice
        offset = (page - 1) * per_page
        assigned_tickets = purchase.assigned_tickets[offset : offset + per_page]

        # Format ticket data
        tickets_data = [
            {
                "ticket_id": str(ticket.id),
                "ticket_number": ticket.ticket_number,
                "qr_code": ticket.qr_code,
                "assigned_at": ticket.assigned_at.isoformat(),
            }
            for ticket in assigned_tickets
        ]

        return {
            "assigned_tickets": tickets_data,
            "total_count": len(purchase.assigned_tickets),
            "page": page,
            "per_page": per_page,
        }

    async def generate_sales_csv_export(self, event_id: uuid.UUID) -> str:
        """Generate CSV export of all ticket sales for an event.

        Returns:
            CSV string with columns: package_name, purchaser_name, purchaser_email,
            quantity, total_price, payment_status, purchased_at, promo_code, discount_amount
        """
        # Get all purchases for event with related data
        result = await self.db.execute(
            select(TicketPurchase)
            .where(TicketPurchase.event_id == event_id)
            .options(
                joinedload(TicketPurchase.user),
                joinedload(TicketPurchase.ticket_package),
                joinedload(TicketPurchase.promo_application).joinedload(
                    PromoCode  # type: ignore
                ),
            )
            .order_by(TicketPurchase.purchased_at.desc())
        )
        purchases = result.unique().scalars().all()

        # Generate CSV
        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow(
            [
                "Package Name",
                "Purchaser Name",
                "Purchaser Email",
                "Quantity",
                "Total Price",
                "Payment Status",
                "Purchased At",
                "Promo Code",
                "Discount Amount",
            ]
        )

        # Write data rows
        for purchase in purchases:
            promo_code = ""
            discount_amount = ""
            if purchase.promo_application:
                promo_code = purchase.promo_application.promo_code.code
                discount_amount = str(purchase.promo_application.discount_amount)

            writer.writerow(
                [
                    purchase.ticket_package.name,
                    f"{purchase.user.first_name} {purchase.user.last_name}",
                    purchase.user.email,
                    purchase.quantity,
                    str(purchase.total_price),
                    purchase.payment_status.value,
                    purchase.purchased_at.isoformat(),
                    promo_code,
                    discount_amount,
                ]
            )

        return output.getvalue()

    async def invalidate_sales_cache(
        self, event_id: uuid.UUID, package_id: uuid.UUID | None = None
    ) -> None:
        """Invalidate sales cache for event and optionally specific package.

        Args:
            event_id: Event ID to invalidate cache for
            package_id: Optional package ID to invalidate specific package cache
        """
        try:
            redis_client = await get_redis()

            # Always invalidate event summary
            event_cache_key = f"sales:event:{event_id}"
            await redis_client.delete(event_cache_key)
            logger.debug(f"Invalidated event sales cache: {event_id}")

            # Invalidate specific package if provided
            if package_id:
                package_cache_key = f"sales:package:{package_id}"
                await redis_client.delete(package_cache_key)
                logger.debug(f"Invalidated package sales cache: {package_id}")

        except Exception as e:
            logger.warning(f"Failed to invalidate sales cache: {e}")


__all__ = ["SalesTrackingService"]
