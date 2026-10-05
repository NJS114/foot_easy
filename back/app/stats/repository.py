import uuid
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.event.models import COMPETITIVE_KINDS, Event
from app.invitation.models import AttendanceStatus, Availability, Invitation
from app.lineup.models import Lineup, LineupSlot
from app.match_fact.models import FactKind, MatchFact
from app.member.models import Member, MemberRole
from app.task.models import TaskAssignment, TeamTask

InvitationState = tuple[uuid.UUID, uuid.UUID, Availability, AttendanceStatus | None]


@dataclass
class FactCounts:
    by_kind: dict[FactKind, Counter[uuid.UUID]] = field(
        default_factory=lambda: {kind: Counter() for kind in FactKind}
    )
    assists: Counter[uuid.UUID] = field(default_factory=Counter)


class StatsRepository:
    """Read-only aggregations over a team's season."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_scores(self, team_id: uuid.UUID) -> list[tuple[int, int]]:
        query = (
            select(Event.score_for, Event.score_against)
            .where(
                Event.team_id == team_id,
                Event.kind.in_(COMPETITIVE_KINDS),
                Event.is_cancelled.is_(False),
                Event.score_for.is_not(None),
                Event.score_against.is_not(None),
            )
            .order_by(Event.starts_at)
        )
        return [(scored, conceded) for scored, conceded in await self.session.execute(query)]

    async def list_players(self, team_id: uuid.UUID) -> list[Member]:
        query = (
            select(Member)
            .where(Member.team_id == team_id, Member.role == MemberRole.PLAYER)
            .order_by(Member.shirt_number, Member.last_name)
        )
        return list(await self.session.scalars(query))

    async def list_past_events(self, team_id: uuid.UUID, until: datetime) -> list[Event]:
        query = (
            select(Event)
            .where(
                Event.team_id == team_id,
                Event.is_cancelled.is_(False),
                Event.starts_at <= until,
            )
            .order_by(Event.starts_at)
        )
        return list(await self.session.scalars(query))

    async def list_invitation_states(self, team_id: uuid.UUID) -> list[InvitationState]:
        query = (
            select(
                Invitation.event_id,
                Invitation.member_id,
                Invitation.availability,
                Invitation.attendance,
            )
            .join(Event, Event.id == Invitation.event_id)
            .where(Event.team_id == team_id, Event.is_cancelled.is_(False))
        )
        return [tuple(row) for row in await self.session.execute(query)]  # type: ignore[misc]

    async def count_facts(self, team_id: uuid.UUID) -> FactCounts:
        query = (
            select(MatchFact.kind, MatchFact.member_id, MatchFact.assist_member_id)
            .join(Event, Event.id == MatchFact.event_id)
            .where(Event.team_id == team_id, Event.is_cancelled.is_(False))
        )
        counts = FactCounts()
        for kind, member_id, assist_id in await self.session.execute(query):
            counts.by_kind[kind][member_id] += 1
            if assist_id is not None:
                counts.assists[assist_id] += 1
        return counts

    async def count_selections(self, team_id: uuid.UUID) -> Counter[uuid.UUID]:
        query = (
            select(LineupSlot.member_id, func.count())
            .join(Lineup, Lineup.id == LineupSlot.lineup_id)
            .join(Event, Event.id == Lineup.event_id)
            .where(Event.team_id == team_id, Event.is_cancelled.is_(False))
            .group_by(LineupSlot.member_id)
        )
        return Counter({member_id: count for member_id, count in await self.session.execute(query)})

    async def list_tasks(self, team_id: uuid.UUID) -> list[TeamTask]:
        query = select(TeamTask).where(TeamTask.team_id == team_id).order_by(TeamTask.name)
        return list(await self.session.scalars(query))

    async def count_assignments(self, team_id: uuid.UUID) -> Counter[tuple[uuid.UUID, uuid.UUID]]:
        """Assignments per (member, task) over the team's non-cancelled events."""
        query = (
            select(TaskAssignment.member_id, TaskAssignment.team_task_id, func.count())
            .join(Event, Event.id == TaskAssignment.event_id)
            .where(Event.team_id == team_id, Event.is_cancelled.is_(False))
            .group_by(TaskAssignment.member_id, TaskAssignment.team_task_id)
        )
        rows = await self.session.execute(query)
        return Counter({(member_id, task_id): count for member_id, task_id, count in rows})

    async def list_members(self, team_id: uuid.UUID) -> list[Member]:
        query = select(Member).where(Member.team_id == team_id).order_by(Member.last_name)
        return list(await self.session.scalars(query))
