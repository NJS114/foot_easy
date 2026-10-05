"""Import every model so Base.metadata is complete for Alembic and test setup."""

from app.club.models import Club
from app.core.database import Base
from app.event.models import Event
from app.invitation.models import Invitation
from app.lineup.models import Lineup, LineupSlot
from app.match_fact.models import MatchFact
from app.member.models import Member
from app.team.models import Team

__all__ = [
    "Base",
    "Club",
    "Event",
    "Invitation",
    "Lineup",
    "LineupSlot",
    "MatchFact",
    "Member",
    "Team",
]
