import uuid

from app.invitation.schemas import InvitedMember
from app.match_fact.models import FactKind
from app.member.models import Member
from app.stats.repository import FactCounts, StatsRepository
from app.stats.schemas import PlayerStats, TeamStats
from app.team.service import TeamService


def summarize_results(scores: list[tuple[int, int]]) -> dict[str, int]:
    return {
        "played": len(scores),
        "wins": sum(1 for scored, conceded in scores if scored > conceded),
        "draws": sum(1 for scored, conceded in scores if scored == conceded),
        "losses": sum(1 for scored, conceded in scores if scored < conceded),
        "goals_for": sum(scored for scored, _ in scores),
        "goals_against": sum(conceded for _, conceded in scores),
    }


def build_player_stats(
    player: Member, facts: FactCounts, selections: int, invited: int, present: int
) -> PlayerStats:
    return PlayerStats(
        member=InvitedMember.model_validate(player),
        selections=selections,
        goals=facts.by_kind[FactKind.GOAL][player.id],
        assists=facts.assists[player.id],
        yellow_cards=facts.by_kind[FactKind.YELLOW_CARD][player.id],
        red_cards=facts.by_kind[FactKind.RED_CARD][player.id],
        invited=invited,
        present=present,
        attendance_rate=round(present / invited, 2) if invited else None,
    )


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
        invited, present = await self.repository.count_invitations(team_id)
        player_stats = [
            build_player_stats(
                player, facts, selections[player.id], invited[player.id], present[player.id]
            )
            for player in players
        ]
        return TeamStats(team_id=team_id, players=player_stats, **summarize_results(scores))
