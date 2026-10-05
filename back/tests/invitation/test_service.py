import uuid
from unittest.mock import AsyncMock

import pytest

from app.event.exceptions import EventCancelledError
from app.event.models import Event
from app.invitation.exceptions import InvitationNotFoundError, MemberNotInTeamError
from app.invitation.models import Availability, Invitation
from app.invitation.schemas import InvitationCreate, InvitationReply
from app.invitation.service import InvitationService

TEAM_ID = uuid.uuid4()
ROSTER = [uuid.uuid4(), uuid.uuid4(), uuid.uuid4()]


@pytest.fixture
def event() -> Event:
    return Event(id=uuid.uuid4(), team_id=TEAM_ID, is_cancelled=False)


@pytest.fixture
def service(event: Event) -> InvitationService:
    repository, member_repository, event_service = AsyncMock(), AsyncMock(), AsyncMock()
    event_service.get_event.return_value = event
    member_repository.list_ids_by_team.return_value = ROSTER
    repository.list_invited_member_ids.return_value = {ROSTER[0]}
    repository.get.side_effect = lambda invitation_id: Invitation(id=invitation_id)
    return InvitationService(repository, member_repository, event_service)


async def test_invite_members_skips_already_invited(service: InvitationService, event: Event):
    await service.invite_members(InvitationCreate(event_id=event.id))

    [created] = service.repository.add_all.await_args.args
    assert {invitation.member_id for invitation in created} == set(ROSTER[1:])


async def test_invite_members_outside_roster_raises(service: InvitationService, event: Event):
    data = InvitationCreate(event_id=event.id, member_ids=[ROSTER[1], uuid.uuid4()])

    with pytest.raises(MemberNotInTeamError):
        await service.invite_members(data)
    service.repository.add_all.assert_not_awaited()


async def test_invite_members_cancelled_event_raises(service: InvitationService, event: Event):
    event.is_cancelled = True

    with pytest.raises(EventCancelledError):
        await service.invite_members(InvitationCreate(event_id=event.id))


async def test_reply_sets_availability_comment_and_timestamp(service: InvitationService):
    invitation = Invitation(id=uuid.uuid4(), availability=Availability.PENDING)
    service.repository.get.side_effect = None
    service.repository.get.return_value = invitation

    await service.reply(invitation.id, InvitationReply(availability=Availability.AVAILABLE))

    assert invitation.availability == Availability.AVAILABLE
    assert invitation.responded_at is not None
    service.repository.save.assert_awaited_once_with(invitation)


async def test_reply_missing_invitation_raises(service: InvitationService):
    service.repository.get.side_effect = None
    service.repository.get.return_value = None

    with pytest.raises(InvitationNotFoundError):
        await service.reply(uuid.uuid4(), InvitationReply(availability=Availability.UNCERTAIN))


async def test_summarize_fills_missing_availabilities_with_zero(
    service: InvitationService, event: Event
):
    service.repository.count_by_availability.return_value = {Availability.AVAILABLE: 4}

    summary = await service.summarize(event.id)

    assert summary.invited == 4
    assert summary.available == 4
    assert summary.pending == 0
