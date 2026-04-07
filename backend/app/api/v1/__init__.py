"""API v1 routes package."""

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    admin_auction_bid_import,
    admin_auction_engagement,
    admin_auction_item_import,
    admin_auctioneer,
    admin_checklist,
    admin_donations,
    admin_donor_dashboard,
    admin_donor_labels,
    admin_event_dashboard,
    admin_notifications,
    admin_npo_credentials,
    admin_payments,
    admin_quick_entry,
    admin_registration_import,
    admin_seating,
    admin_testimonials,
    admin_ticket_sales_import,
    admin_user_import,
    auction_bids,
    auction_item_media,
    auction_items,
    auth,
    branding,
    checkin,
    consent,
    cookies,
    donor_seating,
    event_custom_options,
    event_preview,
    events,
    events_food_options,
    events_links,
    events_media,
    invitations,
    legal_documents,
    members,
    notification_preferences,
    notifications,
    npos,
    payments,
    promo_codes,
    public_testimonials,
    public_tickets,
    push_subscriptions,
    registrations,
    sales_tracking,
    search,
    sponsors,
    ticket_assignments,
    ticket_invitations,
    ticket_options,
    ticket_packages,
    users,
    watchlist,
)
from app.api.v1.public import contact as public_contact
from app.api.v1.public import events as public_events
from app.api.v1.public import onboarding as public_onboarding

# Create v1 API router
api_router = APIRouter()

# Include sub-routers
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(npos.router, tags=["npos"])
api_router.include_router(members.router, tags=["members"])
api_router.include_router(invitations.router, tags=["invitations"])
api_router.include_router(branding.router, tags=["branding"])
api_router.include_router(public_events.router, tags=["public-events"])
api_router.include_router(events.router, tags=["events"])
api_router.include_router(events_links.router, tags=["events", "links"])
api_router.include_router(events_media.router, tags=["events", "media"])
api_router.include_router(events_food_options.router, tags=["events", "food-options"])
api_router.include_router(sponsors.router, tags=["events", "sponsors"])
api_router.include_router(admin_donations.router, tags=["donations"])
api_router.include_router(admin_donor_labels.router, tags=["admin-donor-labels"])
api_router.include_router(registrations.router, tags=["registrations"])
api_router.include_router(checkin.router, tags=["checkin"])
api_router.include_router(auction_items.router, tags=["auction-items"])
api_router.include_router(auction_items.donor_router, tags=["auction-items"])
api_router.include_router(auction_item_media.router, tags=["auction-items", "media"])
api_router.include_router(auction_bids.router, tags=["auction-bids"])
api_router.include_router(watchlist.router, tags=["watchlist"])
api_router.include_router(admin_auction_engagement.router, tags=["admin-auction-engagement"])
api_router.include_router(legal_documents.router, prefix="/legal", tags=["legal"])
api_router.include_router(consent.router, prefix="/consent", tags=["consent"])
api_router.include_router(cookies.router, prefix="/cookies", tags=["cookies"])
api_router.include_router(search.router, tags=["search"])
api_router.include_router(public_contact.router, prefix="/public", tags=["public-contact"])
api_router.include_router(public_onboarding.router, prefix="/public", tags=["public-onboarding"])
api_router.include_router(public_testimonials.router, tags=["public-testimonials"])
api_router.include_router(admin_testimonials.router, tags=["admin-testimonials"])
api_router.include_router(admin_seating.router, tags=["admin-seating"])
api_router.include_router(admin_checklist.router, tags=["admin-checklist"])
api_router.include_router(admin_auction_bid_import.router)
api_router.include_router(admin_auction_item_import.router)
api_router.include_router(admin_registration_import.router)
api_router.include_router(admin_ticket_sales_import.router)
api_router.include_router(admin_user_import.router)
api_router.include_router(admin_event_dashboard.router)
api_router.include_router(admin_donor_dashboard.router)
api_router.include_router(admin_quick_entry.router)
api_router.include_router(donor_seating.router, tags=["donor-seating"])
api_router.include_router(notifications.router, tags=["notifications"])
api_router.include_router(push_subscriptions.router, tags=["push-notifications"])
api_router.include_router(notification_preferences.router, tags=["notifications"])
api_router.include_router(admin_notifications.router, tags=["admin-notifications"])
api_router.include_router(ticket_packages.router, prefix="/admin", tags=["admin-tickets"])
api_router.include_router(ticket_options.router, tags=["admin-tickets"])
api_router.include_router(event_custom_options.router, tags=["admin-tickets"])
api_router.include_router(promo_codes.router, tags=["admin-tickets"])
api_router.include_router(sales_tracking.router, prefix="/admin", tags=["admin-tickets"])
api_router.include_router(admin.router, tags=["admin"])
api_router.include_router(event_preview.admin_router, tags=["admin-preview"])
api_router.include_router(event_preview.preview_router, tags=["event-preview"])
# Feature 033: Payment processing
api_router.include_router(payments.router, tags=["payments"])
api_router.include_router(admin_payments.router, tags=["admin-payments"])
api_router.include_router(admin_npo_credentials.router, tags=["admin-npo-credentials"])
# Feature 036: Ticket purchasing
api_router.include_router(public_tickets.router, tags=["ticket-purchasing"])
# Feature 038: Auctioneer dashboard
api_router.include_router(admin_auctioneer.router, tags=["admin-auctioneer"])
api_router.include_router(ticket_assignments.router, tags=["ticket-purchasing"])
api_router.include_router(ticket_invitations.router, tags=["ticket-invitations"])

__all__ = ["api_router"]
