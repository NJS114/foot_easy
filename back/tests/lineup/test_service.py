import uuid

import pytest

from app.lineup.exceptions import InvalidLineupError
from app.lineup.formations import FORMATIONS
from app.lineup.models import SlotRole
from app.lineup.schemas import SlotInput
from app.lineup.service import check_slots

PLAYERS = [uuid.uuid4() for _ in range(3)]
FOUR_FOUR_TWO = FORMATIONS["4-4-2"]


def slot(member_id: uuid.UUID, role: SlotRole, index: int | None = None) -> SlotInput:
    return SlotInput(member_id=member_id, role=role, position_index=index)


def test_check_slots_valid_lineup_passes():
    check_slots(
        FOUR_FOUR_TWO,
        [slot(PLAYERS[0], SlotRole.STARTER, 0), slot(PLAYERS[1], SlotRole.SUBSTITUTE)],
        set(PLAYERS),
    )


def test_check_slots_same_player_twice_raises():
    slots = [slot(PLAYERS[0], SlotRole.STARTER, 0), slot(PLAYERS[0], SlotRole.SUBSTITUTE)]

    with pytest.raises(InvalidLineupError, match="twice"):
        check_slots(FOUR_FOUR_TWO, slots, set(PLAYERS))


def test_check_slots_starter_without_position_raises():
    with pytest.raises(InvalidLineupError):
        check_slots(FOUR_FOUR_TWO, [slot(PLAYERS[0], SlotRole.STARTER)], set(PLAYERS))


def test_check_slots_substitute_with_position_raises():
    with pytest.raises(InvalidLineupError, match="Substitutes"):
        check_slots(FOUR_FOUR_TWO, [slot(PLAYERS[0], SlotRole.SUBSTITUTE, 3)], set(PLAYERS))


def test_check_slots_outsider_raises():
    with pytest.raises(InvalidLineupError):
        check_slots(FOUR_FOUR_TWO, [slot(uuid.uuid4(), SlotRole.SUBSTITUTE)], set(PLAYERS))


def test_formations_player_count_matches_lines():
    for formation in FORMATIONS.values():
        assert formation.players == 1 + sum(formation.lines)
