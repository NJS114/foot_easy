import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from app.core.schemas import OrmModel
from app.invitation.schemas import InvitedMember
from app.lineup.models import SlotRole


class FormationResponse(BaseModel):
    code: str
    players: int
    lines: list[int]


class SlotInput(BaseModel):
    member_id: uuid.UUID
    role: SlotRole
    position_index: Annotated[
        int | None, Field(ge=0, description="Starter position; null on the bench")
    ] = None


class LineupWrite(BaseModel):
    formation: str = Field(examples=["4-4-2"])
    is_published: bool = False
    slots: Annotated[list[SlotInput], Field(max_length=30)]


class SlotResponse(OrmModel):
    role: SlotRole
    position_index: int | None
    member: InvitedMember


class LineupResponse(OrmModel):
    id: uuid.UUID
    event_id: uuid.UUID
    formation: str
    is_published: bool
    slots: list[SlotResponse]
    updated_at: datetime
    unavailable_member_ids: list[uuid.UUID] = Field(
        default=[], description="Selected members who did not answer 'available'"
    )
