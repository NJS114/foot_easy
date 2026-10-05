import uuid

import pytest

from app.match_fact.exceptions import InvalidMatchFactError
from app.match_fact.models import FactKind
from app.match_fact.schemas import MatchFactCreate
from app.match_fact.service import check_fact

SCORER, PASSER = uuid.uuid4(), uuid.uuid4()
EVENT_ID = uuid.uuid4()


def fact(kind: FactKind, member_id: uuid.UUID, assist: uuid.UUID | None = None) -> MatchFactCreate:
    return MatchFactCreate(
        event_id=EVENT_ID, kind=kind, member_id=member_id, assist_member_id=assist
    )


def test_check_fact_goal_with_assist_passes():
    check_fact(fact(FactKind.GOAL, SCORER, PASSER), {SCORER, PASSER})


def test_check_fact_self_assist_raises():
    with pytest.raises(InvalidMatchFactError, match="own goal"):
        check_fact(fact(FactKind.GOAL, SCORER, SCORER), {SCORER})


def test_check_fact_assist_outside_team_raises():
    with pytest.raises(InvalidMatchFactError):
        check_fact(fact(FactKind.GOAL, SCORER, uuid.uuid4()), {SCORER})
