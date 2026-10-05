import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.member.models import Member, MemberRole
from app.member.repository import MemberRepository
from app.team.models import Team


async def test_list_by_team_orders_coaches_then_players_by_shirt(
    session: AsyncSession, team: Team, player: Member, coach: Member
):
    repository = MemberRepository(session)
    await repository.add(Member(team_id=team.id, first_name="A", last_name="B", shirt_number=1))

    members, total = await repository.list_by_team(team.id, None, skip=0, limit=10)

    assert total == 3
    assert [m.shirt_number for m in members] == [None, 1, 10]


async def test_list_by_team_filters_role(session: AsyncSession, team: Team, player, coach):
    members, total = await MemberRepository(session).list_by_team(
        team.id, MemberRole.PLAYER, skip=0, limit=10
    )

    assert total == 1
    assert members[0].id == player.id


async def test_shirt_number_unique_per_team_enforced_by_db(
    session: AsyncSession, team: Team, player: Member
):
    duplicate = Member(team_id=team.id, first_name="X", last_name="Y", shirt_number=10)

    with pytest.raises(IntegrityError):
        await MemberRepository(session).add(duplicate)


async def test_deleting_team_cascades_to_members(session: AsyncSession, team: Team, player):
    await session.delete(team)
    await session.commit()

    assert await MemberRepository(session).list_ids_by_team(team.id) == []
