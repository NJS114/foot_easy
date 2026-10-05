from sqlalchemy.ext.asyncio import AsyncSession

from app.event.models import Event
from app.invitation.models import Availability, Invitation
from app.lineup.models import Lineup, LineupSlot, SlotRole
from app.lineup.repository import LineupRepository
from app.member.models import Member
from tests.conftest import persist


async def test_get_by_event_loads_slots_with_members(
    session: AsyncSession, match: Event, player: Member
):
    repository = LineupRepository(session)
    slot = LineupSlot(member_id=player.id, role=SlotRole.STARTER, position_index=0)
    await repository.add(Lineup(event_id=match.id, formation="4-4-2", slots=[slot]))

    lineup = await repository.get_by_event(match.id)

    assert lineup.slots[0].member.last_name == player.last_name


async def test_list_available_member_ids_only_available(
    session: AsyncSession, match: Event, player: Member, coach: Member
):
    await persist(
        session,
        Invitation(event_id=match.id, member_id=player.id, availability=Availability.AVAILABLE),
    )
    await persist(
        session,
        Invitation(event_id=match.id, member_id=coach.id, availability=Availability.PENDING),
    )

    assert await LineupRepository(session).list_available_member_ids(match.id) == {player.id}
