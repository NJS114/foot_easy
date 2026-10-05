from sqlalchemy import select

from app.core.repository import BaseRepository
from app.team.models import Team


class TeamRepository(BaseRepository[Team]):
    model = Team

    async def find_by_name_and_season(self, name: str, season: str) -> Team | None:
        query = select(Team).where(Team.name == name, Team.season == season)
        return await self.session.scalar(query)

    async def list_teams(self, season: str | None, skip: int, limit: int) -> tuple[list[Team], int]:
        filters = [Team.season == season] if season else []
        return await self.list(filters, skip, limit, order_by=(Team.season.desc(), Team.name))
