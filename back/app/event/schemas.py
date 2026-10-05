import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, StringConstraints

from app.core.schemas import OrmModel, PaginatedResponse
from app.event.models import EventKind, Venue

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]


class EventCreate(BaseModel):
    team_id: uuid.UUID
    kind: EventKind
    title: Title
    starts_at: AwareDatetime
    ends_at: AwareDatetime | None = None
    meeting_at: AwareDatetime | None = None
    location: ShortText | None = None
    opponent: ShortText | None = None
    venue: Venue | None = None
    notes: str | None = None


class EventUpdate(BaseModel):
    title: Title | None = None
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    meeting_at: AwareDatetime | None = None
    location: ShortText | None = None
    opponent: ShortText | None = None
    venue: Venue | None = None
    notes: str | None = None
    is_cancelled: bool | None = None


class EventResponse(OrmModel):
    id: uuid.UUID
    team_id: uuid.UUID
    kind: EventKind
    title: str
    starts_at: datetime
    ends_at: datetime | None
    meeting_at: datetime | None
    location: str | None
    opponent: str | None
    venue: Venue | None
    notes: str | None
    is_cancelled: bool
    created_at: datetime


EventListResponse = PaginatedResponse[EventResponse]
