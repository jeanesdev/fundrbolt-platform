"""Checklist models for event planning checklist feature."""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class ChecklistItemStatus(str, enum.Enum):
    """Status values for checklist items."""

    NOT_COMPLETE = "not_complete"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"


class ChecklistTemplate(Base, UUIDMixin, TimestampMixin):
    """Reusable checklist template stored at the NPO level."""

    __tablename__ = "checklist_templates"

    npo_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("npos.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
        comment="Owning organization. NULL = system default",
    )
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Template display name",
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
        comment="Whether this is the NPO's default template",
    )
    is_system_default: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
        comment="Whether this is the immutable system template",
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="User who created the template. NULL for system-seeded",
    )

    # Relationships
    npo: Mapped["NPO"] = relationship("NPO", lazy="select")  # type: ignore[name-defined]  # noqa: F821
    creator: Mapped["User | None"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "User",
        foreign_keys=[created_by],
        lazy="select",
    )
    items: Mapped[list["ChecklistTemplateItem"]] = relationship(
        "ChecklistTemplateItem",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="ChecklistTemplateItem.display_order",
        lazy="select",
    )

    __table_args__ = (
        UniqueConstraint("npo_id", "name", name="uq_checklist_templates_npo_id_name"),
        CheckConstraint(
            "NOT is_system_default OR npo_id IS NULL",
            name="ck_system_default_no_npo",
        ),
        Index(
            "ix_checklist_templates_npo_default",
            "npo_id",
            unique=True,
            postgresql_where="is_default = TRUE",
        ),
    )

    def __repr__(self) -> str:
        return f"<ChecklistTemplate(id={self.id}, name='{self.name}', npo_id={self.npo_id})>"


class ChecklistTemplateItem(Base, UUIDMixin):
    """Individual task definition within a template."""

    __tablename__ = "checklist_template_items"

    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("checklist_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Parent template",
    )
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Task title",
    )
    offset_days: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Days relative to event date. Negative=before, positive=after, NULL=no due date",
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default="0",
        comment="Sort position within template",
    )

    # Relationships
    template: Mapped["ChecklistTemplate"] = relationship(
        "ChecklistTemplate",
        back_populates="items",
        lazy="select",
    )

    __table_args__ = (
        CheckConstraint("length(title) >= 1", name="ck_template_item_title_nonempty"),
    )

    def __repr__(self) -> str:
        return f"<ChecklistTemplateItem(id={self.id}, title='{self.title}', offset_days={self.offset_days})>"


class ChecklistItem(Base, UUIDMixin, TimestampMixin):
    """Concrete checklist item attached to a specific event."""

    __tablename__ = "checklist_items"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Parent event",
    )
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Task title",
    )
    due_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="When the task is due",
    )
    status: Mapped[ChecklistItemStatus] = mapped_column(
        Enum(
            ChecklistItemStatus,
            name="checklist_item_status_enum",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
        server_default="not_complete",
        comment="Current task status",
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default="0",
        comment="Sort position",
    )
    due_date_is_template_derived: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
        comment="TRUE if due_date was calculated from a template offset",
    )
    offset_days: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Original template offset for recalculation. NULL if manually set",
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when status changed to complete",
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        comment="User who created the item",
    )

    # Relationships
    event: Mapped["Event"] = relationship("Event", lazy="select")  # type: ignore[name-defined]  # noqa: F821
    creator: Mapped["User"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "User",
        foreign_keys=[created_by],
        lazy="select",
    )

    __table_args__ = (
        CheckConstraint("length(title) >= 1", name="ck_checklist_item_title_nonempty"),
    )

    def __repr__(self) -> str:
        return f"<ChecklistItem(id={self.id}, title='{self.title}', status={self.status})>"
