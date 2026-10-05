import uuid

from sqlalchemy import select

from app.core.repository import BaseRepository
from app.team.models import Team


class TeamRepository(BaseRepository[Team]):
    model = Team

    async def find_by_name_and_season(
        self, club_id: uuid.UUID, name: str, season: str
    ) -> Team | None:
        query = select(Team).where(
            Team.club_id == club_id, Team.name == name, Team.season == season
        )
        return await self.session.scalar(query)

    async def list_teams(
        self, club_id: uuid.UUID | None, season: str | None, skip: int, limit: int
    ) -> tuple[list[Team], int]:
        filters = []
        if club_id is not None:
            filters.append(Team.club_id == club_id)
        if season:
            filters.append(Team.season == season)
        return await self.list(filters, skip, limit, order_by=(Team.season.desc(), Team.name))
