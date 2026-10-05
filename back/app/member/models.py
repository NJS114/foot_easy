import enum
import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin, str_enum


class MemberRole(enum.StrEnum):
    PLAYER = "player"
    COACH = "coach"
    STAFF = "staff"
    PRESIDENT = "president"
    SECRETARY = "secretary"  # pragma: allowlist secret
    TREASURER = "treasurer"
    TECHNICAL_DIRECTOR = "technical_director"
    VOLUNTEER = "volunteer"
    REFEREE = "referee"


class PlayerPosition(enum.StrEnum):
    GOALKEEPER = "goalkeeper"
    DEFENDER = "defender"
    MIDFIELDER = "midfielder"
    FORWARD = "forward"


class JerseySize(enum.StrEnum):
    KIDS_6 = "6y"
    KIDS_8 = "8y"
    KIDS_10 = "10y"
    KIDS_12 = "12y"
    KIDS_14 = "14y"
    XS = "xs"
    S = "s"
    M = "m"
    L = "l"
    XL = "xl"
    XXL = "xxl"


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
    last_name: Mapped[str] = mapped_column(String(80), index=True)
    email: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str | None] = mapped_column(String(30))
    birth_date: Mapped[date | None] = mapped_column(Date)
    license_number: Mapped[str | None] = mapped_column(String(30))
    jersey_size: Mapped[JerseySize | None] = mapped_column(str_enum(JerseySize))
    role: Mapped[MemberRole] = mapped_column(str_enum(MemberRole), default=MemberRole.PLAYER)
    position: Mapped[PlayerPosition | None] = mapped_column(str_enum(PlayerPosition))
    shirt_number: Mapped[int | None] = mapped_column(SmallInteger)
