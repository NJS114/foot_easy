from sqlalchemy.ext.asyncio import AsyncSession

from app.club.models import Club
from app.team.models import Team, TeamCategory
from app.team.repository import TeamRepository
from tests.conftest import persist


async def test_find_by_name_and_season_matches_club_name_and_season(
    session: AsyncSession, club: Club, team: Team
):
    repository = TeamRepository(session)
    other_club = await persist(session, Club(name="Autre club"))

    assert await repository.find_by_name_and_season(club.id, team.name, team.season) == team
    assert await repository.find_by_name_and_season(club.id, team.name, "2025-2026") is None
    assert await repository.find_by_name_and_season(other_club.id, team.name, team.season) is None


async def test_list_teams_orders_by_latest_season_then_name(session: AsyncSession, club: Club):
    repository = TeamRepository(session)
    for name, season in [("B", "2025-2026"), ("Z", "2026-2027"), ("A", "2026-2027")]:
        await repository.add(
            Team(club_id=club.id, name=name, category=TeamCategory.SENIOR, season=season)
        )

    teams, total = await repository.list_teams(club.id, None, skip=0, limit=10)

    assert total == 3
    assert [t.name for t in teams] == ["A", "Z", "B"]


async def test_list_teams_paginates_with_total(session: AsyncSession, club: Club):
    repository = TeamRepository(session)
    for index in range(3):
        await repository.add(
            Team(club_id=club.id, name=f"T{index}", category=TeamCategory.U9, season="2026-2027")
        )

    teams, total = await repository.list_teams(None, "2026-2027", skip=2, limit=2)

    assert total == 3
    assert len(teams) == 1


async def test_deleting_club_cascades_to_teams(session: AsyncSession, club: Club, team: Team):
    await session.delete(club)
    await session.commit()

    assert await TeamRepository(session).list_teams(None, None, skip=0, limit=10) == ([], 0)
