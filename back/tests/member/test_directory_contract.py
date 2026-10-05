from httpx import AsyncClient

from app.club.models import Club
from app.member.models import Member
from app.team.models import Team


async def test_directory_query_is_flat_and_paginated(
    client: AsyncClient, club: Club, player: Member
):
    response = await client.get(
        "/members",
        params={
            "club_id": str(club.id),
            "search": "Zidane",
            "sort": "last_name",
            "limit": 100,
            "skip": 0,
        },
    )
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["id"] == str(player.id)


async def test_import_report_matches_frontend_contract(client: AsyncClient, team: Team):
    response = await client.post(
        "/members/import",
        params={"team_id": str(team.id)},
        files={
            "file": (
                "members.csv",
                b"first_name,last_name,email\nNadia,Meziane,nadia@example.org\n",
                "text/csv",
            )
        },
    )
    assert response.status_code == 201
    assert response.json() == {"imported": 1, "skipped": 0}
    export = await client.get("/members/export", params={"team_id": str(team.id)})
    assert export.status_code == 200
    assert "Nadia" in export.text
