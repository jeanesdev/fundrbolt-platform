"""Pydantic schemas for push subscriptions."""

from pydantic import BaseModel


class PushKeys(BaseModel):
    """Web Push subscription keys."""

    p256dh: str
    auth: str


class PushSubscribeRequest(BaseModel):
    """Schema for subscribing to push notifications."""

    endpoint: str
    keys: PushKeys
    platform: str | None = None


class PushUnsubscribeRequest(BaseModel):
    """Schema for unsubscribing from push notifications."""

    endpoint: str


class VapidPublicKeyResponse(BaseModel):
    """Schema for returning the VAPID public key."""

    public_key: str
