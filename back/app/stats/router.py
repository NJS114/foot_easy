import uuid
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.dependencies import SessionDep
from app.core.schemas import ERROR_RESPONSES
from app.stats.repository import StatsRepository
from app.stats.schemas import TeamStats
from app.stats.service import StatsService
from app.team.router import get_team_service

router = APIRouter(prefix="/stats", tags=["Stats"], responses=ERROR_RESPONSES)


def get_stats_service(session: SessionDep) -> StatsService:
    return StatsService(StatsRepository(session), get_team_service(session))


StatsServiceDep = Annotated[StatsService, Depends(get_stats_service)]


@router.get("/teams/{team_id}", response_model=TeamStats)
async def get_team_stats(team_id: uuid.UUID, service: StatsServiceDep) -> TeamStats:
    """Season record of a team and its players: goals, assists, cards, selections, attendance."""
    return await service.get_team_stats(team_id)
