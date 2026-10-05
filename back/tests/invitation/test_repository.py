import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.event.models import Event
from app.invitation.models import Availability, Invitation
from app.invitation.repository import InvitationRepository
from app.member.models import Member


async def test_get_loads_member_eagerly(session: AsyncSession, match: Event, player: Member):
    repository = InvitationRepository(session)
    invitation = Invitation(event_id=match.id, member_id=player.id)
    await repository.add_all([invitation])

    loaded = await repository.get(invitation.id)

    assert loaded.member.last_name == player.last_name


async def test_member_invited_once_per_event_enforced_by_db(
    session: AsyncSession, match: Event, player: Member
):
    repository = InvitationRepository(session)
    await repository.add_all([Invitation(event_id=match.id, member_id=player.id)])

    with pytest.raises(IntegrityError):
        await repository.add_all([Invitation(event_id=match.id, member_id=player.id)])


async def test_count_by_availability_groups_counts(
    session: AsyncSession, match: Event, player: Member, coach: Member
):
    repository = InvitationRepository(session)
    await repository.add_all(
        [
            Invitation(event_id=match.id, member_id=player.id, availability=Availability.AVAILABLE),
            Invitation(event_id=match.id, member_id=coach.id, availability=Availability.AVAILABLE),
        ]
    )

    assert await repository.count_by_availability(match.id) == {Availability.AVAILABLE: 2}


async def test_list_by_event_orders_by_role_then_name(
    session: AsyncSession, match: Event, player: Member, coach: Member
):
    repository = InvitationRepository(session)
    await repository.add_all(
        [Invitation(event_id=match.id, member_id=m.id) for m in (player, coach)]
    )

    invitations, total = await repository.list_by_event(match.id, None, skip=0, limit=10)

    assert total == 2
    assert [i.member_id for i in invitations] == [coach.id, player.id]
