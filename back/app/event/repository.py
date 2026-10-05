import uuid
from datetime import datetime

from app.core.repository import BaseRepository
from app.event.models import Event, EventKind


class EventRepository(BaseRepository[Event]):
    model = Event

    async def list_by_team(
        self,
        team_id: uuid.UUID,
        kind: EventKind | None,
        starts_from: datetime | None,
        starts_to: datetime | None,
        skip: int,
        limit: int,
    ) -> tuple[list[Event], int]:
        filters = [Event.team_id == team_id]
        if kind is not None:
            filters.append(Event.kind == kind)
        if starts_from is not None:
            filters.append(Event.starts_at >= starts_from)
        if starts_to is not None:
            filters.append(Event.starts_at < starts_to)
        return await self.list(filters, skip, limit, order_by=(Event.starts_at,))

    async def add_all(self, events: list[Event]) -> None:
        self.session.add_all(events)
        await self.session.commit()
