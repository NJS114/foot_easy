import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.core.schemas import OrmModel, PaginatedResponse
from app.invitation.models import Availability
from app.member.models import MemberRole, PlayerPosition


class InvitationCreate(BaseModel):
    event_id: uuid.UUID
    member_ids: Annotated[
        list[uuid.UUID] | None,
        Field(description="Members to invite; the whole roster when omitted", max_length=100),
    ] = None


class ReminderRequest(BaseModel):
    event_id: uuid.UUID


class ReminderResult(BaseModel):
    event_id: uuid.UUID
    reminded: int


class InvitationReply(BaseModel):
    availability: Literal[Availability.AVAILABLE, Availability.UNCERTAIN, Availability.UNAVAILABLE]
    comment: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = None


class InvitedMember(OrmModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    role: MemberRole
    position: PlayerPosition | None
    shirt_number: int | None


class InvitationResponse(OrmModel):
    id: uuid.UUID
    event_id: uuid.UUID
    availability: Availability
    comment: str | None
    responded_at: datetime | None
    reminder_count: int
    last_reminded_at: datetime | None
    member: InvitedMember


class AvailabilitySummary(BaseModel):
    event_id: uuid.UUID
    invited: int
    pending: int
    available: int
    uncertain: int
    unavailable: int


InvitationListResponse = PaginatedResponse[InvitationResponse]
