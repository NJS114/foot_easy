import enum
import uuid

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, IdMixin, TimestampMixin, str_enum
from app.member.models import Member


class SlotRole(enum.StrEnum):
    STARTER = "starter"
    SUBSTITUTE = "substitute"


class Lineup(IdMixin, TimestampMixin, Base):
    __tablename__ = "lineups"

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), unique=True
    )
    formation: Mapped[str] = mapped_column(String(10))
    is_published: Mapped[bool] = mapped_column(default=False)

    slots: Mapped[list["LineupSlot"]] = relationship(
        lazy="raise",
        cascade="all, delete-orphan",
        order_by="(LineupSlot.role, LineupSlot.position_index)",
    )


class LineupSlot(IdMixin, Base):
    __tablename__ = "lineup_slots"
    __table_args__ = (
        UniqueConstraint("lineup_id", "member_id", name="uq_lineup_slots_member"),
        CheckConstraint("position_index >= 0", name="ck_lineup_slots_position_index"),
    )

    lineup_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lineups.id", ondelete="CASCADE"), index=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("members.id", ondelete="CASCADE"))
    role: Mapped[SlotRole] = mapped_column(str_enum(SlotRole))
    position_index: Mapped[int | None] = mapped_column(SmallInteger)

    member: Mapped[Member] = relationship(lazy="raise")
