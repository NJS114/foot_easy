import uuid

from app.event.models import COMPETITIVE_KINDS
from app.event.service import EventService
from app.match_fact.exceptions import InvalidMatchFactError, MatchFactNotFoundError
from app.match_fact.models import FactKind, MatchFact
from app.match_fact.repository import MatchFactRepository
from app.match_fact.schemas import MatchFactCreate
from app.member.repository import MemberRepository


def check_fact(data: MatchFactCreate, player_ids: set[uuid.UUID]) -> None:
    """Validate a match fact against the team's players."""
    involved = {data.member_id} | ({data.assist_member_id} - {None})
    if not involved <= player_ids:
        raise InvalidMatchFactError("not_a_team_player", "Only the team's players can be credited")
    if data.assist_member_id is not None and data.kind != FactKind.GOAL:
        raise InvalidMatchFactError("assist_not_allowed", "Only a goal can have an assist")
    if data.assist_member_id == data.member_id:
        raise InvalidMatchFactError("self_assist", "A scorer cannot assist their own goal")


class MatchFactService:
    def __init__(
        self,
        repository: MatchFactRepository,
        member_repository: MemberRepository,
        event_service: EventService,
    ):
        self.repository = repository
        self.member_repository = member_repository
        self.event_service = event_service

    async def list_facts(
        self, event_id: uuid.UUID, skip: int, limit: int
    ) -> tuple[list[MatchFact], int]:
        await self.event_service.get_event(event_id)
        return await self.repository.list_by_event(event_id, skip, limit)

    async def create_fact(self, data: MatchFactCreate) -> MatchFact:
        event = await self.event_service.get_event(data.event_id)
        if event.kind not in COMPETITIVE_KINDS:
            raise InvalidMatchFactError(
                "facts_not_allowed", "Only matches and tournaments have facts"
            )
        check_fact(data, await self.member_repository.list_player_ids_by_team(event.team_id))
        is_goal_over_score = (
            data.kind == FactKind.GOAL
            and event.score_for is not None
            and await self.repository.count_goals(event.id) >= event.score_for
        )
        if is_goal_over_score:
            raise InvalidMatchFactError(
                "goals_exceed_score", "There are already as many goals as the score"
            )
        fact = await self.repository.add(MatchFact(**data.model_dump()))
        return await self.repository.get(fact.id)

    async def delete_fact(self, fact_id: uuid.UUID) -> None:
        fact = await self.repository.get(fact_id)
        if fact is None:
            raise MatchFactNotFoundError(fact_id)
        await self.repository.delete(fact)
