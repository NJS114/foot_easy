import uuid
from unittest.mock import AsyncMock

import pytest

from app.member.exceptions import (
    MemberNotFoundError,
    PositionNotAllowedError,
    ShirtNumberTakenError,
)
from app.member.models import Member, MemberRole, PlayerPosition
from app.member.schemas import MemberCreate, MemberUpdate
from app.member.service import MemberService
from app.team.exceptions import TeamNotFoundError

TEAM_ID = uuid.uuid4()


@pytest.fixture
def repository() -> AsyncMock:
    repo = AsyncMock()
    repo.add.side_effect = lambda member: member
    repo.save.side_effect = lambda member: member
    repo.find_by_shirt_number.return_value = None
    return repo


@pytest.fixture
def team_service() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def club_service() -> AsyncMock:
    return AsyncMock()


def svc(repository, team_service, club_service) -> MemberService:
    return MemberService(repository, team_service, club_service)


def player_data(**overrides) -> MemberCreate:
    fields = {"team_id": TEAM_ID, "first_name": "N", "last_name": "K", "shirt_number": 9}
    return MemberCreate(**{**fields, **overrides})


async def test_create_member_unknown_team_propagates_not_found(
    repository, team_service, club_service
):
    team_service.get_team.side_effect = TeamNotFoundError(TEAM_ID)

    with pytest.raises(TeamNotFoundError):
        await svc(repository, team_service, club_service).create_member(player_data())
    repository.add.assert_not_awaited()


async def test_create_member_shirt_number_held_by_other_raises_conflict(
    repository, team_service, club_service
):
    repository.find_by_shirt_number.return_value = Member(id=uuid.uuid4())

    with pytest.raises(ShirtNumberTakenError):
        await svc(repository, team_service, club_service).create_member(player_data())


async def test_create_member_staff_with_shirt_number_raises_rule_error(
    repository, team_service, club_service
):
    data = player_data(role=MemberRole.STAFF)

    with pytest.raises(PositionNotAllowedError):
        await svc(repository, team_service, club_service).create_member(data)


async def test_update_member_keeping_own_shirt_number_succeeds(
    repository, team_service, club_service
):
    member = Member(
        id=uuid.uuid4(), team_id=TEAM_ID, role=MemberRole.PLAYER, shirt_number=9, position=None
    )
    repository.get.return_value = member
    repository.find_by_shirt_number.return_value = member

    updated = await svc(repository, team_service, club_service).update_member(
        member.id, MemberUpdate(position=PlayerPosition.FORWARD)
    )

    assert updated.position == PlayerPosition.FORWARD


async def test_get_member_missing_raises_not_found(repository, team_service, club_service):
    repository.get.return_value = None

    with pytest.raises(MemberNotFoundError):
        await svc(repository, team_service, club_service).get_member(uuid.uuid4())
