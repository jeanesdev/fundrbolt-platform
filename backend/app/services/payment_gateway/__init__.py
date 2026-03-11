"""Payment gateway abstraction package.

Exports the gateway port (ABC), stub implementation, and Deluxe implementation.

Usage:
    from app.services.payment_gateway import PaymentGatewayPort, StubPaymentGateway, DeluxePaymentGateway

Concrete classes are created in Phase 2 (T011–T013).  This __init__.py
provides the public surface so import statements written in Phase 1 skeleton
files do not need to change once the implementations exist.
"""

from app.services.payment_gateway.deluxe_gateway import DeluxePaymentGateway
from app.services.payment_gateway.port import PaymentGatewayPort
from app.services.payment_gateway.stub_gateway import StubPaymentGateway

__all__ = [
    "PaymentGatewayPort",
    "StubPaymentGateway",
    "DeluxePaymentGateway",
]
