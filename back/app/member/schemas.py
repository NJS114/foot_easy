import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, StringConstraints

from app.core.schemas import OrmModel, PaginatedResponse
from app.member.models import MemberRole, PlayerPosition

PersonName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
ShirtNumber = Annotated[int, Field(ge=1, le=99)]


class MemberCreate(BaseModel):
    team_id: uuid.UUID
    first_name: PersonName
    last_name: PersonName
    email: EmailStr | None = None
    role: MemberRole = MemberRole.PLAYER
    position: PlayerPosition | None = None
    shirt_number: ShirtNumber | None = None


class MemberUpdate(BaseModel):
    first_name: PersonName | None = None
    last_name: PersonName | None = None
    email: EmailStr | None = None
    role: MemberRole | None = None
    position: PlayerPosition | None = None
    shirt_number: ShirtNumber | None = None


class MemberResponse(OrmModel):
    id: uuid.UUID
    team_id: uuid.UUID
    first_name: str
    last_name: str
    email: str | None
    role: MemberRole
    position: PlayerPosition | None
    shirt_number: int | None
    created_at: datetime


MemberListResponse = PaginatedResponse[MemberResponse]
