import uuid

from app.event.exceptions import EventCancelledError
from app.event.models import COMPETITIVE_KINDS
from app.event.service import EventService
from app.lineup.exceptions import InvalidLineupError, LineupNotFoundError
from app.lineup.formations import FORMATIONS, Formation
from app.lineup.models import Lineup, LineupSlot, SlotRole
from app.lineup.repository import LineupRepository
from app.lineup.schemas import LineupResponse, LineupWrite, SlotInput
from app.member.repository import MemberRepository


def check_slots(formation: Formation, slots: list[SlotInput], player_ids: set[uuid.UUID]) -> None:
    """Validate a lineup against its formation and the team's players."""
    member_ids = [slot.member_id for slot in slots]
    if len(member_ids) != len(set(member_ids)):
        raise InvalidLineupError("duplicate_player", "A player appears twice in the lineup")
    if not set(member_ids) <= player_ids:
        raise InvalidLineupError("not_a_team_player", "Only the team's players can be selected")
    starters = [slot for slot in slots if slot.role == SlotRole.STARTER]
    positions = [slot.position_index for slot in starters]
    if any(index is None or index >= formation.players for index in positions):
        raise InvalidLineupError(
            "invalid_position", f"Starter positions go from 0 to {formation.players - 1}"
        )
    if len(positions) != len(set(positions)):
        raise InvalidLineupError("position_taken", "Two starters share the same position")
    if any(slot.position_index is not None for slot in slots if slot.role == SlotRole.SUBSTITUTE):
        raise InvalidLineupError("invalid_position", "Substitutes have no position")


class LineupService:
    def __init__(
        self,
        repository: LineupRepository,
        member_repository: MemberRepository,
        event_service: EventService,
    ):
        self.repository = repository
        self.member_repository = member_repository
        self.event_service = event_service

    @staticmethod
    def list_formations() -> list[Formation]:
        return list(FORMATIONS.values())

    async def get_lineup(self, event_id: uuid.UUID) -> LineupResponse:
        await self.event_service.get_event(event_id)
        lineup = await self.repository.get_by_event(event_id)
        if lineup is None:
            raise LineupNotFoundError(event_id)
        return await self._to_response(lineup)

    async def save_lineup(self, event_id: uuid.UUID, data: LineupWrite) -> LineupResponse:
        """Create or fully replace the event's lineup."""
        event = await self.event_service.get_event(event_id)
        if event.is_cancelled:
            raise EventCancelledError(event.id)
        if event.kind not in COMPETITIVE_KINDS:
            raise InvalidLineupError(
                "lineup_not_allowed", "Only matches and tournaments have a lineup"
            )
        formation = FORMATIONS.get(data.formation)
        if formation is None:
            raise InvalidLineupError("unknown_formation", f"Unknown formation {data.formation}")
        player_ids = await self.member_repository.list_player_ids_by_team(event.team_id)
        check_slots(formation, data.slots, player_ids)

        slots = [LineupSlot(**slot.model_dump()) for slot in data.slots]
        lineup = await self.repository.get_by_event(event_id)
        if lineup is None:
            lineup = Lineup(event_id=event_id, slots=slots)
        else:
            await self.repository.replace_slots(lineup, slots)
        lineup.formation, lineup.is_published = data.formation, data.is_published
        await self.repository.add(lineup)
        return await self.get_lineup(event_id)

    async def delete_lineup(self, event_id: uuid.UUID) -> None:
        lineup = await self.repository.get_by_event(event_id)
        if lineup is None:
            raise LineupNotFoundError(event_id)
        await self.repository.delete(lineup)

    async def _to_response(self, lineup: Lineup) -> LineupResponse:
        available = await self.repository.list_available_member_ids(lineup.event_id)
        response = LineupResponse.model_validate(lineup)
        response.unavailable_member_ids = [
            slot.member_id for slot in lineup.slots if slot.member_id not in available
        ]
        return response
