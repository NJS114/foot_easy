import uuid
from unittest.mock import AsyncMock

import pytest

from app.club.exceptions import ClubAlreadyExistsError, ClubNotFoundError
from app.club.models import Club
from app.club.schemas import ClubCreate, ClubUpdate
from app.club.service import ClubService


@pytest.fixture
def repository() -> AsyncMock:
    repo = AsyncMock()
    repo.add.side_effect = lambda club: club
    repo.save.side_effect = lambda club: club
    return repo


async def test_create_club_duplicate_raises(repository: AsyncMock):
    repository.find_by_name.return_value = Club(id=uuid.uuid4(), name="A")

    with pytest.raises(ClubAlreadyExistsError):
        await ClubService(repository).create_club(ClubCreate(name="A"))


async def test_update_club_rename_to_other_club_name_raises(repository: AsyncMock):
    club = Club(id=uuid.uuid4(), name="A")
    repository.get.return_value = club
    repository.find_by_name.return_value = Club(id=uuid.uuid4(), name="B")

    with pytest.raises(ClubAlreadyExistsError):
        await ClubService(repository).update_club(club.id, ClubUpdate(name="B"))


async def test_get_club_missing_raises(repository: AsyncMock):
    repository.get.return_value = None

    with pytest.raises(ClubNotFoundError):
        await ClubService(repository).get_club(uuid.uuid4())
