import uuid
from unittest.mock import AsyncMock

import pytest

from app.club.exceptions import ClubNotFoundError
from app.team.exceptions import TeamAlreadyExistsError, TeamNotFoundError
from app.team.models import Team, TeamCategory
from app.team.schemas import TeamCreate, TeamUpdate
from app.team.service import TeamService

CLUB_ID = uuid.uuid4()


def make_team(name: str = "FC Easy", season: str = "2026-2027") -> Team:
    return Team(
        id=uuid.uuid4(), club_id=CLUB_ID, name=name, category=TeamCategory.SENIOR, season=season
    )


def team_data(name: str = "FC Easy") -> TeamCreate:
    return TeamCreate(club_id=CLUB_ID, name=name, category=TeamCategory.SENIOR, season="2026-2027")


@pytest.fixture
def repository() -> AsyncMock:
    repo = AsyncMock()
    repo.add.side_effect = lambda team: team
    repo.save.side_effect = lambda team: team
    return repo


@pytest.fixture
def service(repository: AsyncMock) -> TeamService:
    return TeamService(repository, AsyncMock())


async def test_get_team_missing_raises_not_found(service: TeamService, repository: AsyncMock):
    repository.get.return_value = None

    with pytest.raises(TeamNotFoundError):
        await service.get_team(uuid.uuid4())


async def test_create_team_unknown_club_raises_not_found(service: TeamService):
    service.club_service.get_club.side_effect = ClubNotFoundError(CLUB_ID)

    with pytest.raises(ClubNotFoundError):
        await service.create_team(team_data())


async def test_create_team_duplicate_raises_already_exists(
    service: TeamService, repository: AsyncMock
):
    repository.find_by_name_and_season.return_value = make_team()

    with pytest.raises(TeamAlreadyExistsError):
        await service.create_team(team_data())
    repository.add.assert_not_awaited()


async def test_create_team_unique_name_persists(service: TeamService, repository: AsyncMock):
    repository.find_by_name_and_season.return_value = None

    team = await service.create_team(team_data("U11"))

    assert team.name == "U11"
    repository.find_by_name_and_season.assert_awaited_once_with(CLUB_ID, "U11", "2026-2027")


async def test_update_team_rename_to_existing_name_raises_already_exists(
    service: TeamService, repository: AsyncMock
):
    team, other = make_team("A"), make_team("B")
    repository.get.return_value = team
    repository.find_by_name_and_season.return_value = other

    with pytest.raises(TeamAlreadyExistsError):
        await service.update_team(team.id, TeamUpdate(name="B"))


async def test_update_team_same_name_keeps_team(service: TeamService, repository: AsyncMock):
    team = make_team("A")
    repository.get.return_value = team
    repository.find_by_name_and_season.return_value = team

    updated = await service.update_team(team.id, TeamUpdate(name="A", color="#000000"))

    assert updated is team
    assert team.color == "#000000"
