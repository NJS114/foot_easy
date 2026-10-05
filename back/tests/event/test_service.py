import uuid
from datetime import timedelta
from unittest.mock import AsyncMock

import pytest

from app.event.exceptions import (
    EventNotFoundError,
    InvalidEventScheduleError,
    MatchDetailsRequiredError,
)
from app.event.models import Event, EventKind, Venue
from app.event.schemas import EventCreate, EventUpdate
from app.event.service import EventService, check_event_rules
from tests.conftest import KICK_OFF


def make_event(**overrides) -> Event:
    fields = {
        "id": uuid.uuid4(),
        "kind": EventKind.MATCH,
        "starts_at": KICK_OFF,
        "ends_at": None,
        "meeting_at": None,
        "opponent": "AS Rivale",
        "venue": Venue.HOME,
    }
    return Event(**{**fields, **overrides})


def test_check_event_rules_meeting_after_start_raises():
    with pytest.raises(InvalidEventScheduleError):
        check_event_rules(make_event(meeting_at=KICK_OFF + timedelta(minutes=5)))


def test_check_event_rules_match_without_venue_raises():
    with pytest.raises(MatchDetailsRequiredError):
        check_event_rules(make_event(venue=None))


def test_check_event_rules_other_event_without_opponent_passes():
    check_event_rules(make_event(kind=EventKind.OTHER, opponent=None, venue=None))


async def test_create_event_valid_match_is_persisted_not_cancelled():
    repository, team_service = AsyncMock(), AsyncMock()
    repository.add.side_effect = lambda event: event
    data = EventCreate(
        team_id=uuid.uuid4(),
        kind=EventKind.MATCH,
        title="J2",
        starts_at=KICK_OFF,
        opponent="FC Nord",
        venue=Venue.AWAY,
    )

    event = await EventService(repository, team_service).create_event(data)

    assert event.is_cancelled is False
    team_service.get_team.assert_awaited_once_with(data.team_id)


async def test_update_event_missing_raises_not_found():
    repository = AsyncMock()
    repository.get.return_value = None

    with pytest.raises(EventNotFoundError):
        await EventService(repository, AsyncMock()).update_event(uuid.uuid4(), EventUpdate())
