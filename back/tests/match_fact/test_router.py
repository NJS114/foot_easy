import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.event.models import Event
from app.member.models import Member
from app.team.models import Team
from tests.conftest import persist


async def second_player(session: AsyncSession, team: Team) -> Member:
    return await persist(
        session, Member(team_id=team.id, first_name="Karim", last_name="Benzema", shirt_number=9)
    )


async def test_create_goal_with_assist_returns_201(
    client: AsyncClient, session: AsyncSession, team: Team, match: Event, player: Member
):
    passer = await second_player(session, team)
    payload = {
        "event_id": str(match.id),
        "kind": "goal",
        "member_id": str(player.id),
        "assist_member_id": str(passer.id),
        "minute": 23,
    }

    resp = await client.post("/match-facts", json=payload)

    assert resp.status_code == 201
    assert resp.json()["member"]["last_name"] == "Zidane"
    assert resp.json()["assist_member"]["last_name"] == "Benzema"


async def test_create_card_with_assist_returns_422(
    client: AsyncClient, session: AsyncSession, team: Team, match: Event, player: Member
):
    passer = await second_player(session, team)
    payload = {
        "event_id": str(match.id),
        "kind": "yellow_card",
        "member_id": str(player.id),
        "assist_member_id": str(passer.id),
    }

    resp = await client.post("/match-facts", json=payload)

    assert resp.json()["code"] == "assist_not_allowed"


async def test_create_goal_beyond_score_returns_422(
    client: AsyncClient, match: Event, player: Member
):
    await client.patch(f"/events/{match.id}", json={"score_for": 1, "score_against": 0})
    goal = {"event_id": str(match.id), "kind": "goal", "member_id": str(player.id)}
    await client.post("/match-facts", json=goal)

    resp = await client.post("/match-facts", json=goal)

    assert resp.json()["code"] == "goals_exceed_score"


async def test_create_fact_for_coach_returns_422(client: AsyncClient, match: Event, coach: Member):
    payload = {"event_id": str(match.id), "kind": "red_card", "member_id": str(coach.id)}

    resp = await client.post("/match-facts", json=payload)

    assert resp.json()["code"] == "not_a_team_player"


async def test_create_fact_invalid_minute_returns_422(
    client: AsyncClient, match: Event, player: Member
):
    payload = {
        "event_id": str(match.id),
        "kind": "goal",
        "member_id": str(player.id),
        "minute": 200,
    }

    resp = await client.post("/match-facts", json=payload)

    assert resp.json()["errors"][0]["field"] == "minute"


async def test_list_facts_ordered_by_minute(client: AsyncClient, match: Event, player: Member):
    for minute in (80, 12):
        await client.post(
            "/match-facts",
            json={
                "event_id": str(match.id),
                "kind": "goal",
                "member_id": str(player.id),
                "minute": minute,
            },
        )

    resp = await client.get("/match-facts", params={"event_id": str(match.id)})

    assert [fact["minute"] for fact in resp.json()["items"]] == [12, 80]


async def test_delete_fact_returns_204_then_404(client: AsyncClient, match: Event, player: Member):
    created = await client.post(
        "/match-facts",
        json={"event_id": str(match.id), "kind": "goal", "member_id": str(player.id)},
    )

    assert (await client.delete(f"/match-facts/{created.json()['id']}")).status_code == 204
    assert (await client.delete(f"/match-facts/{created.json()['id']}")).status_code == 404


async def test_list_facts_unknown_event_returns_404(client: AsyncClient):
    resp = await client.get("/match-facts", params={"event_id": str(uuid.uuid4())})

    assert resp.status_code == 404
