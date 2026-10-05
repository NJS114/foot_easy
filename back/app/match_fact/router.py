import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.dependencies import PaginationDep, SessionDep
from app.core.schemas import ERROR_RESPONSES
from app.event.router import get_event_service
from app.match_fact.repository import MatchFactRepository
from app.match_fact.schemas import MatchFactCreate, MatchFactListResponse, MatchFactResponse
from app.match_fact.service import MatchFactService
from app.member.repository import MemberRepository

router = APIRouter(prefix="/match-facts", tags=["Match facts"], responses=ERROR_RESPONSES)


def get_match_fact_service(session: SessionDep) -> MatchFactService:
    return MatchFactService(
        MatchFactRepository(session), MemberRepository(session), get_event_service(session)
    )


MatchFactServiceDep = Annotated[MatchFactService, Depends(get_match_fact_service)]


@router.get("", response_model=MatchFactListResponse)
async def list_match_facts(
    event_id: uuid.UUID, service: MatchFactServiceDep, pagination: PaginationDep
) -> MatchFactListResponse:
    """List a match's goals and cards in chronological order."""
    items, total = await service.list_facts(event_id, pagination.skip, pagination.limit)
    return MatchFactListResponse.build(items, total, pagination.skip, pagination.limit)


@router.post("", response_model=MatchFactResponse, status_code=status.HTTP_201_CREATED)
async def create_match_fact(
    data: MatchFactCreate, service: MatchFactServiceDep
) -> MatchFactResponse:
    """Record a goal (with optional assist) or a card for one of the team's players."""
    return await service.create_fact(data)


@router.delete("/{fact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_match_fact(fact_id: uuid.UUID, service: MatchFactServiceDep) -> None:
    """Delete a match fact."""
    await service.delete_fact(fact_id)
