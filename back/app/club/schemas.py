import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.core.schemas import OrmModel, PaginatedResponse

ClubName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
City = Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)]
HexColor = Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$", examples=["#16a34a"])]


class ClubCreate(BaseModel):
    name: ClubName
    city: City | None = None
    primary_color: HexColor = "#16a34a"


class ClubUpdate(BaseModel):
    name: ClubName | None = None
    city: City | None = None
    primary_color: HexColor | None = None


class ClubResponse(OrmModel):
    id: uuid.UUID
    name: str
    city: str | None
    primary_color: str
    created_at: datetime


ClubListResponse = PaginatedResponse[ClubResponse]
