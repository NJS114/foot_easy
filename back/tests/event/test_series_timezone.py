from datetime import datetime

from httpx import AsyncClient

from app.team.models import Team


async def test_series_keeps_local_time_when_daylight_saving_ends(client: AsyncClient, team: Team):
    response = await client.post(
        "/events/series",
        json={
            "team_id": str(team.id),
            "kind": "training",
            "title": "Mercredi soir",
            "starts_at": "2026-10-21T16:00:00Z",
            "meeting_at": "2026-10-21T15:30:00Z",
            "ends_at": "2026-10-21T17:30:00Z",
            "repeat_until": "2026-10-28",
            "timezone": "Europe/Paris",
        },
    )
    assert response.status_code == 201
    events = response.json()
    assert len(events) == 2
    assert datetime.fromisoformat(events[0]["starts_at"]) == datetime.fromisoformat(
        "2026-10-21T16:00:00Z"
    )
    assert datetime.fromisoformat(events[1]["starts_at"]) == datetime.fromisoformat(
        "2026-10-28T17:00:00Z"
    )
    assert datetime.fromisoformat(events[1]["meeting_at"]) == datetime.fromisoformat(
        "2026-10-28T16:30:00Z"
    )


async def test_series_rejects_unknown_timezone(client: AsyncClient, team: Team):
    response = await client.post(
        "/events/series",
        json={
            "team_id": str(team.id),
            "kind": "training",
            "title": "Séance",
            "starts_at": "2026-10-21T16:00:00Z",
            "repeat_until": "2026-10-28",
            "timezone": "Unknown/Place",
        },
    )
    assert response.status_code == 422
