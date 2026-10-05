import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.dependencies import PaginationDep, SessionDep
from app.core.schemas import ERROR_RESPONSES
from app.event.router import get_event_service
from app.invitation.models import Availability
from app.invitation.repository import InvitationRepository
from app.invitation.schemas import (
    AvailabilitySummary,
    InvitationCreate,
    InvitationListResponse,
    InvitationReply,
    InvitationResponse,
)
from app.invitation.service import InvitationService
from app.member.repository import MemberRepository

router = APIRouter(prefix="/invitations", tags=["Invitations"], responses=ERROR_RESPONSES)


def get_invitation_service(session: SessionDep) -> InvitationService:
    return InvitationService(
        InvitationRepository(session), MemberRepository(session), get_event_service(session)
    )


InvitationServiceDep = Annotated[InvitationService, Depends(get_invitation_service)]


@router.get("", response_model=InvitationListResponse)
async def list_invitations(
    event_id: uuid.UUID,
    service: InvitationServiceDep,
    pagination: PaginationDep,
    availability: Availability | None = None,
) -> InvitationListResponse:
    """List an event's invitations with each member's availability."""
    items, total = await service.list_invitations(
        event_id, availability, pagination.skip, pagination.limit
    )
    return InvitationListResponse.build(items, total, pagination.skip, pagination.limit)


@router.get("/summary", response_model=AvailabilitySummary)
async def get_availability_summary(
    event_id: uuid.UUID, service: InvitationServiceDep
) -> AvailabilitySummary:
    """Count an event's invitations per availability."""
    return await service.summarize(event_id)


@router.post("", response_model=list[InvitationResponse], status_code=status.HTTP_201_CREATED)
async def create_invitations(
    data: InvitationCreate, service: InvitationServiceDep
) -> list[InvitationResponse]:
    """Invite members (or the whole roster) to an event; returns only new invitations."""
    return await service.invite_members(data)


@router.patch("/{invitation_id}", response_model=InvitationResponse)
async def partial_update_invitation(
    invitation_id: uuid.UUID, data: InvitationReply, service: InvitationServiceDep
) -> InvitationResponse:
    """Record a member's availability for the event."""
    return await service.reply(invitation_id, data)


@router.delete("/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invitation(invitation_id: uuid.UUID, service: InvitationServiceDep) -> None:
    """Withdraw an invitation."""
    await service.delete_invitation(invitation_id)
