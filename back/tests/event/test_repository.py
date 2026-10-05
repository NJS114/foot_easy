from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.event.models import Event, EventKind
from app.event.repository import EventRepository
from app.team.models import Team
from tests.conftest import KICK_OFF


async def add_training(repository: EventRepository, team: Team, days: int) -> Event:
    return await repository.add(
        Event(
            team_id=team.id,
            kind=EventKind.TRAINING,
            title=f"Training D+{days}",
            starts_at=KICK_OFF + timedelta(days=days),
            is_cancelled=False,
        )
    )


async def test_list_by_team_orders_chronologically(session: AsyncSession, team: Team, match):
    repository = EventRepository(session)
    later = await add_training(repository, team, days=2)
    earlier = await add_training(repository, team, days=-2)

    events, total = await repository.list_by_team(team.id, None, None, None, skip=0, limit=10)

    assert total == 3
    assert [e.id for e in events] == [earlier.id, match.id, later.id]


async def test_list_by_team_filters_kind_and_range(session: AsyncSession, team: Team, match):
    repository = EventRepository(session)
    await add_training(repository, team, days=1)
    inside = await add_training(repository, team, days=3)

    events, total = await repository.list_by_team(
        team.id,
        EventKind.TRAINING,
        KICK_OFF + timedelta(days=2),
        KICK_OFF + timedelta(days=4),
        skip=0,
        limit=10,
    )

    assert total == 1
    assert events[0].id == inside.id


async def test_starts_at_round_trips_as_aware_utc(session: AsyncSession, match: Event):
    session.expunge_all()

    reloaded = await EventRepository(session).get(match.id)

    assert reloaded.starts_at == KICK_OFF
    assert reloaded.starts_at.tzinfo is not None
