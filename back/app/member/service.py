import uuid

from pydantic import ValidationError

from app.club.service import ClubService
from app.member.exceptions import (
    InvalidImportError,
    MemberNotFoundError,
    MissingScopeError,
    PositionNotAllowedError,
    ShirtNumberTakenError,
)
from app.member.export import to_csv
from app.member.importer import read_rows, to_payload
from app.member.models import Member, MemberRole
from app.member.repository import MemberRepository
from app.member.schemas import ImportReport, MemberCreate, MemberQuery, MemberUpdate
from app.team.service import TeamService


def check_role_fields(role: MemberRole, position: object, shirt_number: object) -> None:
    if role != MemberRole.PLAYER and (position is not None or shirt_number is not None):
        raise PositionNotAllowedError()


def validate_import_rows(
    team_id: uuid.UUID, rows: list[dict[str, object]], taken_numbers: set[int]
) -> tuple[list[MemberCreate], list[tuple[str, str]]]:
    """Validate every row (file line numbers start at 2) without stopping at the first error."""
    members, errors, numbers = [], [], set(taken_numbers)
    for line, row in enumerate(rows, start=2):
        try:
            member = MemberCreate(team_id=team_id, **to_payload(row))
            check_role_fields(member.role, member.position, member.shirt_number)
        except ValidationError as error:
            errors += [(f"rows[{line}].{e['loc'][0]}", e["msg"]) for e in error.errors()]
            continue
        except PositionNotAllowedError as error:
            errors.append((f"rows[{line}].position", error.message))
            continue
        if member.shirt_number is not None:
            if member.shirt_number in numbers:
                errors.append((f"rows[{line}].shirt_number", "Shirt number already taken"))
            numbers.add(member.shirt_number)
        members.append(member)
    return members, errors


class MemberService:
    def __init__(
        self, repository: MemberRepository, team_service: TeamService, club_service: ClubService
    ):
        self.repository = repository
        self.team_service = team_service
        self.club_service = club_service

    async def list_members(
        self, query: MemberQuery, skip: int, limit: int
    ) -> tuple[list[Member], int]:
        await self._check_scope(query)
        return await self.repository.search(query, skip, limit)

    async def export_members(self, query: MemberQuery) -> str:
        await self._check_scope(query)
        return to_csv(await self.repository.list_with_team_names(query))

    async def import_members(
        self, team_id: uuid.UUID, filename: str, content: bytes
    ) -> ImportReport:
        """Create every valid row, or nothing at all if one row is invalid."""
        await self.team_service.get_team(team_id)
        emails, numbers = await self.repository.list_team_identity(team_id)
        members, errors = validate_import_rows(team_id, read_rows(filename, content), numbers)
        if errors:
            raise InvalidImportError(errors)
        new = [m for m in members if not (m.email and m.email.lower() in emails)]
        await self.repository.add_all([Member(**member.model_dump()) for member in new])
        return ImportReport(imported=len(new), skipped=len(members) - len(new))

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

    async def _check_scope(self, query: MemberQuery) -> None:
        if query.team_id is None and query.club_id is None:
            raise MissingScopeError()
        if query.team_id is not None:
            await self.team_service.get_team(query.team_id)
        if query.club_id is not None:
            await self.club_service.get_club(query.club_id)

    async def _check_rules(self, member: Member) -> None:
        check_role_fields(member.role, member.position, member.shirt_number)
        if member.shirt_number is None:
            return
        holder = await self.repository.find_by_shirt_number(member.team_id, member.shirt_number)
        if holder is not None and holder.id != member.id:
            raise ShirtNumberTakenError(member.shirt_number)
