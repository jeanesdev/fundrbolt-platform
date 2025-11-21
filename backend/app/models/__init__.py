"""Database models package."""

from app.models.auction_item import AuctionItem
from app.models.audit_log import AuditLog
from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.consent import ConsentAuditLog, CookieConsent, UserConsent
from app.models.event import Event, EventLink, EventMedia, FoodOption
from app.models.event_registration import EventRegistration, RegistrationStatus
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
from app.models.user import User

__all__ = [
    "AuctionItem",
    "AuditLog",
    "Base",
    "TimestampMixin",
    "UUIDMixin",
    "ConsentAuditLog",
    "CookieConsent",
    "Event",
    "EventLink",
    "EventMedia",
    "FoodOption",
    "Invitation",
    "LegalDocument",
    "NPO",
    "NPOApplication",
    "NPOBranding",
    "NPOMember",
    "Role",
    "Session",
    "Sponsor",
    "User",
    "UserConsent",
]
