import enum

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin, str_enum


class TeamCategory(enum.StrEnum):
    U7 = "u7"
    U9 = "u9"
    U11 = "u11"
    U13 = "u13"
    U15 = "u15"
    U17 = "u17"
    U19 = "u19"
    SENIOR = "senior"
    VETERAN = "veteran"


class Team(IdMixin, TimestampMixin, Base):
    __tablename__ = "teams"
    __table_args__ = (UniqueConstraint("name", "season", name="uq_teams_name_season"),)

    name: Mapped[str] = mapped_column(String(100))
    category: Mapped[TeamCategory] = mapped_column(str_enum(TeamCategory))
    season: Mapped[str] = mapped_column(String(9), index=True)
