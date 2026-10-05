"""Import every model so Base.metadata is complete for Alembic and test setup."""

from app.core.database import Base
from app.event.models import Event
from app.invitation.models import Invitation
from app.member.models import Member
from app.team.models import Team

__all__ = ["Base", "Event", "Invitation", "Member", "Team"]
