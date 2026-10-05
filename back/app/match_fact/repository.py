import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.orm import selectinload

from app.core.repository import BaseRepository
from app.match_fact.models import FactKind, MatchFact


def with_members() -> Select[tuple[MatchFact]]:
    return select(MatchFact).options(
        selectinload(MatchFact.member), selectinload(MatchFact.assist_member)
    )


class MatchFactRepository(BaseRepository[MatchFact]):
    model = MatchFact

    async def get(self, entity_id: uuid.UUID) -> MatchFact | None:
        query = with_members().where(MatchFact.id == entity_id)
        return await self.session.scalar(query.execution_options(populate_existing=True))

    async def list_by_event(
        self, event_id: uuid.UUID, skip: int, limit: int
    ) -> tuple[list[MatchFact], int]:
        filters = [MatchFact.event_id == event_id]
        total = await self.session.scalar(
            select(func.count()).select_from(MatchFact).where(*filters)
        )
        query = (
            with_members()
            .where(*filters)
            .order_by(MatchFact.minute.is_(None), MatchFact.minute, MatchFact.created_at)
            .offset(skip)
            .limit(limit)
        )
        return list(await self.session.scalars(query)), total or 0

    async def count_goals(self, event_id: uuid.UUID) -> int:
        query = select(func.count()).where(
            MatchFact.event_id == event_id, MatchFact.kind == FactKind.GOAL
        )
        return await self.session.scalar(query) or 0
