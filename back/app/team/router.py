import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.club.router import get_club_service
from app.core.dependencies import PaginationDep, SessionDep
from app.core.schemas import ERROR_RESPONSES
from app.team.repository import TeamRepository
from app.team.schemas import TeamCreate, TeamListResponse, TeamResponse, TeamUpdate
from app.team.service import TeamService

router = APIRouter(prefix="/teams", tags=["Teams"], responses=ERROR_RESPONSES)


def get_team_service(session: SessionDep) -> TeamService:
    return TeamService(TeamRepository(session), get_club_service(session))


TeamServiceDep = Annotated[TeamService, Depends(get_team_service)]


@router.get("", response_model=TeamListResponse)
async def list_teams(
    service: TeamServiceDep,
    pagination: PaginationDep,
    club_id: uuid.UUID | None = None,
    season: Annotated[str | None, Query(pattern=r"^\d{4}-\d{4}$")] = None,
) -> TeamListResponse:
    """List teams, optionally filtered by club and season."""
    items, total = await service.list_teams(club_id, season, pagination.skip, pagination.limit)
    return TeamListResponse.build(items, total, pagination.skip, pagination.limit)


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(team_id: uuid.UUID, service: TeamServiceDep) -> TeamResponse:
    """Get a team by id."""
    return await service.get_team(team_id)


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(data: TeamCreate, service: TeamServiceDep) -> TeamResponse:
    """Create a club team; the name must be unique within the club and season."""
    return await service.create_team(data)


@router.patch("/{team_id}", response_model=TeamResponse)
async def partial_update_team(
    team_id: uuid.UUID, data: TeamUpdate, service: TeamServiceDep
) -> TeamResponse:
    """Partially update a team."""
    return await service.update_team(team_id, data)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(team_id: uuid.UUID, service: TeamServiceDep) -> None:
    """Delete a team with its members, events and invitations."""
    await service.delete_team(team_id)
