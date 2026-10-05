import uuid

from httpx import AsyncClient

from app.club.models import Club


async def test_create_club_returns_201_with_default_color(client: AsyncClient):
    resp = await client.post("/clubs", json={"name": "US Quartier", "city": "Nantes"})

    assert resp.status_code == 201
    assert resp.json()["primary_color"] == "#16a34a"


async def test_create_club_duplicate_name_returns_409(client: AsyncClient, club: Club):
    resp = await client.post("/clubs", json={"name": club.name})

    assert resp.status_code == 409
    assert resp.json()["code"] == "club_already_exists"


async def test_create_club_blank_name_returns_422(client: AsyncClient):
    resp = await client.post("/clubs", json={"name": "   "})

    assert resp.status_code == 422


async def test_list_clubs_returns_page(client: AsyncClient, club: Club):
    resp = await client.get("/clubs")

    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["name"] == club.name


async def test_partial_update_club_changes_color(client: AsyncClient, club: Club):
    resp = await client.patch(f"/clubs/{club.id}", json={"primary_color": "#0f172a"})

    assert resp.status_code == 200
    assert resp.json()["primary_color"] == "#0f172a"


async def test_get_club_unknown_returns_404(client: AsyncClient):
    resp = await client.get(f"/clubs/{uuid.uuid4()}")

    assert resp.status_code == 404
    assert resp.json()["code"] == "club_not_found"


async def test_delete_club_returns_204(client: AsyncClient, club: Club):
    assert (await client.delete(f"/clubs/{club.id}")).status_code == 204
    assert (await client.get(f"/clubs/{club.id}")).status_code == 404
