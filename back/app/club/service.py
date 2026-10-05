import uuid

from app.club.exceptions import ClubAlreadyExistsError, ClubNotFoundError
from app.club.models import Club
from app.club.repository import ClubRepository
from app.club.schemas import ClubCreate, ClubUpdate


class ClubService:
    def __init__(self, repository: ClubRepository):
        self.repository = repository

    async def list_clubs(self, skip: int, limit: int) -> tuple[list[Club], int]:
        return await self.repository.list_clubs(skip, limit)

    async def get_club(self, club_id: uuid.UUID) -> Club:
        club = await self.repository.get(club_id)
        if club is None:
            raise ClubNotFoundError(club_id)
        return club

    async def create_club(self, data: ClubCreate) -> Club:
        if await self.repository.find_by_name(data.name):
            raise ClubAlreadyExistsError(data.name)
        return await self.repository.add(Club(**data.model_dump()))

    async def update_club(self, club_id: uuid.UUID, data: ClubUpdate) -> Club:
        club = await self.get_club(club_id)
        changes = data.model_dump(exclude_unset=True)
        duplicate = await self.repository.find_by_name(changes.get("name", club.name))
        if duplicate is not None and duplicate.id != club.id:
            raise ClubAlreadyExistsError(duplicate.name)
        for field, value in changes.items():
            setattr(club, field, value)
        return await self.repository.save(club)

    async def delete_club(self, club_id: uuid.UUID) -> None:
        await self.repository.delete(await self.get_club(club_id))
