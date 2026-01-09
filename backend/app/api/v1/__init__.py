"""API v1 routes package."""

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    admin_seating,
    admin_testimonials,
    auction_item_media,
    auction_items,
    auth,
    branding,
    checkin,
    consent,
    cookies,
    donor_seating,
    events,
    events_food_options,
    events_links,
    events_media,
    invitations,
    legal_documents,
    members,
    npos,
    promo_codes,
    public_testimonials,
    registrations,
    sales_tracking,
    search,
    sponsors,
    ticket_options,
    ticket_packages,
    users,
)
from app.api.v1.public import contact as public_contact
from app.api.v1.public import events as public_events

# Create v1 API router
api_router = APIRouter()

# Include sub-routers
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(npos.router, tags=["npos"])
api_router.include_router(members.router, tags=["members"])
api_router.include_router(invitations.router, tags=["invitations"])
api_router.include_router(branding.router, tags=["branding"])
api_router.include_router(events.router, tags=["events"])
api_router.include_router(events_links.router, tags=["events", "links"])
api_router.include_router(events_media.router, tags=["events", "media"])
api_router.include_router(events_food_options.router, tags=["events", "food-options"])
api_router.include_router(sponsors.router, tags=["events", "sponsors"])
api_router.include_router(registrations.router, tags=["registrations"])
api_router.include_router(checkin.router, tags=["checkin"])
api_router.include_router(auction_items.router, tags=["auction-items"])
api_router.include_router(auction_item_media.router, tags=["auction-items", "media"])
api_router.include_router(legal_documents.router, prefix="/legal", tags=["legal"])
api_router.include_router(consent.router, prefix="/consent", tags=["consent"])
api_router.include_router(cookies.router, prefix="/cookies", tags=["cookies"])
api_router.include_router(search.router, tags=["search"])
api_router.include_router(public_contact.router, prefix="/public", tags=["public-contact"])
api_router.include_router(public_events.router, prefix="/public", tags=["public-events"])
api_router.include_router(public_testimonials.router, tags=["public-testimonials"])
api_router.include_router(admin_testimonials.router, tags=["admin-testimonials"])
api_router.include_router(admin_seating.router, tags=["admin-seating"])
api_router.include_router(donor_seating.router, tags=["donor-seating"])
api_router.include_router(ticket_packages.router, prefix="/admin", tags=["admin-tickets"])
api_router.include_router(ticket_options.router, tags=["admin-tickets"])
api_router.include_router(promo_codes.router, tags=["admin-tickets"])
api_router.include_router(sales_tracking.router, prefix="/admin", tags=["admin-tickets"])
api_router.include_router(admin.router, tags=["admin"])

__all__ = ["api_router"]
