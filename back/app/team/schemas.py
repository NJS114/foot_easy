import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.core.schemas import OrmModel, PaginatedResponse
from app.team.models import TeamCategory

TeamName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Season = Annotated[str, Field(pattern=r"^\d{4}-\d{4}$", examples=["2026-2027"])]


class TeamCreate(BaseModel):
    name: TeamName
    category: TeamCategory
    season: Season


class TeamUpdate(BaseModel):
    name: TeamName | None = None
    category: TeamCategory | None = None
    season: Season | None = None


class TeamResponse(OrmModel):
    id: uuid.UUID
    name: str
    category: TeamCategory
    season: str
    created_at: datetime


TeamListResponse = PaginatedResponse[TeamResponse]
