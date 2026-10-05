import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.dependencies import PaginationDep, SessionDep
from app.core.schemas import ERROR_RESPONSES
from app.event.router import get_event_service
from app.member.router import get_member_service
from app.task.repository import AssignmentRepository, TeamTaskRepository
from app.task.schemas import (
    AssignmentCreate,
    AssignmentResponse,
    DefaultTasksRequest,
    DefaultTasksResult,
    TeamTaskCreate,
    TeamTaskListResponse,
    TeamTaskResponse,
)
from app.task.service import TaskService
from app.team.router import get_team_service

router = APIRouter(prefix="/tasks", tags=["Tasks"], responses=ERROR_RESPONSES)


def get_task_service(session: SessionDep) -> TaskService:
    return TaskService(
        TeamTaskRepository(session),
        AssignmentRepository(session),
        get_team_service(session),
        get_event_service(session),
        get_member_service(session),
    )


TaskServiceDep = Annotated[TaskService, Depends(get_task_service)]


@router.get("", response_model=TeamTaskListResponse)
async def list_tasks(
    team_id: uuid.UUID, service: TaskServiceDep, pagination: PaginationDep
) -> TeamTaskListResponse:
    """List the team's task catalog."""
    items, total = await service.list_tasks(team_id, pagination.skip, pagination.limit)
    return TeamTaskListResponse.build(items, total, pagination.skip, pagination.limit)


@router.post("", response_model=TeamTaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(data: TeamTaskCreate, service: TaskServiceDep) -> TeamTaskResponse:
    """Add a custom task to the team's catalog."""
    return await service.create_task(data)


@router.post("/defaults", response_model=DefaultTasksResult)
async def add_default_tasks(
    data: DefaultTasksRequest, service: TaskServiceDep
) -> DefaultTasksResult:
    """Add the usual football chores missing from the catalog (idempotent)."""
    return DefaultTasksResult(added=await service.add_default_tasks(data.team_id))


@router.get("/assignments", response_model=list[AssignmentResponse])
async def list_assignments(
    event_id: uuid.UUID, service: TaskServiceDep
) -> list[AssignmentResponse]:
    """List who does what for an event."""
    return await service.list_assignments(event_id)


@router.post("/assignments", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(data: AssignmentCreate, service: TaskServiceDep) -> AssignmentResponse:
    """Assign a task to a team member for an event."""
    return await service.assign(data)


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assignment(assignment_id: uuid.UUID, service: TaskServiceDep) -> None:
    """Remove an assignment."""
    await service.unassign(assignment_id)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: uuid.UUID, service: TaskServiceDep) -> None:
    """Remove a task from the catalog with its assignments."""
    await service.delete_task(task_id)
