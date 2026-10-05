import uuid

from sqlalchemy import select

from app.core.repository import BaseRepository
from app.member.models import Member, MemberRole


class MemberRepository(BaseRepository[Member]):
    model = Member

    async def list_by_team(
        self, team_id: uuid.UUID, role: MemberRole | None, skip: int, limit: int
    ) -> tuple[list[Member], int]:
        filters = [Member.team_id == team_id]
        if role is not None:
            filters.append(Member.role == role)
        order_by = (Member.role, Member.shirt_number, Member.last_name, Member.first_name)
        return await self.list(filters, skip, limit, order_by=order_by)

    async def find_by_shirt_number(self, team_id: uuid.UUID, shirt_number: int) -> Member | None:
        query = select(Member).where(Member.team_id == team_id, Member.shirt_number == shirt_number)
        return await self.session.scalar(query)

    async def list_ids_by_team(self, team_id: uuid.UUID) -> list[uuid.UUID]:
        rows = await self.session.scalars(select(Member.id).where(Member.team_id == team_id))
        return list(rows)
