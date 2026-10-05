import uuid
from datetime import timedelta

from httpx import AsyncClient

from app.event.models import Event
from app.team.models import Team
from tests.conftest import KICK_OFF


def new_match(team: Team, **overrides) -> dict:
    return {
        "team_id": str(team.id),
        "kind": "match",
        "title": "Coupe — 1er tour",
        "starts_at": KICK_OFF.isoformat(),
        "meeting_at": (KICK_OFF - timedelta(hours=1)).isoformat(),
        "location": "Stade municipal",
        "opponent": "US Voisine",
        "venue": "away",
        **overrides,
    }


async def test_create_match_valid_payload_returns_201(client: AsyncClient, team: Team):
    resp = await client.post("/events", json=new_match(team))

    assert resp.status_code == 201
    assert resp.json()["opponent"] == "US Voisine"
    assert resp.json()["is_cancelled"] is False


async def test_create_match_without_opponent_returns_422(client: AsyncClient, team: Team):
    resp = await client.post("/events", json=new_match(team, opponent=None))

    assert resp.status_code == 422
    assert resp.json()["code"] == "match_details_required"


async def test_create_training_without_opponent_returns_201(client: AsyncClient, team: Team):
    payload = new_match(team, kind="training", title="Séance", opponent=None, venue=None)

    resp = await client.post("/events", json=payload)

    assert resp.status_code == 201


async def test_create_event_ending_before_start_returns_422(client: AsyncClient, team: Team):
    ends_at = (KICK_OFF - timedelta(minutes=1)).isoformat()

    resp = await client.post("/events", json=new_match(team, ends_at=ends_at))

    assert resp.status_code == 422
    assert resp.json()["code"] == "invalid_event_schedule"


async def test_create_event_naive_datetime_returns_422(client: AsyncClient, team: Team):
    resp = await client.post("/events", json=new_match(team, starts_at="2026-10-10T15:00:00"))

    assert resp.status_code == 422
    assert resp.json()["errors"][0]["field"] == "starts_at"


async def test_list_events_in_range_returns_only_matching(
    client: AsyncClient, team: Team, match: Event
):
    later = (KICK_OFF + timedelta(days=7)).isoformat()
    await client.post("/events", json=new_match(team, starts_at=later, meeting_at=None))

    resp = await client.get(
        "/events",
        params={
            "team_id": str(team.id),
            "from": KICK_OFF.isoformat(),
            "to": (KICK_OFF + timedelta(days=1)).isoformat(),
        },
    )

    assert resp.status_code == 200
    assert [e["id"] for e in resp.json()["items"]] == [str(match.id)]


async def test_partial_update_event_cancels_it(client: AsyncClient, match: Event):
    resp = await client.patch(f"/events/{match.id}", json={"is_cancelled": True})

    assert resp.status_code == 200
    assert resp.json()["is_cancelled"] is True


async def test_partial_update_event_moving_start_after_end_returns_422(
    client: AsyncClient, match: Event
):
    await client.patch(
        f"/events/{match.id}", json={"ends_at": (KICK_OFF + timedelta(hours=2)).isoformat()}
    )

    resp = await client.patch(
        f"/events/{match.id}", json={"starts_at": (KICK_OFF + timedelta(hours=3)).isoformat()}
    )

    assert resp.status_code == 422


async def test_get_event_unknown_returns_404(client: AsyncClient):
    resp = await client.get(f"/events/{uuid.uuid4()}")

    assert resp.status_code == 404
    assert resp.json()["code"] == "event_not_found"


async def test_delete_event_returns_204(client: AsyncClient, match: Event):
    assert (await client.delete(f"/events/{match.id}")).status_code == 204
