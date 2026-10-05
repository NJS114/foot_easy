import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.repository import BaseRepository
from app.invitation.models import Availability, Invitation
from app.member.models import Member


class InvitationRepository(BaseRepository[Invitation]):
    model = Invitation

    async def get(self, entity_id: uuid.UUID) -> Invitation | None:
        query = (
            select(Invitation)
            .where(Invitation.id == entity_id)
            .options(selectinload(Invitation.member))
            .execution_options(populate_existing=True)
        )
        return await self.session.scalar(query)

    async def list_by_event(
        self, event_id: uuid.UUID, availability: Availability | None, skip: int, limit: int
    ) -> tuple[list[Invitation], int]:
        filters = [Invitation.event_id == event_id]
        if availability is not None:
            filters.append(Invitation.availability == availability)
        base = select(Invitation).join(Invitation.member).where(*filters)
        total = await self.session.scalar(select(func.count()).select_from(base.subquery()))
        query = (
            base.options(selectinload(Invitation.member))
            .order_by(Member.role, Member.last_name, Member.first_name)
            .offset(skip)
            .limit(limit)
        )
        return list(await self.session.scalars(query)), total or 0

    async def list_invited_member_ids(self, event_id: uuid.UUID) -> set[uuid.UUID]:
        query = select(Invitation.member_id).where(Invitation.event_id == event_id)
        return set(await self.session.scalars(query))

    async def add_all(self, invitations: list[Invitation]) -> None:
        self.session.add_all(invitations)
        await self.session.commit()

    async def count_by_availability(self, event_id: uuid.UUID) -> dict[Availability, int]:
        query = (
            select(Invitation.availability, func.count())
            .where(Invitation.event_id == event_id)
            .group_by(Invitation.availability)
        )
        return {availability: count for availability, count in await self.session.execute(query)}
