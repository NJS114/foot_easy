import uuid
from datetime import datetime

from app.event.exceptions import (
    EventNotFoundError,
    InvalidEventScheduleError,
    MatchDetailsRequiredError,
    ScoreNotAllowedError,
)
from app.event.models import COMPETITIVE_KINDS, Event, EventKind
from app.event.repository import EventRepository
from app.event.schemas import EventCreate, EventUpdate
from app.team.service import TeamService


def check_event_rules(event: Event) -> None:
    """Enforce schedule coherence and the mandatory details of a match."""
    if event.ends_at is not None and event.ends_at <= event.starts_at:
        raise InvalidEventScheduleError("The end must be after the start")
    if event.meeting_at is not None and event.meeting_at > event.starts_at:
        raise InvalidEventScheduleError("The meeting time must be before the start")
    if event.kind == EventKind.MATCH and (not event.opponent or event.venue is None):
        raise MatchDetailsRequiredError()
    has_score = event.score_for is not None or event.score_against is not None
    if has_score and event.kind not in COMPETITIVE_KINDS:
        raise ScoreNotAllowedError()


class EventService:
    def __init__(self, repository: EventRepository, team_service: TeamService):
        self.repository = repository
        self.team_service = team_service

    async def list_events(
        self,
        team_id: uuid.UUID,
        kind: EventKind | None,
        starts_from: datetime | None,
        starts_to: datetime | None,
        skip: int,
        limit: int,
    ) -> tuple[list[Event], int]:
        await self.team_service.get_team(team_id)
        return await self.repository.list_by_team(
            team_id, kind, starts_from, starts_to, skip, limit
        )

    async def get_event(self, event_id: uuid.UUID) -> Event:
        event = await self.repository.get(event_id)
        if event is None:
            raise EventNotFoundError(event_id)
        return event

    async def create_event(self, data: EventCreate) -> Event:
        await self.team_service.get_team(data.team_id)
        event = Event(**data.model_dump(), is_cancelled=False)
        check_event_rules(event)
        return await self.repository.add(event)

    async def update_event(self, event_id: uuid.UUID, data: EventUpdate) -> Event:
        event = await self.get_event(event_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(event, field, value)
        check_event_rules(event)
        return await self.repository.save(event)

    async def delete_event(self, event_id: uuid.UUID) -> None:
        event = await self.get_event(event_id)
        await self.repository.delete(event)
