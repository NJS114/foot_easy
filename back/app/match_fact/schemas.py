import uuid
from typing import Annotated

from pydantic import BaseModel, Field

from app.core.schemas import OrmModel, PaginatedResponse
from app.invitation.schemas import InvitedMember
from app.match_fact.models import FactKind


class MatchFactCreate(BaseModel):
    event_id: uuid.UUID
    kind: FactKind
    member_id: uuid.UUID
    assist_member_id: uuid.UUID | None = None
    minute: Annotated[int | None, Field(ge=0, le=130)] = None


class MatchFactResponse(OrmModel):
    id: uuid.UUID
    event_id: uuid.UUID
    kind: FactKind
    minute: int | None
    member: InvitedMember
    assist_member: InvitedMember | None


MatchFactListResponse = PaginatedResponse[MatchFactResponse]
