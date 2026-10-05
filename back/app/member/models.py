import enum
import uuid

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin, str_enum


class MemberRole(enum.StrEnum):
    PLAYER = "player"
    COACH = "coach"
    STAFF = "staff"


class PlayerPosition(enum.StrEnum):
    GOALKEEPER = "goalkeeper"
    DEFENDER = "defender"
    MIDFIELDER = "midfielder"
    FORWARD = "forward"


class Member(IdMixin, TimestampMixin, Base):
    __tablename__ = "members"
    __table_args__ = (
        UniqueConstraint("team_id", "shirt_number", name="uq_members_team_shirt_number"),
        CheckConstraint("shirt_number BETWEEN 1 AND 99", name="ck_members_shirt_number_range"),
    )

    team_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"), index=True
    )
    first_name: Mapped[str] = mapped_column(String(80))
    last_name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str | None] = mapped_column(String(254))
    role: Mapped[MemberRole] = mapped_column(str_enum(MemberRole), default=MemberRole.PLAYER)
    position: Mapped[PlayerPosition | None] = mapped_column(str_enum(PlayerPosition))
    shirt_number: Mapped[int | None] = mapped_column(SmallInteger)
