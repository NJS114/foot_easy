import uuid
from datetime import date, datetime
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AwareDatetime, BaseModel, Field, StringConstraints, field_validator

from app.core.schemas import OrmModel, PaginatedResponse
from app.event.models import EventKind, Venue

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
Score = Annotated[int, Field(ge=0, le=99)]


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


class EventSeriesCreate(EventCreate):
    """The first occurrence, repeated every `interval_weeks` until `repeat_until` (inclusive)."""

    repeat_until: date
    interval_weeks: Annotated[int, Field(ge=1, le=4)] = 1
    timezone: str = "UTC"

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise ValueError("Unknown IANA timezone") from error
        return value


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
    score_for: Score | None = None
    score_against: Score | None = None


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
    score_for: int | None
    score_against: int | None
    series_id: uuid.UUID | None
    created_at: datetime


EventListResponse = PaginatedResponse[EventResponse]
