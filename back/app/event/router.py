import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.dependencies import PaginationDep, SessionDep
from app.core.schemas import ERROR_RESPONSES
from app.event.models import EventKind
from app.event.repository import EventRepository
from app.event.schemas import EventCreate, EventListResponse, EventResponse, EventUpdate
from app.event.service import EventService
from app.team.router import get_team_service

router = APIRouter(prefix="/events", tags=["Events"], responses=ERROR_RESPONSES)


def get_event_service(session: SessionDep) -> EventService:
    return EventService(EventRepository(session), get_team_service(session))


EventServiceDep = Annotated[EventService, Depends(get_event_service)]


@router.get("", response_model=EventListResponse)
async def list_events(
    team_id: uuid.UUID,
    service: EventServiceDep,
    pagination: PaginationDep,
    kind: EventKind | None = None,
    starts_from: Annotated[datetime | None, Query(alias="from")] = None,
    starts_to: Annotated[datetime | None, Query(alias="to")] = None,
) -> EventListResponse:
    """List a team's events in chronological order, optionally within [from, to)."""
    items, total = await service.list_events(
        team_id, kind, starts_from, starts_to, pagination.skip, pagination.limit
    )
    return EventListResponse.build(items, total, pagination.skip, pagination.limit)


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(event_id: uuid.UUID, service: EventServiceDep) -> EventResponse:
    """Get an event by id."""
    return await service.get_event(event_id)


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(data: EventCreate, service: EventServiceDep) -> EventResponse:
    """Schedule a match, a training session or another team event."""
    return await service.create_event(data)


@router.patch("/{event_id}", response_model=EventResponse)
async def partial_update_event(
    event_id: uuid.UUID, data: EventUpdate, service: EventServiceDep
) -> EventResponse:
    """Partially update an event, including cancelling it."""
    return await service.update_event(event_id, data)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(event_id: uuid.UUID, service: EventServiceDep) -> None:
    """Delete an event and its invitations."""
    await service.delete_event(event_id)
