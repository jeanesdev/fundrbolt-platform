"""Database models package."""

from app.models.auction_bid import AuctionBid, BidActionAudit, PaddleRaiseContribution
from app.models.auction_bid_import import (
    AuctionBidImportBatch,
    AuctionBidImportFormat,
    AuctionBidImportIssue,
    AuctionBidImportIssueSeverity,
    AuctionBidImportStatus,
)
from app.models.auction_item import AuctionItem
from app.models.audit_log import AuditLog
from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.buy_now_availability import BuyNowAvailability
from app.models.consent import ConsentAuditLog, CookieConsent, UserConsent
from app.models.event import Event, EventLink, EventMedia, FoodOption
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.event_table import EventTable
from app.models.invitation import Invitation
from app.models.item_promotion import ItemPromotion
from app.models.item_view import ItemView
from app.models.legal_document import LegalDocument
from app.models.meal_selection import MealSelection
from app.models.npo import NPO
from app.models.npo_application import NPOApplication
from app.models.npo_branding import NPOBranding
from app.models.npo_member import NPOMember
from app.models.registration_guest import RegistrationGuest
from app.models.registration_import import (
    ImportBatchStatus,
    RegistrationImportBatch,
    RegistrationValidationIssue,
    ValidationSeverity,
)
from app.models.role import Role
from app.models.session import Session
from app.models.sponsor import Sponsor
from app.models.ticket_management import (
    AssignedTicket,
    CustomTicketOption,
    DiscountType,
    OptionResponse,
    OptionType,
    PaymentStatus,
    PromoCode,
    PromoCodeApplication,
    TicketAuditLog,
    TicketPackage,
    TicketPurchase,
)
from app.models.ticket_sales_import import (
    ImportFormat,
    ImportStatus,
    IssueSeverity,
    TicketSalesImportBatch,
    TicketSalesImportIssue,
)
from app.models.user import User
from app.models.user_import import (
    UserImportBatch,
    UserImportIssue,
    UserImportIssueSeverity,
    UserImportStatus,
)
from app.models.watch_list_entry import WatchListEntry

__all__ = [
    "AssignedTicket",
    "AuctionBid",
    "AuctionItem",
    "AuditLog",
    "Base",
    "BidActionAudit",
    "BuyNowAvailability",
    "ConsentAuditLog",
    "CookieConsent",
    "CustomTicketOption",
    "DiscountType",
    "Event",
    "EventLink",
    "EventMedia",
    "EventRegistration",
    "EventTable",
    "FoodOption",
    "ImportFormat",
    "ImportStatus",
    "Invitation",
    "ItemPromotion",
    "ItemView",
    "IssueSeverity",
    "LegalDocument",
    "MealSelection",
    "NPO",
    "NPOApplication",
    "NPOBranding",
    "NPOMember",
    "OptionResponse",
    "OptionType",
    "PaddleRaiseContribution",
    "PaymentStatus",
    "PromoCode",
    "PromoCodeApplication",
    "RegistrationGuest",
    "AuctionBidImportBatch",
    "AuctionBidImportFormat",
    "AuctionBidImportIssue",
    "AuctionBidImportIssueSeverity",
    "AuctionBidImportStatus",
    "RegistrationImportBatch",
    "RegistrationStatus",
    "RegistrationValidationIssue",
    "ImportBatchStatus",
    "ValidationSeverity",
    "Role",
    "Session",
    "Sponsor",
    "TicketAuditLog",
    "TicketPackage",
    "TicketPurchase",
    "TimestampMixin",
    "TicketSalesImportBatch",
    "TicketSalesImportIssue",
    "UserImportBatch",
    "UserImportIssue",
    "UserImportIssueSeverity",
    "UserImportStatus",
    "User",
    "UserConsent",
    "UUIDMixin",
    "WatchListEntry",
]
