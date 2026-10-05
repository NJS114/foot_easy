import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.event.models import EventKind
from app.invitation.schemas import InvitedMember
from app.task.models import TaskIcon

MatchResult = Literal["W", "D", "L"]


class PlayerStats(BaseModel):
    member: InvitedMember
    selections: int
    goals: int
    assists: int
    yellow_cards: int
    red_cards: int
    invited: int
    present: int
    absences: int
    attendance_rate: float | None


class TeamStats(BaseModel):
    team_id: uuid.UUID
    played: int
    wins: int
    draws: int
    losses: int
    goals_for: int
    goals_against: int
    form: list[MatchResult] = Field(description="Last results, oldest first")
    players: list[PlayerStats]


class EventColumn(BaseModel):
    id: uuid.UUID
    title: str
    kind: EventKind
    starts_at: datetime


class AttendanceRow(BaseModel):
    member: InvitedMember
    cells: list[str] = Field(
        description="One per event column: attendance if recorded, else the availability "
        "answer, else 'not_invited'"
    )
    present: int
    invited: int


class AttendanceReport(BaseModel):
    team_id: uuid.UUID
    events: list[EventColumn]
    rows: list[AttendanceRow]


class TaskColumn(BaseModel):
    id: uuid.UUID
    name: str
    icon: TaskIcon


class TaskRow(BaseModel):
    member: InvitedMember
    counts: list[int] = Field(description="One per task column")
    total: int


class TaskReport(BaseModel):
    team_id: uuid.UUID
    tasks: list[TaskColumn]
    rows: list[TaskRow]
