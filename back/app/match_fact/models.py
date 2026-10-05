import enum
import uuid

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, IdMixin, TimestampMixin, str_enum
from app.member.models import Member


class FactKind(enum.StrEnum):
    GOAL = "goal"
    YELLOW_CARD = "yellow_card"
    RED_CARD = "red_card"


class MatchFact(IdMixin, TimestampMixin, Base):
    __tablename__ = "match_facts"
    __table_args__ = (CheckConstraint("minute BETWEEN 0 AND 130", name="ck_match_facts_minute"),)

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[FactKind] = mapped_column(str_enum(FactKind))
    member_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("members.id", ondelete="CASCADE"), index=True
    )
    assist_member_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("members.id", ondelete="SET NULL"), index=True
    )
    minute: Mapped[int | None] = mapped_column(SmallInteger)

    member: Mapped[Member] = relationship(lazy="raise", foreign_keys=[member_id])
    assist_member: Mapped[Member | None] = relationship(
        lazy="raise", foreign_keys=[assist_member_id]
    )
