import enum
import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, IdMixin, TimestampMixin, str_enum
from app.member.models import Member


class TaskIcon(enum.StrEnum):
    LAUNDRY = "laundry"
    BALL = "ball"
    WATER = "water"
    CAR = "car"
    FLAG = "flag"
    KEY = "key"
    SHIRT = "shirt"
    FOOD = "food"
    MEDKIT = "medkit"
    OTHER = "other"


class TeamTask(IdMixin, TimestampMixin, Base):
    """A recurring chore the team needs done around events (laundry, carpool…)."""

    __tablename__ = "team_tasks"
    __table_args__ = (UniqueConstraint("team_id", "name", name="uq_team_tasks_team_name"),)

    team_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(60))
    icon: Mapped[TaskIcon] = mapped_column(str_enum(TaskIcon), default=TaskIcon.OTHER)


class TaskAssignment(IdMixin, TimestampMixin, Base):
    __tablename__ = "task_assignments"
    __table_args__ = (
        UniqueConstraint(
            "event_id", "team_task_id", "member_id", name="uq_task_assignments_event_task_member"
        ),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    team_task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_tasks.id", ondelete="CASCADE"), index=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("members.id", ondelete="CASCADE"), index=True
    )

    task: Mapped[TeamTask] = relationship(lazy="raise")
    member: Mapped[Member] = relationship(lazy="raise")
