import uuid

from httpx import AsyncClient

from app.team.models import Team

NEW_TEAM = {"name": "U13 A", "category": "u13", "season": "2026-2027"}


async def test_create_team_valid_payload_returns_201(client: AsyncClient):
    resp = await client.post("/teams", json=NEW_TEAM)

    assert resp.status_code == 201
    assert resp.json()["name"] == "U13 A"
    assert resp.json()["category"] == "u13"


async def test_create_team_duplicate_name_and_season_returns_409(client: AsyncClient, team: Team):
    payload = {"name": team.name, "category": "senior", "season": team.season}

    resp = await client.post("/teams", json=payload)

    assert resp.status_code == 409
    assert resp.json()["code"] == "team_already_exists"


async def test_create_team_invalid_season_returns_422_envelope(client: AsyncClient):
    resp = await client.post("/teams", json={**NEW_TEAM, "season": "2026"})

    body = resp.json()
    assert resp.status_code == 422
    assert body["code"] == "validation_error"
    assert body["errors"][0]["field"] == "season"
    assert body["request_id"]


async def test_list_teams_filtered_by_season_returns_page(client: AsyncClient, team: Team):
    await client.post("/teams", json={**NEW_TEAM, "season": "2025-2026"})

    resp = await client.get("/teams", params={"season": "2026-2027"})

    body = resp.json()
    assert resp.status_code == 200
    assert body["total"] == 1
    assert body["items"][0]["id"] == str(team.id)
    assert body["has_more"] is False


async def test_get_team_unknown_id_returns_404(client: AsyncClient):
    resp = await client.get(f"/teams/{uuid.uuid4()}")

    assert resp.status_code == 404
    assert resp.json()["code"] == "team_not_found"


async def test_partial_update_team_changes_only_given_fields(client: AsyncClient, team: Team):
    resp = await client.patch(f"/teams/{team.id}", json={"name": "FC Easy B"})

    assert resp.status_code == 200
    assert resp.json()["name"] == "FC Easy B"
    assert resp.json()["season"] == team.season


async def test_delete_team_then_get_returns_404(client: AsyncClient, team: Team):
    delete_resp = await client.delete(f"/teams/{team.id}")
    get_resp = await client.get(f"/teams/{team.id}")

    assert delete_resp.status_code == 204
    assert get_resp.status_code == 404
