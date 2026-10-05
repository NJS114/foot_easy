import uuid

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.repository import BaseRepository
from app.invitation.models import Availability, Invitation
from app.lineup.models import Lineup, LineupSlot


class LineupRepository(BaseRepository[Lineup]):
    model = Lineup

    async def get_by_event(self, event_id: uuid.UUID) -> Lineup | None:
        query = (
            select(Lineup)
            .where(Lineup.event_id == event_id)
            .options(selectinload(Lineup.slots).selectinload(LineupSlot.member))
            .execution_options(populate_existing=True)
        )
        return await self.session.scalar(query)

    async def replace_slots(self, lineup: Lineup, slots: list[LineupSlot]) -> None:
        # Old rows must be deleted before inserting new ones, or the per-member unique
        # constraint fails when a player keeps their place in the new lineup.
        lineup.slots.clear()
        await self.session.flush()
        lineup.slots.extend(slots)

    async def list_available_member_ids(self, event_id: uuid.UUID) -> set[uuid.UUID]:
        query = select(Invitation.member_id).where(
            Invitation.event_id == event_id, Invitation.availability == Availability.AVAILABLE
        )
        return set(await self.session.scalars(query))
