import uuid
from typing import Annotated

from pydantic import BaseModel, StringConstraints

from app.core.schemas import OrmModel, PaginatedResponse
from app.invitation.schemas import InvitedMember
from app.task.models import TaskIcon

TaskName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class TeamTaskCreate(BaseModel):
    team_id: uuid.UUID
    name: TaskName
    icon: TaskIcon = TaskIcon.OTHER


class TeamTaskResponse(OrmModel):
    id: uuid.UUID
    team_id: uuid.UUID
    name: str
    icon: TaskIcon


class DefaultTasksRequest(BaseModel):
    team_id: uuid.UUID


class DefaultTasksResult(BaseModel):
    added: int


class AssignmentCreate(BaseModel):
    event_id: uuid.UUID
    team_task_id: uuid.UUID
    member_id: uuid.UUID


class AssignmentResponse(OrmModel):
    id: uuid.UUID
    event_id: uuid.UUID
    task: TeamTaskResponse
    member: InvitedMember


TeamTaskListResponse = PaginatedResponse[TeamTaskResponse]
AssignmentListResponse = PaginatedResponse[AssignmentResponse]
