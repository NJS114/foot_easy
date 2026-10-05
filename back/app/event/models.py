import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin, UtcDateTime, str_enum


class EventKind(enum.StrEnum):
    MATCH = "match"
    TRAINING = "training"
    TOURNAMENT = "tournament"
    OTHER = "other"


COMPETITIVE_KINDS = frozenset({EventKind.MATCH, EventKind.TOURNAMENT})


class Venue(enum.StrEnum):
    HOME = "home"
    AWAY = "away"


class Event(IdMixin, TimestampMixin, Base):
    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_team_id_starts_at", "team_id", "starts_at"),
        CheckConstraint("score_for >= 0 AND score_against >= 0", name="ck_events_scores_positive"),
    )

    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    kind: Mapped[EventKind] = mapped_column(str_enum(EventKind))
    title: Mapped[str] = mapped_column(String(120))
    starts_at: Mapped[datetime] = mapped_column(UtcDateTime)
    ends_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    meeting_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    location: Mapped[str | None] = mapped_column(String(200))
    opponent: Mapped[str | None] = mapped_column(String(100))
    venue: Mapped[Venue | None] = mapped_column(str_enum(Venue))
    notes: Mapped[str | None] = mapped_column(Text)
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False)
    score_for: Mapped[int | None] = mapped_column(SmallInteger)
    score_against: Mapped[int | None] = mapped_column(SmallInteger)
    series_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)
