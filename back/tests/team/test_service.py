import uuid
from unittest.mock import AsyncMock

import pytest

from app.team.exceptions import TeamAlreadyExistsError, TeamNotFoundError
from app.team.models import Team, TeamCategory
from app.team.schemas import TeamCreate, TeamUpdate
from app.team.service import TeamService


def make_team(name: str = "FC Easy", season: str = "2026-2027") -> Team:
    return Team(id=uuid.uuid4(), name=name, category=TeamCategory.SENIOR, season=season)


@pytest.fixture
def repository() -> AsyncMock:
    repo = AsyncMock()
    repo.add.side_effect = lambda team: team
    repo.save.side_effect = lambda team: team
    return repo


async def test_get_team_missing_raises_not_found(repository: AsyncMock):
    repository.get.return_value = None

    with pytest.raises(TeamNotFoundError):
        await TeamService(repository).get_team(uuid.uuid4())


async def test_create_team_duplicate_raises_already_exists(repository: AsyncMock):
    repository.find_by_name_and_season.return_value = make_team()
    data = TeamCreate(name="FC Easy", category=TeamCategory.SENIOR, season="2026-2027")

    with pytest.raises(TeamAlreadyExistsError):
        await TeamService(repository).create_team(data)
    repository.add.assert_not_awaited()


async def test_create_team_unique_name_persists(repository: AsyncMock):
    repository.find_by_name_and_season.return_value = None
    data = TeamCreate(name="U11", category=TeamCategory.U11, season="2026-2027")

    team = await TeamService(repository).create_team(data)

    assert team.name == "U11"
    repository.add.assert_awaited_once()


async def test_update_team_rename_to_existing_name_raises_already_exists(repository: AsyncMock):
    team, other = make_team("A"), make_team("B")
    repository.get.return_value = team
    repository.find_by_name_and_season.return_value = other

    with pytest.raises(TeamAlreadyExistsError):
        await TeamService(repository).update_team(team.id, TeamUpdate(name="B"))


async def test_update_team_same_name_keeps_team(repository: AsyncMock):
    team = make_team("A")
    repository.get.return_value = team
    repository.find_by_name_and_season.return_value = team

    updated = await TeamService(repository).update_team(team.id, TeamUpdate(name="A"))

    assert updated is team
