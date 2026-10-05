import uuid

from sqlalchemy import ColumnElement, func, or_, select

from app.core.repository import BaseRepository
from app.member.models import Member, MemberRole
from app.member.schemas import MemberQuery, MemberSort
from app.team.models import Team

SORT_COLUMNS = {
    MemberSort.LAST_NAME: (Member.last_name, Member.first_name),
    MemberSort.FIRST_NAME: (Member.first_name, Member.last_name),
    MemberSort.ROLE: (Member.role, Member.shirt_number, Member.last_name, Member.first_name),
    MemberSort.SHIRT_NUMBER: (Member.shirt_number, Member.last_name),
}


def query_filters(query: MemberQuery) -> list[ColumnElement[bool]]:
    filters: list[ColumnElement[bool]] = []
    if query.team_id is not None:
        filters.append(Member.team_id == query.team_id)
    if query.club_id is not None:
        club_teams = select(Team.id).where(Team.club_id == query.club_id)
        filters.append(Member.team_id.in_(club_teams))
    if query.role is not None:
        filters.append(Member.role == query.role)
    if query.search:
        pattern = f"%{query.search.strip().lower()}%"
        filters.append(
            or_(
                func.lower(Member.last_name).like(pattern),
                func.lower(Member.first_name).like(pattern),
                func.lower(Member.email).like(pattern),
            )
        )
    return filters


class MemberRepository(BaseRepository[Member]):
    model = Member

    async def list_by_team(
        self, team_id: uuid.UUID, role: MemberRole | None, skip: int, limit: int
    ) -> tuple[list[Member], int]:
        return await self.search(MemberQuery(team_id=team_id, role=role), skip, limit)

    async def search(self, query: MemberQuery, skip: int, limit: int) -> tuple[list[Member], int]:
        return await self.list(query_filters(query), skip, limit, order_by=SORT_COLUMNS[query.sort])

    async def list_with_team_names(self, query: MemberQuery) -> list[tuple[Member, str]]:
        statement = (
            select(Member, Team.name)
            .join(Team, Team.id == Member.team_id)
            .where(*query_filters(query))
            .order_by(Team.name, *SORT_COLUMNS[query.sort])
        )
        return [(member, team_name) for member, team_name in await self.session.execute(statement)]

    async def find_by_shirt_number(self, team_id: uuid.UUID, shirt_number: int) -> Member | None:
        query = select(Member).where(Member.team_id == team_id, Member.shirt_number == shirt_number)
        return await self.session.scalar(query)

    async def list_ids_by_team(self, team_id: uuid.UUID) -> list[uuid.UUID]:
        rows = await self.session.scalars(select(Member.id).where(Member.team_id == team_id))
        return list(rows)

    async def list_player_ids_by_team(self, team_id: uuid.UUID) -> set[uuid.UUID]:
        query = select(Member.id).where(Member.team_id == team_id, Member.role == MemberRole.PLAYER)
        return set(await self.session.scalars(query))

    async def list_team_identity(self, team_id: uuid.UUID) -> tuple[set[str], set[int]]:
        """Emails (lowercased) and shirt numbers already used in a team."""
        query = select(Member.email, Member.shirt_number).where(Member.team_id == team_id)
        rows = list(await self.session.execute(query))
        emails = {email.lower() for email, _ in rows if email}
        numbers = {number for _, number in rows if number is not None}
        return emails, numbers

    async def add_all(self, members: list[Member]) -> None:
        self.session.add_all(members)
        await self.session.commit()
