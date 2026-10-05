import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.club.repository import ClubRepository
from app.club.schemas import ClubCreate, ClubListResponse, ClubResponse, ClubUpdate
from app.club.service import ClubService
from app.core.dependencies import PaginationDep, SessionDep
from app.core.schemas import ERROR_RESPONSES

router = APIRouter(prefix="/clubs", tags=["Clubs"], responses=ERROR_RESPONSES)


def get_club_service(session: SessionDep) -> ClubService:
    return ClubService(ClubRepository(session))


ClubServiceDep = Annotated[ClubService, Depends(get_club_service)]


@router.get("", response_model=ClubListResponse)
async def list_clubs(service: ClubServiceDep, pagination: PaginationDep) -> ClubListResponse:
    """List clubs."""
    items, total = await service.list_clubs(pagination.skip, pagination.limit)
    return ClubListResponse.build(items, total, pagination.skip, pagination.limit)


@router.get("/{club_id}", response_model=ClubResponse)
async def get_club(club_id: uuid.UUID, service: ClubServiceDep) -> ClubResponse:
    """Get a club by id."""
    return await service.get_club(club_id)


@router.post("", response_model=ClubResponse, status_code=status.HTTP_201_CREATED)
async def create_club(data: ClubCreate, service: ClubServiceDep) -> ClubResponse:
    """Register a club; club names are unique."""
    return await service.create_club(data)


@router.patch("/{club_id}", response_model=ClubResponse)
async def partial_update_club(
    club_id: uuid.UUID, data: ClubUpdate, service: ClubServiceDep
) -> ClubResponse:
    """Partially update a club."""
    return await service.update_club(club_id, data)


@router.delete("/{club_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_club(club_id: uuid.UUID, service: ClubServiceDep) -> None:
    """Delete a club with all its teams and their data."""
    await service.delete_club(club_id)
