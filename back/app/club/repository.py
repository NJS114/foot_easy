from sqlalchemy import select

from app.club.models import Club
from app.core.repository import BaseRepository


class ClubRepository(BaseRepository[Club]):
    model = Club

    async def find_by_name(self, name: str) -> Club | None:
        return await self.session.scalar(select(Club).where(Club.name == name))

    async def list_clubs(self, skip: int, limit: int) -> tuple[list[Club], int]:
        return await self.list([], skip, limit, order_by=(Club.name,))
