import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.dependencies import SessionDep
from app.core.schemas import ERROR_RESPONSES
from app.stats.repository import StatsRepository
from app.stats.schemas import AttendanceReport, TaskReport, TeamStats
from app.stats.service import StatsService
from app.team.router import get_team_service

router = APIRouter(prefix="/stats", tags=["Stats"], responses=ERROR_RESPONSES)


def get_stats_service(session: SessionDep) -> StatsService:
    return StatsService(StatsRepository(session), get_team_service(session))


StatsServiceDep = Annotated[StatsService, Depends(get_stats_service)]


@router.get("/teams/{team_id}", response_model=TeamStats)
async def get_team_stats(team_id: uuid.UUID, service: StatsServiceDep) -> TeamStats:
    return await service.get_team_stats(team_id)


@router.get("/teams/{team_id}/attendance", response_model=AttendanceReport)
async def get_attendance_report(
    team_id: uuid.UUID,
    service: StatsServiceDep,
    until: datetime | None = None,
) -> AttendanceReport:
    return await service.get_attendance_report(team_id, until)


@router.get("/teams/{team_id}/tasks", response_model=TaskReport)
async def get_task_report(team_id: uuid.UUID, service: StatsServiceDep) -> TaskReport:
    return await service.get_task_report(team_id)
