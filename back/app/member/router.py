import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.dependencies import PaginationDep, SessionDep
from app.core.schemas import ERROR_RESPONSES
from app.member.models import MemberRole
from app.member.repository import MemberRepository
from app.member.schemas import MemberCreate, MemberListResponse, MemberResponse, MemberUpdate
from app.member.service import MemberService
from app.team.router import get_team_service

router = APIRouter(prefix="/members", tags=["Members"], responses=ERROR_RESPONSES)


def get_member_service(session: SessionDep) -> MemberService:
    return MemberService(MemberRepository(session), get_team_service(session))


MemberServiceDep = Annotated[MemberService, Depends(get_member_service)]


@router.get("", response_model=MemberListResponse)
async def list_members(
    team_id: uuid.UUID,
    service: MemberServiceDep,
    pagination: PaginationDep,
    role: MemberRole | None = None,
) -> MemberListResponse:
    """List a team's roster, optionally filtered by role."""
    items, total = await service.list_members(team_id, role, pagination.skip, pagination.limit)
    return MemberListResponse.build(items, total, pagination.skip, pagination.limit)


@router.get("/{member_id}", response_model=MemberResponse)
async def get_member(member_id: uuid.UUID, service: MemberServiceDep) -> MemberResponse:
    """Get a member by id."""
    return await service.get_member(member_id)


@router.post("", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def create_member(data: MemberCreate, service: MemberServiceDep) -> MemberResponse:
    """Add a member to a team; shirt numbers are unique within a team."""
    return await service.create_member(data)


@router.patch("/{member_id}", response_model=MemberResponse)
async def partial_update_member(
    member_id: uuid.UUID, data: MemberUpdate, service: MemberServiceDep
) -> MemberResponse:
    """Partially update a member."""
    return await service.update_member(member_id, data)


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_member(member_id: uuid.UUID, service: MemberServiceDep) -> None:
    """Remove a member from the team."""
    await service.delete_member(member_id)
