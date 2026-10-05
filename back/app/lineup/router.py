import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.dependencies import SessionDep
from app.core.schemas import ERROR_RESPONSES
from app.event.router import get_event_service
from app.lineup.repository import LineupRepository
from app.lineup.schemas import FormationResponse, LineupResponse, LineupWrite
from app.lineup.service import LineupService
from app.member.repository import MemberRepository

router = APIRouter(prefix="/lineups", tags=["Lineups"], responses=ERROR_RESPONSES)


def get_lineup_service(session: SessionDep) -> LineupService:
    return LineupService(
        LineupRepository(session), MemberRepository(session), get_event_service(session)
    )


LineupServiceDep = Annotated[LineupService, Depends(get_lineup_service)]


@router.get("/formations", response_model=list[FormationResponse])
async def list_formations(service: LineupServiceDep) -> list[FormationResponse]:
    """List the supported tactical formations (11, 8 and 5-a-side)."""
    return [
        FormationResponse(code=f.code, players=f.players, lines=list(f.lines))
        for f in service.list_formations()
    ]


@router.get("/{event_id}", response_model=LineupResponse)
async def get_lineup(event_id: uuid.UUID, service: LineupServiceDep) -> LineupResponse:
    """Get an event's lineup, flagging selected members who are not available."""
    return await service.get_lineup(event_id)


@router.put("/{event_id}", response_model=LineupResponse)
async def update_lineup(
    event_id: uuid.UUID, data: LineupWrite, service: LineupServiceDep
) -> LineupResponse:
    """Create or fully replace an event's lineup (formation, starters, substitutes)."""
    return await service.save_lineup(event_id, data)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lineup(event_id: uuid.UUID, service: LineupServiceDep) -> None:
    """Delete an event's lineup."""
    await service.delete_lineup(event_id)
