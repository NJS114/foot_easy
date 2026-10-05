from collections.abc import AsyncIterator
from datetime import UTC, datetime

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import get_session
from app.event.models import Event, EventKind, Venue
from app.main import app
from app.member.models import Member, MemberRole, PlayerPosition
from app.models import Base
from app.team.models import Team, TeamCategory

KICK_OFF = datetime(2026, 10, 10, 15, 0, tzinfo=UTC)


@pytest.fixture
async def session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    # SQLite ignores foreign keys (and ON DELETE CASCADE) unless enabled per connection.
    event.listen(
        engine.sync_engine, "connect", lambda conn, _: conn.execute("PRAGMA foreign_keys=ON")
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, expire_on_commit=False)() as db_session:
        yield db_session
    await engine.dispose()


@pytest.fixture
async def client(session: AsyncSession) -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_session] = lambda: session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api/v1") as http_client:
        yield http_client
    app.dependency_overrides.clear()


async def persist(session: AsyncSession, entity):
    session.add(entity)
    await session.commit()
    await session.refresh(entity)
    return entity


@pytest.fixture
async def team(session: AsyncSession) -> Team:
    return await persist(
        session, Team(name="FC Easy", category=TeamCategory.SENIOR, season="2026-2027")
    )


@pytest.fixture
async def player(session: AsyncSession, team: Team) -> Member:
    return await persist(
        session,
        Member(
            team_id=team.id,
            first_name="Zinedine",
            last_name="Zidane",
            role=MemberRole.PLAYER,
            position=PlayerPosition.MIDFIELDER,
            shirt_number=10,
        ),
    )


@pytest.fixture
async def coach(session: AsyncSession, team: Team) -> Member:
    return await persist(
        session,
        Member(team_id=team.id, first_name="Aimé", last_name="Jacquet", role=MemberRole.COACH),
    )


@pytest.fixture
async def match(session: AsyncSession, team: Team) -> Event:
    return await persist(
        session,
        Event(
            team_id=team.id,
            kind=EventKind.MATCH,
            title="Championnat J1",
            starts_at=KICK_OFF,
            opponent="AS Rivale",
            venue=Venue.HOME,
            is_cancelled=False,
        ),
    )
