import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.club.models import Club
from app.club.repository import ClubRepository


async def test_find_by_name_exact_match(session: AsyncSession, club: Club):
    repository = ClubRepository(session)

    assert await repository.find_by_name(club.name) == club
    assert await repository.find_by_name("Inconnu") is None


async def test_club_name_unique_enforced_by_db(session: AsyncSession, club: Club):
    with pytest.raises(IntegrityError):
        await ClubRepository(session).add(Club(name=club.name))
