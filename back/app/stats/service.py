import uuid
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime

from app.core.database import utc_now
from app.invitation.models import PRESENT_STATUSES, AttendanceStatus, Availability
from app.invitation.schemas import InvitedMember
from app.match_fact.models import FactKind
from app.member.models import Member
from app.stats.repository import FactCounts, InvitationState, StatsRepository
from app.stats.schemas import (
    AttendanceReport,
    AttendanceRow,
    EventColumn,
    MatchResult,
    PlayerStats,
    TaskColumn,
    TaskReport,
    TaskRow,
    TeamStats,
)
from app.team.service import TeamService

FORM_LENGTH = 5
NOT_INVITED = "not_invited"


@dataclass
class PresenceCounts:
    invited: Counter[uuid.UUID] = field(default_factory=Counter)
    present: Counter[uuid.UUID] = field(default_factory=Counter)
    absent: Counter[uuid.UUID] = field(default_factory=Counter)


def is_present(availability: Availability, attendance: AttendanceStatus | None) -> bool:
    """Recorded attendance wins over the answer given before the event."""
    if attendance is not None:
        return attendance in PRESENT_STATUSES
    return availability == Availability.AVAILABLE


def is_absent(availability: Availability, attendance: AttendanceStatus | None) -> bool:
    if attendance is not None:
        return attendance not in PRESENT_STATUSES
    return availability == Availability.UNAVAILABLE


def count_presence(states: list[InvitationState]) -> PresenceCounts:
    counts = PresenceCounts()
    for _, member_id, availability, attendance in states:
        counts.invited[member_id] += 1
        counts.present[member_id] += is_present(availability, attendance)
        counts.absent[member_id] += is_absent(availability, attendance)
    return counts


def result_of(scored: int, conceded: int) -> MatchResult:
    return "W" if scored > conceded else "D" if scored == conceded else "L"


def summarize_results(scores: list[tuple[int, int]]) -> dict[str, object]:
    results = [result_of(scored, conceded) for scored, conceded in scores]
    return {
        "played": len(scores),
        "wins": results.count("W"),
        "draws": results.count("D"),
        "losses": results.count("L"),
        "goals_for": sum(scored for scored, _ in scores),
        "goals_against": sum(conceded for _, conceded in scores),
        "form": results[-FORM_LENGTH:],
    }


def build_player_stats(
    player: Member, facts: FactCounts, selections: int, presence: PresenceCounts
) -> PlayerStats:
    invited, present = presence.invited[player.id], presence.present[player.id]
    return PlayerStats(
        member=InvitedMember.model_validate(player),
        selections=selections,
        goals=facts.by_kind[FactKind.GOAL][player.id],
        assists=facts.assists[player.id],
        yellow_cards=facts.by_kind[FactKind.YELLOW_CARD][player.id],
        red_cards=facts.by_kind[FactKind.RED_CARD][player.id],
        invited=invited,
        present=present,
        absences=presence.absent[player.id],
        attendance_rate=round(present / invited, 2) if invited else None,
    )


def attendance_cells(
    states: list[InvitationState], event_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[str]]:
    """Per member, one status per event: attendance, else availability, else not invited."""
    by_key = {
        (event_id, member_id): (attendance or availability).value
        for event_id, member_id, availability, attendance in states
    }
    members = {member_id for _, member_id, _, _ in states}
    return {
        member_id: [by_key.get((event_id, member_id), NOT_INVITED) for event_id in event_ids]
        for member_id in members
    }


class StatsService:
    def __init__(self, repository: StatsRepository, team_service: TeamService):
        self.repository = repository
        self.team_service = team_service

    async def get_team_stats(self, team_id: uuid.UUID) -> TeamStats:
        """Season results of the team and per-player statistics and attendance."""
        await self.team_service.get_team(team_id)
        scores = await self.repository.list_scores(team_id)
        players = await self.repository.list_players(team_id)
        facts = await self.repository.count_facts(team_id)
        selections = await self.repository.count_selections(team_id)
        presence = count_presence(await self.repository.list_invitation_states(team_id))
        player_stats = [
            build_player_stats(player, facts, selections[player.id], presence) for player in players
        ]
        return TeamStats(team_id=team_id, players=player_stats, **summarize_results(scores))

    async def get_attendance_report(
        self, team_id: uuid.UUID, until: datetime | None
    ) -> AttendanceReport:
        """Grid of past events × players with the actual (or announced) presence."""
        await self.team_service.get_team(team_id)
        events = await self.repository.list_past_events(team_id, until or utc_now())
        players = await self.repository.list_players(team_id)
        event_ids = [event.id for event in events]
        past = set(event_ids)
        states = [
            state
            for state in await self.repository.list_invitation_states(team_id)
            if state[0] in past
        ]
        cells = attendance_cells(states, event_ids)
        presence = count_presence(states)
        rows = [
            AttendanceRow(
                member=InvitedMember.model_validate(player),
                cells=cells.get(player.id, [NOT_INVITED] * len(event_ids)),
                present=presence.present[player.id],
                invited=presence.invited[player.id],
            )
            for player in players
        ]
        columns = [EventColumn.model_validate(event, from_attributes=True) for event in events]
        return AttendanceReport(team_id=team_id, events=columns, rows=rows)

    async def get_task_report(self, team_id: uuid.UUID) -> TaskReport:
        """Season count of assigned tasks per member, busiest first."""
        await self.team_service.get_team(team_id)
        tasks = await self.repository.list_tasks(team_id)
        counts = await self.repository.count_assignments(team_id)
        rows = [
            TaskRow(
                member=InvitedMember.model_validate(member),
                counts=[counts[(member.id, task.id)] for task in tasks],
                total=sum(counts[(member.id, task.id)] for task in tasks),
            )
            for member in await self.repository.list_members(team_id)
        ]
        rows.sort(key=lambda row: row.total, reverse=True)
        columns = [TaskColumn.model_validate(task, from_attributes=True) for task in tasks]
        return TaskReport(team_id=team_id, tasks=columns, rows=rows)
