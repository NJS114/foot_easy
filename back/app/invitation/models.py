import enum
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, IdMixin, TimestampMixin, UtcDateTime, str_enum
from app.member.models import Member


class Availability(enum.StrEnum):
    PENDING = "pending"
    AVAILABLE = "available"
    UNCERTAIN = "uncertain"
    UNAVAILABLE = "unavailable"


class Invitation(IdMixin, TimestampMixin, Base):
    __tablename__ = "invitations"
    __table_args__ = (
        UniqueConstraint("event_id", "member_id", name="uq_invitations_event_member"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("members.id", ondelete="CASCADE"), index=True
    )
    availability: Mapped[Availability] = mapped_column(
        str_enum(Availability), default=Availability.PENDING
    )
    comment: Mapped[str | None] = mapped_column(String(200))
    responded_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    reminder_count: Mapped[int] = mapped_column(SmallInteger, default=0)
    last_reminded_at: Mapped[datetime | None] = mapped_column(UtcDateTime)

    member: Mapped[Member] = relationship(lazy="raise")
