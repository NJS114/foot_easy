from sqlalchemy.ext.asyncio import AsyncSession

from app.team.models import Team, TeamCategory
from app.team.repository import TeamRepository


async def test_find_by_name_and_season_matches_exact_pair(session: AsyncSession, team: Team):
    repository = TeamRepository(session)

    assert await repository.find_by_name_and_season(team.name, team.season) == team
    assert await repository.find_by_name_and_season(team.name, "2025-2026") is None


async def test_list_teams_orders_by_latest_season_then_name(session: AsyncSession):
    repository = TeamRepository(session)
    for name, season in [("B", "2025-2026"), ("Z", "2026-2027"), ("A", "2026-2027")]:
        await repository.add(Team(name=name, category=TeamCategory.SENIOR, season=season))

    teams, total = await repository.list_teams(None, skip=0, limit=10)

    assert total == 3
    assert [t.name for t in teams] == ["A", "Z", "B"]


async def test_list_teams_paginates_with_total(session: AsyncSession):
    repository = TeamRepository(session)
    for index in range(3):
        await repository.add(Team(name=f"T{index}", category=TeamCategory.U9, season="2026-2027"))

    teams, total = await repository.list_teams("2026-2027", skip=2, limit=2)

    assert total == 3
    assert len(teams) == 1
