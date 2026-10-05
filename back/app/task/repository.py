import uuid

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.repository import BaseRepository
from app.task.models import TaskAssignment, TeamTask


class TeamTaskRepository(BaseRepository[TeamTask]):
    model = TeamTask

    async def list_by_team(
        self, team_id: uuid.UUID, skip: int, limit: int
    ) -> tuple[list[TeamTask], int]:
        return await self.list(
            [TeamTask.team_id == team_id], skip, limit, order_by=(TeamTask.name,)
        )

    async def list_names(self, team_id: uuid.UUID) -> set[str]:
        result = await self.session.scalars(
            select(TeamTask.name).where(TeamTask.team_id == team_id)
        )
        return set(result)

    async def add_all(self, tasks: list[TeamTask]) -> None:
        self.session.add_all(tasks)
        await self.session.commit()


class AssignmentRepository(BaseRepository[TaskAssignment]):
    model = TaskAssignment

    async def get(self, entity_id: uuid.UUID) -> TaskAssignment | None:
        query = (
            select(TaskAssignment)
            .where(TaskAssignment.id == entity_id)
            .options(selectinload(TaskAssignment.task), selectinload(TaskAssignment.member))
            .execution_options(populate_existing=True)
        )
        return await self.session.scalar(query)

    async def list_by_event(self, event_id: uuid.UUID) -> list[TaskAssignment]:
        query = (
            select(TaskAssignment)
            .where(TaskAssignment.event_id == event_id)
            .options(selectinload(TaskAssignment.task), selectinload(TaskAssignment.member))
            .order_by(TaskAssignment.created_at)
        )
        return list(await self.session.scalars(query))

    async def exists(self, event_id: uuid.UUID, task_id: uuid.UUID, member_id: uuid.UUID) -> bool:
        query = select(TaskAssignment.id).where(
            TaskAssignment.event_id == event_id,
            TaskAssignment.team_task_id == task_id,
            TaskAssignment.member_id == member_id,
        )
        return await self.session.scalar(query) is not None
