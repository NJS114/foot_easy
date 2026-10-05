import uuid

from app.team.exceptions import TeamAlreadyExistsError, TeamNotFoundError
from app.team.models import Team
from app.team.repository import TeamRepository
from app.team.schemas import TeamCreate, TeamUpdate


class TeamService:
    def __init__(self, repository: TeamRepository):
        self.repository = repository

    async def list_teams(self, season: str | None, skip: int, limit: int) -> tuple[list[Team], int]:
        return await self.repository.list_teams(season, skip, limit)

    async def get_team(self, team_id: uuid.UUID) -> Team:
        team = await self.repository.get(team_id)
        if team is None:
            raise TeamNotFoundError(team_id)
        return team

    async def create_team(self, data: TeamCreate) -> Team:
        if await self.repository.find_by_name_and_season(data.name, data.season):
            raise TeamAlreadyExistsError(data.name, data.season)
        return await self.repository.add(Team(**data.model_dump()))

    async def update_team(self, team_id: uuid.UUID, data: TeamUpdate) -> Team:
        team = await self.get_team(team_id)
        changes = data.model_dump(exclude_unset=True)
        name, season = changes.get("name", team.name), changes.get("season", team.season)
        duplicate = await self.repository.find_by_name_and_season(name, season)
        if duplicate is not None and duplicate.id != team.id:
            raise TeamAlreadyExistsError(name, season)
        for field, value in changes.items():
            setattr(team, field, value)
        return await self.repository.save(team)

    async def delete_team(self, team_id: uuid.UUID) -> None:
        team = await self.get_team(team_id)
        await self.repository.delete(team)
