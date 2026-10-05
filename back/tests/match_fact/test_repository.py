from sqlalchemy.ext.asyncio import AsyncSession

from app.event.models import Event
from app.match_fact.models import FactKind, MatchFact
from app.match_fact.repository import MatchFactRepository
from app.member.models import Member


async def test_count_goals_ignores_cards(session: AsyncSession, match: Event, player: Member):
    repository = MatchFactRepository(session)
    for kind in (FactKind.GOAL, FactKind.GOAL, FactKind.YELLOW_CARD):
        await repository.add(MatchFact(event_id=match.id, kind=kind, member_id=player.id))

    assert await repository.count_goals(match.id) == 2


async def test_deleting_assist_member_keeps_goal(
    session: AsyncSession, match: Event, player: Member, coach: Member
):
    repository = MatchFactRepository(session)
    goal = await repository.add(
        MatchFact(
            event_id=match.id, kind=FactKind.GOAL, member_id=player.id, assist_member_id=coach.id
        )
    )
    await session.delete(coach)
    await session.commit()

    reloaded = await repository.get(goal.id)

    assert reloaded is not None
    assert reloaded.assist_member_id is None
