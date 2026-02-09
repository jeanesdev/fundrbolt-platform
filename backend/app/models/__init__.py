"""Database models package."""

from app.models.auction_bid import AuctionBid, BidActionAudit, PaddleRaiseContribution
from app.models.auction_item import AuctionItem
from app.models.audit_log import AuditLog
from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.consent import ConsentAuditLog, CookieConsent, UserConsent
from app.models.event import Event, EventLink, EventMedia, FoodOption
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.event_table import EventTable
from app.models.invitation import Invitation
from app.models.legal_document import LegalDocument
from app.models.meal_selection import MealSelection
from app.models.npo import NPO
from app.models.npo_application import NPOApplication
from app.models.npo_branding import NPOBranding
from app.models.npo_member import NPOMember
from app.models.registration_guest import RegistrationGuest
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

__all__ = [
    "AssignedTicket",
    "AuctionBid",
    "AuctionItem",
    "AuditLog",
    "BidActionAudit",
    "Base",
    "TimestampMixin",
    "UUIDMixin",
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
    "IssueSeverity",
    "LegalDocument",
    "MealSelection",
    "NPO",
    "NPOApplication",
    "NPOBranding",
    "NPOMember",
    "OptionResponse",
    "OptionType",
    "PaymentStatus",
    "PromoCode",
    "PromoCodeApplication",
    "PaddleRaiseContribution",
    "RegistrationGuest",
    "RegistrationStatus",
    "Role",
    "Session",
    "Sponsor",
    "TicketAuditLog",
    "TicketPackage",
    "TicketPurchase",
    "TicketSalesImportBatch",
    "TicketSalesImportIssue",
    "User",
    "UserConsent",
]
