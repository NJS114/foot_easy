from sqlalchemy.ext.asyncio import AsyncSession

from app.event.models import Event
from app.stats.repository import StatsRepository
from app.team.models import Team


async def test_list_scores_skips_unplayed_and_cancelled(
    session: AsyncSession, team: Team, match: Event
):
    repository = StatsRepository(session)
    assert await repository.list_scores(team.id) == []

    match.score_for, match.score_against = 2, 0
    await session.commit()
    assert await repository.list_scores(team.id) == [(2, 0)]

    match.is_cancelled = True
    await session.commit()
    assert await repository.list_scores(team.id) == []
