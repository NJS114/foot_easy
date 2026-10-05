import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.event.models import Event, EventKind
from app.member.models import Member
from app.team.models import Team
from tests.conftest import KICK_OFF, persist


async def make_players(session: AsyncSession, team: Team, count: int) -> list[Member]:
    return [
        await persist(
            session,
            Member(team_id=team.id, first_name=f"P{index}", last_name="X", shirt_number=index + 1),
        )
        for index in range(count)
    ]


def starters(players: list[Member]) -> list[dict]:
    return [
        {"member_id": str(player.id), "role": "starter", "position_index": index}
        for index, player in enumerate(players)
    ]


async def test_list_formations_includes_8_a_side(client: AsyncClient):
    resp = await client.get("/lineups/formations")

    codes = {formation["code"]: formation["players"] for formation in resp.json()}
    assert codes["4-4-2"] == 11
    assert codes["3-3-1"] == 8


async def test_put_lineup_creates_then_replaces(
    client: AsyncClient, session: AsyncSession, team: Team, match: Event
):
    players = await make_players(session, team, 3)
    first = {"formation": "4-4-2", "slots": starters(players[:2])}
    bench = {"member_id": str(players[2].id), "role": "substitute"}

    created = await client.put(f"/lineups/{match.id}", json=first)
    replaced = await client.put(
        f"/lineups/{match.id}",
        json={"formation": "4-3-3", "slots": [*starters(players[:1]), bench]},
    )

    assert created.status_code == 200
    assert replaced.json()["formation"] == "4-3-3"
    assert [slot["role"] for slot in replaced.json()["slots"]] == ["starter", "substitute"]


async def test_get_lineup_flags_members_not_available(
    client: AsyncClient, session: AsyncSession, team: Team, match: Event
):
    players = await make_players(session, team, 1)
    await client.put(
        f"/lineups/{match.id}", json={"formation": "4-4-2", "slots": starters(players)}
    )

    resp = await client.get(f"/lineups/{match.id}")

    assert resp.json()["unavailable_member_ids"] == [str(players[0].id)]


async def test_put_lineup_duplicate_position_returns_422(
    client: AsyncClient, session: AsyncSession, team: Team, match: Event
):
    players = await make_players(session, team, 2)
    slots = [{"member_id": str(p.id), "role": "starter", "position_index": 0} for p in players]

    resp = await client.put(f"/lineups/{match.id}", json={"formation": "4-4-2", "slots": slots})

    assert resp.status_code == 422
    assert resp.json()["code"] == "position_taken"


async def test_put_lineup_position_outside_formation_returns_422(
    client: AsyncClient, session: AsyncSession, team: Team, match: Event
):
    players = await make_players(session, team, 1)
    slots = [{"member_id": str(players[0].id), "role": "starter", "position_index": 8}]

    resp = await client.put(f"/lineups/{match.id}", json={"formation": "2-2", "slots": slots})

    assert resp.json()["code"] == "invalid_position"


async def test_put_lineup_coach_returns_422(client: AsyncClient, match: Event, coach: Member):
    slots = [{"member_id": str(coach.id), "role": "substitute"}]

    resp = await client.put(f"/lineups/{match.id}", json={"formation": "4-4-2", "slots": slots})

    assert resp.json()["code"] == "not_a_team_player"


async def test_put_lineup_unknown_formation_returns_422(client: AsyncClient, match: Event):
    resp = await client.put(f"/lineups/{match.id}", json={"formation": "9-9", "slots": []})

    assert resp.json()["code"] == "unknown_formation"


async def test_put_lineup_on_training_returns_422(
    client: AsyncClient, session: AsyncSession, team: Team
):
    training = await persist(
        session,
        Event(
            team_id=team.id,
            kind=EventKind.TRAINING,
            title="T",
            starts_at=KICK_OFF,
            is_cancelled=False,
        ),
    )

    resp = await client.put(f"/lineups/{training.id}", json={"formation": "4-4-2", "slots": []})

    assert resp.json()["code"] == "lineup_not_allowed"


async def test_get_lineup_missing_returns_404(client: AsyncClient, match: Event):
    resp = await client.get(f"/lineups/{match.id}")

    assert resp.status_code == 404
    assert resp.json()["code"] == "lineup_not_found"


async def test_get_lineup_unknown_event_returns_404(client: AsyncClient):
    resp = await client.get(f"/lineups/{uuid.uuid4()}")

    assert resp.json()["code"] == "event_not_found"


async def test_delete_lineup_returns_204(client: AsyncClient, match: Event):
    await client.put(f"/lineups/{match.id}", json={"formation": "4-4-2", "slots": []})

    assert (await client.delete(f"/lineups/{match.id}")).status_code == 204
    assert (await client.get(f"/lineups/{match.id}")).status_code == 404
