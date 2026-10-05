import uuid
from datetime import timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.event.models import Event, EventKind, Venue
from app.member.models import Member
from app.team.models import Team
from tests.conftest import KICK_OFF, persist


async def add_match(session: AsyncSession, team: Team, days: int, score: tuple[int, int]) -> Event:
    return await persist(
        session,
        Event(
            team_id=team.id,
            kind=EventKind.MATCH,
            title=f"J{days}",
            starts_at=KICK_OFF + timedelta(days=days),
            opponent="X",
            venue=Venue.AWAY,
            is_cancelled=False,
            score_for=score[0],
            score_against=score[1],
        ),
    )


async def test_team_stats_aggregates_results_and_players(
    client: AsyncClient, session: AsyncSession, team: Team, player: Member, coach: Member
):
    win = await add_match(session, team, 1, (2, 1))
    await add_match(session, team, 8, (0, 0))
    await add_match(session, team, 15, (1, 3))
    await client.post(
        "/match-facts", json={"event_id": str(win.id), "kind": "goal", "member_id": str(player.id)}
    )
    invitations = (await client.post("/invitations", json={"event_id": str(win.id)})).json()
    player_invitation = next(i for i in invitations if i["member"]["id"] == str(player.id))
    await client.patch(
        f"/invitations/{player_invitation['id']}", json={"availability": "available"}
    )
    await client.put(
        f"/lineups/{win.id}",
        json={
            "formation": "4-4-2",
            "slots": [{"member_id": str(player.id), "role": "starter", "position_index": 5}],
        },
    )

    resp = await client.get(f"/stats/teams/{team.id}")

    body = resp.json()
    assert resp.status_code == 200
    assert (body["played"], body["wins"], body["draws"], body["losses"]) == (3, 1, 1, 1)
    assert (body["goals_for"], body["goals_against"]) == (3, 4)
    [stats] = body["players"]
    assert stats["member"]["id"] == str(player.id)
    assert (stats["goals"], stats["selections"], stats["invited"], stats["present"]) == (1, 1, 1, 1)
    assert stats["attendance_rate"] == 1.0


async def test_team_stats_new_team_has_zero_record(client: AsyncClient, team: Team, player):
    body = (await client.get(f"/stats/teams/{team.id}")).json()

    assert body["played"] == 0
    assert body["players"][0]["attendance_rate"] is None


async def test_team_stats_unknown_team_returns_404(client: AsyncClient):
    resp = await client.get(f"/stats/teams/{uuid.uuid4()}")

    assert resp.status_code == 404
