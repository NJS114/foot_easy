import uuid

from app.event.service import EventService
from app.member.service import MemberService
from app.task.exceptions import (
    AlreadyAssignedError,
    AssignmentNotFoundError,
    OutsideTeamError,
    TeamTaskAlreadyExistsError,
    TeamTaskNotFoundError,
)
from app.task.models import TaskAssignment, TaskIcon, TeamTask
from app.task.repository import AssignmentRepository, TeamTaskRepository
from app.task.schemas import AssignmentCreate, TeamTaskCreate
from app.team.service import TeamService

DEFAULT_TASKS: tuple[tuple[str, TaskIcon], ...] = (
    ("Laver les chasubles", TaskIcon.LAUNDRY),
    ("Apporter les ballons", TaskIcon.BALL),
    ("Apporter l'eau", TaskIcon.WATER),
    ("Covoiturage", TaskIcon.CAR),
    ("Arbitre de touche", TaskIcon.FLAG),
    ("Clé du vestiaire", TaskIcon.KEY),
    ("Apporter les maillots", TaskIcon.SHIRT),
    ("Goûter d'après-match", TaskIcon.FOOD),
    ("Trousse de pharmacie", TaskIcon.MEDKIT),
)


class TaskService:
    def __init__(
        self,
        tasks: TeamTaskRepository,
        assignments: AssignmentRepository,
        team_service: TeamService,
        event_service: EventService,
        member_service: MemberService,
    ):
        self.tasks = tasks
        self.assignments = assignments
        self.team_service = team_service
        self.event_service = event_service
        self.member_service = member_service

    async def list_tasks(
        self, team_id: uuid.UUID, skip: int, limit: int
    ) -> tuple[list[TeamTask], int]:
        await self.team_service.get_team(team_id)
        return await self.tasks.list_by_team(team_id, skip, limit)

    async def create_task(self, data: TeamTaskCreate) -> TeamTask:
        await self.team_service.get_team(data.team_id)
        if data.name in await self.tasks.list_names(data.team_id):
            raise TeamTaskAlreadyExistsError(data.name)
        return await self.tasks.add(TeamTask(**data.model_dump()))

    async def add_default_tasks(self, team_id: uuid.UUID) -> int:
        """Add the usual football chores the team does not have yet; returns how many."""
        await self.team_service.get_team(team_id)
        existing = await self.tasks.list_names(team_id)
        missing = [
            TeamTask(team_id=team_id, name=name, icon=icon)
            for name, icon in DEFAULT_TASKS
            if name not in existing
        ]
        await self.tasks.add_all(missing)
        return len(missing)

    async def delete_task(self, task_id: uuid.UUID) -> None:
        task = await self.tasks.get(task_id)
        if task is None:
            raise TeamTaskNotFoundError(task_id)
        await self.tasks.delete(task)

    async def list_assignments(self, event_id: uuid.UUID) -> list[TaskAssignment]:
        await self.event_service.get_event(event_id)
        return await self.assignments.list_by_event(event_id)

    async def assign(self, data: AssignmentCreate) -> TaskAssignment:
        event = await self.event_service.get_event(data.event_id)
        task = await self.tasks.get(data.team_task_id)
        if task is None:
            raise TeamTaskNotFoundError(data.team_task_id)
        member = await self.member_service.get_member(data.member_id)
        if task.team_id != event.team_id:
            raise OutsideTeamError("task")
        if member.team_id != event.team_id:
            raise OutsideTeamError("member")
        if await self.assignments.exists(event.id, task.id, member.id):
            raise AlreadyAssignedError()
        assignment = await self.assignments.add(TaskAssignment(**data.model_dump()))
        return await self.assignments.get(assignment.id)

    async def unassign(self, assignment_id: uuid.UUID) -> None:
        assignment = await self.assignments.get(assignment_id)
        if assignment is None:
            raise AssignmentNotFoundError(assignment_id)
        await self.assignments.delete(assignment)
