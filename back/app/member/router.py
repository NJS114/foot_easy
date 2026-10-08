import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import Response

from app.club.router import get_club_service
from app.core.dependencies import PaginationDep, SessionDep
from app.core.exceptions import BusinessRuleError
from app.core.schemas import ERROR_RESPONSES
from app.member.repository import MemberRepository
from app.member.schemas import (
    ImportReport,
    MemberCreate,
    MemberListResponse,
    MemberQuery,
    MemberResponse,
    MemberUpdate,
)
from app.member.service import MemberService
from app.team.router import get_team_service

router = APIRouter(prefix="/members", tags=["Members"], responses=ERROR_RESPONSES)

MAX_IMPORT_BYTES = 2 * 1024 * 1024


def get_member_service(session: SessionDep) -> MemberService:
    return MemberService(
        MemberRepository(session), get_team_service(session), get_club_service(session)
    )


MemberServiceDep = Annotated[MemberService, Depends(get_member_service)]
MemberQueryDep = Annotated[MemberQuery, Depends(MemberQuery)]


@router.get("", response_model=MemberListResponse)
async def list_members(
    query: MemberQueryDep, service: MemberServiceDep, pagination: PaginationDep
) -> MemberListResponse:
    """List a team roster or the club directory, with role filter, search and sort."""
    items, total = await service.list_members(query, pagination.skip, pagination.limit)
    return MemberListResponse.build(items, total, pagination.skip, pagination.limit)


@router.get("/export", response_class=Response, responses={200: {"content": {"text/csv": {}}}})
async def export_members(query: MemberQueryDep, service: MemberServiceDep) -> Response:
    """Export the filtered members as a CSV file readable by Excel."""
    content = await service.export_members(query)
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="membres.csv"'},
    )


@router.post("/import", response_model=ImportReport, status_code=status.HTTP_201_CREATED)
async def import_members(
    team_id: Annotated[uuid.UUID, Query()],
    file: Annotated[UploadFile, File(description="CSV (; or ,) or XLSX roster")],
    service: MemberServiceDep,
) -> ImportReport:
    """Import a roster file into a team; nothing is created if any row is invalid."""
    content = await file.read(MAX_IMPORT_BYTES + 1)
    if len(content) > MAX_IMPORT_BYTES:
        raise BusinessRuleError("file_too_large", "The file must not exceed 2 MB")
    return await service.import_members(team_id, file.filename or "", content)


@router.get("/{member_id}", response_model=MemberResponse)
async def get_member(member_id: uuid.UUID, service: MemberServiceDep) -> MemberResponse:
    """Get a member by id."""
    return await service.get_member(member_id)


@router.post("", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def create_member(data: MemberCreate, service: MemberServiceDep) -> MemberResponse:
    """Add a member to a team or group; shirt numbers are unique within a team."""
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
