import uuid

from httpx import AsyncClient

from app.event.models import Event
from app.member.models import Member


async def invite_roster(client: AsyncClient, event: Event) -> list[dict]:
    resp = await client.post("/invitations", json={"event_id": str(event.id)})
    assert resp.status_code == 201
    return resp.json()


async def test_create_invitations_without_ids_invites_whole_roster(
    client: AsyncClient, match: Event, player: Member, coach: Member
):
    invitations = await invite_roster(client, match)

    assert {i["member"]["id"] for i in invitations} == {str(player.id), str(coach.id)}
    assert all(i["availability"] == "pending" for i in invitations)


async def test_create_invitations_twice_is_idempotent(
    client: AsyncClient, match: Event, player: Member
):
    await invite_roster(client, match)

    second = await invite_roster(client, match)

    assert second == []


async def test_create_invitations_member_of_other_team_returns_422(
    client: AsyncClient, match: Event
):
    payload = {"event_id": str(match.id), "member_ids": [str(uuid.uuid4())]}

    resp = await client.post("/invitations", json=payload)

    assert resp.status_code == 422
    assert resp.json()["code"] == "member_not_in_team"


async def test_create_invitations_cancelled_event_returns_422(
    client: AsyncClient, match: Event, player: Member
):
    await client.patch(f"/events/{match.id}", json={"is_cancelled": True})

    resp = await client.post("/invitations", json={"event_id": str(match.id)})

    assert resp.status_code == 422
    assert resp.json()["code"] == "event_cancelled"


async def test_reply_records_availability_and_timestamp(
    client: AsyncClient, match: Event, player: Member
):
    [invitation] = await invite_roster(client, match)

    resp = await client.patch(
        f"/invitations/{invitation['id']}",
        json={"availability": "unavailable", "comment": "Blessé"},
    )

    assert resp.status_code == 200
    assert resp.json()["availability"] == "unavailable"
    assert resp.json()["comment"] == "Blessé"
    assert resp.json()["responded_at"] is not None


async def test_reply_with_pending_returns_422(client: AsyncClient, match: Event, player: Member):
    [invitation] = await invite_roster(client, match)

    resp = await client.patch(f"/invitations/{invitation['id']}", json={"availability": "pending"})

    assert resp.status_code == 422


async def test_summary_counts_per_availability(
    client: AsyncClient, match: Event, player: Member, coach: Member
):
    invitations = await invite_roster(client, match)
    await client.patch(f"/invitations/{invitations[0]['id']}", json={"availability": "available"})

    resp = await client.get("/invitations/summary", params={"event_id": str(match.id)})

    assert resp.json() == {
        "event_id": str(match.id),
        "invited": 2,
        "pending": 1,
        "available": 1,
        "uncertain": 0,
        "unavailable": 0,
    }


async def test_list_invitations_filtered_by_availability(
    client: AsyncClient, match: Event, player: Member, coach: Member
):
    invitations = await invite_roster(client, match)
    await client.patch(f"/invitations/{invitations[0]['id']}", json={"availability": "uncertain"})

    resp = await client.get(
        "/invitations", params={"event_id": str(match.id), "availability": "uncertain"}
    )

    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["id"] == invitations[0]["id"]


async def test_list_invitations_unknown_event_returns_404(client: AsyncClient):
    resp = await client.get("/invitations", params={"event_id": str(uuid.uuid4())})

    assert resp.status_code == 404


async def test_delete_invitation_returns_204(client: AsyncClient, match: Event, player: Member):
    [invitation] = await invite_roster(client, match)

    assert (await client.delete(f"/invitations/{invitation['id']}")).status_code == 204
    assert (await client.delete(f"/invitations/{invitation['id']}")).status_code == 404


async def test_reminders_target_only_pending_invitations(
    client: AsyncClient, match: Event, player: Member, coach: Member
):
    invitations = await invite_roster(client, match)
    await client.patch(f"/invitations/{invitations[0]['id']}", json={"availability": "available"})

    resp = await client.post("/invitations/reminders", json={"event_id": str(match.id)})
    listed = (await client.get("/invitations", params={"event_id": str(match.id)})).json()

    assert resp.status_code == 200
    assert resp.json()["reminded"] == 1
    counts = {i["id"]: i["reminder_count"] for i in listed["items"]}
    assert counts[invitations[0]["id"]] == 0
    assert counts[invitations[1]["id"]] == 1


async def test_reminders_on_cancelled_event_returns_422(client: AsyncClient, match: Event):
    await client.patch(f"/events/{match.id}", json={"is_cancelled": True})

    resp = await client.post("/invitations/reminders", json={"event_id": str(match.id)})

    assert resp.json()["code"] == "event_cancelled"


async def test_reminders_unknown_event_returns_404(client: AsyncClient):
    resp = await client.post("/invitations/reminders", json={"event_id": str(uuid.uuid4())})

    assert resp.status_code == 404
