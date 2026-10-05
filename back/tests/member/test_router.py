import uuid

from httpx import AsyncClient

from app.member.models import Member
from app.team.models import Team


def new_player(team: Team, **overrides) -> dict:
    return {
        "team_id": str(team.id),
        "first_name": "Kylian",
        "last_name": "Mbappé",
        "position": "forward",
        "shirt_number": 7,
        **overrides,
    }


async def test_create_member_valid_player_returns_201(client: AsyncClient, team: Team):
    resp = await client.post("/members", json=new_player(team, email="km@example.org"))

    assert resp.status_code == 201
    assert resp.json()["role"] == "player"
    assert resp.json()["shirt_number"] == 7


async def test_create_member_unknown_team_returns_404(client: AsyncClient, team: Team):
    resp = await client.post("/members", json={**new_player(team), "team_id": str(uuid.uuid4())})

    assert resp.status_code == 404
    assert resp.json()["code"] == "team_not_found"


async def test_create_member_taken_shirt_number_returns_409(
    client: AsyncClient, team: Team, player: Member
):
    resp = await client.post("/members", json=new_player(team, shirt_number=player.shirt_number))

    assert resp.status_code == 409
    assert resp.json()["code"] == "shirt_number_taken"


async def test_create_member_coach_with_position_returns_422(client: AsyncClient, team: Team):
    resp = await client.post("/members", json=new_player(team, role="coach"))

    assert resp.status_code == 422
    assert resp.json()["code"] == "position_not_allowed"


async def test_create_member_invalid_email_returns_422(client: AsyncClient, team: Team):
    resp = await client.post("/members", json=new_player(team, email="not-an-email"))

    assert resp.status_code == 422
    assert resp.json()["errors"][0]["field"] == "email"


async def test_list_members_filtered_by_role(
    client: AsyncClient, team: Team, player: Member, coach: Member
):
    resp = await client.get("/members", params={"team_id": str(team.id), "role": "coach"})

    assert resp.status_code == 200
    assert [m["id"] for m in resp.json()["items"]] == [str(coach.id)]


async def test_list_members_unknown_team_returns_404(client: AsyncClient):
    resp = await client.get("/members", params={"team_id": str(uuid.uuid4())})

    assert resp.status_code == 404


async def test_partial_update_member_changes_shirt_number(client: AsyncClient, player: Member):
    resp = await client.patch(f"/members/{player.id}", json={"shirt_number": 5})

    assert resp.status_code == 200
    assert resp.json()["shirt_number"] == 5


async def test_delete_member_returns_204(client: AsyncClient, player: Member):
    resp = await client.delete(f"/members/{player.id}")

    assert resp.status_code == 204
    assert (await client.get(f"/members/{player.id}")).status_code == 404
