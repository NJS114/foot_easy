import uuid

from app.member.exceptions import (
    MemberNotFoundError,
    PositionNotAllowedError,
    ShirtNumberTakenError,
)
from app.member.models import Member, MemberRole
from app.member.repository import MemberRepository
from app.member.schemas import MemberCreate, MemberUpdate
from app.team.service import TeamService


class MemberService:
    def __init__(self, repository: MemberRepository, team_service: TeamService):
        self.repository = repository
        self.team_service = team_service

    async def list_members(
        self, team_id: uuid.UUID, role: MemberRole | None, skip: int, limit: int
    ) -> tuple[list[Member], int]:
        await self.team_service.get_team(team_id)
        return await self.repository.list_by_team(team_id, role, skip, limit)

    async def get_member(self, member_id: uuid.UUID) -> Member:
        member = await self.repository.get(member_id)
        if member is None:
            raise MemberNotFoundError(member_id)
        return member

    async def create_member(self, data: MemberCreate) -> Member:
        await self.team_service.get_team(data.team_id)
        member = Member(**data.model_dump())
        await self._check_rules(member)
        return await self.repository.add(member)

    async def update_member(self, member_id: uuid.UUID, data: MemberUpdate) -> Member:
        member = await self.get_member(member_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(member, field, value)
        await self._check_rules(member)
        return await self.repository.save(member)

    async def delete_member(self, member_id: uuid.UUID) -> None:
        member = await self.get_member(member_id)
        await self.repository.delete(member)

    async def _check_rules(self, member: Member) -> None:
        is_player = member.role == MemberRole.PLAYER
        if not is_player and (member.position is not None or member.shirt_number is not None):
            raise PositionNotAllowedError()
        if member.shirt_number is None:
            return
        holder = await self.repository.find_by_shirt_number(member.team_id, member.shirt_number)
        if holder is not None and holder.id != member.id:
            raise ShirtNumberTakenError(member.shirt_number)
