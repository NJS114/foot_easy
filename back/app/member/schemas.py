import enum
import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, StringConstraints

from app.core.schemas import OrmModel, PaginatedResponse
from app.member.models import JerseySize, MemberRole, PlayerPosition

PersonName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
ShirtNumber = Annotated[int, Field(ge=1, le=99)]
Phone = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[+0-9 .()-]{6,30}$")]
LicenseNumber = Annotated[str, StringConstraints(strip_whitespace=True, max_length=30)]


class MemberFields(BaseModel):
    email: EmailStr | None = None
    phone: Phone | None = None
    birth_date: date | None = None
    license_number: LicenseNumber | None = None
    jersey_size: JerseySize | None = None
    position: PlayerPosition | None = None
    shirt_number: ShirtNumber | None = None


class MemberCreate(MemberFields):
    team_id: uuid.UUID
    first_name: PersonName
    last_name: PersonName
    role: MemberRole = MemberRole.PLAYER


class MemberUpdate(MemberFields):
    first_name: PersonName | None = None
    last_name: PersonName | None = None
    role: MemberRole | None = None


class MemberResponse(OrmModel):
    id: uuid.UUID
    team_id: uuid.UUID
    first_name: str
    last_name: str
    email: str | None
    phone: str | None
    birth_date: date | None
    license_number: str | None
    jersey_size: JerseySize | None
    role: MemberRole
    position: PlayerPosition | None
    shirt_number: int | None
    created_at: datetime


class MemberSort(enum.StrEnum):
    LAST_NAME = "last_name"
    FIRST_NAME = "first_name"
    ROLE = "role"
    SHIRT_NUMBER = "shirt_number"


class MemberQuery(BaseModel):
    """Directory filters: a team roster or the whole club."""

    team_id: uuid.UUID | None = None
    club_id: uuid.UUID | None = None
    role: MemberRole | None = None
    search: str | None = None
    sort: MemberSort = MemberSort.ROLE


class ImportReport(BaseModel):
    imported: int
    skipped: int


MemberListResponse = PaginatedResponse[MemberResponse]
