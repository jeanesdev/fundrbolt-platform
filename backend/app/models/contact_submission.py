"""Contact submission model for landing page contact form."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class SubmissionStatus(str, enum.Enum):
    """Status of contact form submission."""

    PENDING = "pending"
    PROCESSED = "processed"
    FAILED = "failed"


class ContactSubmission(Base):
    """
    Contact form submission model.

    Stores messages from public contact form with audit trail.
    Immutable after creation (except status updates).
    """

    __tablename__ = "contact_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_name = Column(String(100), nullable=False)
    sender_email = Column(String(255), nullable=False)
    subject = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    ip_address = Column(String(45), nullable=False)
    status: Column[SubmissionStatus] = Column(
        Enum(SubmissionStatus, native_enum=True, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=SubmissionStatus.PENDING,
    )
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<ContactSubmission {self.id} from {self.sender_email}>"
