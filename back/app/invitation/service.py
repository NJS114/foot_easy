import uuid

from app.core.database import utc_now
from app.event.exceptions import EventCancelledError
from app.event.service import EventService
from app.invitation.exceptions import InvitationNotFoundError, MemberNotInTeamError
from app.invitation.models import Availability, Invitation
from app.invitation.repository import InvitationRepository
from app.invitation.schemas import (
    AttendanceUpdate,
    AvailabilitySummary,
    InvitationCreate,
    InvitationReply,
    ReminderResult,
)
from app.member.repository import MemberRepository


class InvitationService:
    def __init__(
        self,
        repository: InvitationRepository,
        member_repository: MemberRepository,
        event_service: EventService,
    ):
        self.repository = repository
        self.member_repository = member_repository
        self.event_service = event_service

    async def list_invitations(
        self, event_id: uuid.UUID, availability: Availability | None, skip: int, limit: int
    ) -> tuple[list[Invitation], int]:
        await self.event_service.get_event(event_id)
        return await self.repository.list_by_event(event_id, availability, skip, limit)

    async def get_invitation(self, invitation_id: uuid.UUID) -> Invitation:
        invitation = await self.repository.get(invitation_id)
        if invitation is None:
            raise InvitationNotFoundError(invitation_id)
        return invitation

    async def invite_members(self, data: InvitationCreate) -> list[Invitation]:
        """Invite members to an event; already invited members are skipped (idempotent)."""
        event = await self.event_service.get_event(data.event_id)
        if event.is_cancelled:
            raise EventCancelledError(event.id)
        roster = set(await self.member_repository.list_ids_by_team(event.team_id))
        requested = set(data.member_ids) if data.member_ids is not None else roster
        outsiders = requested - roster
        if outsiders:
            raise MemberNotInTeamError(sorted(outsiders))
        already_invited = await self.repository.list_invited_member_ids(event.id)
        created = [
            Invitation(event_id=event.id, member_id=member_id, availability=Availability.PENDING)
            for member_id in requested - already_invited
        ]
        await self.repository.add_all(created)
        return [await self.repository.get(invitation.id) for invitation in created]

    async def remind_pending(self, event_id: uuid.UUID) -> ReminderResult:
        """Flag every unanswered invitation as reminded; delivery is handled by notifications."""
        event = await self.event_service.get_event(event_id)
        if event.is_cancelled:
            raise EventCancelledError(event.id)
        pending = await self.repository.list_pending(event.id)
        now = utc_now()
        for invitation in pending:
            invitation.reminder_count += 1
            invitation.last_reminded_at = now
        await self.repository.commit()
        return ReminderResult(event_id=event.id, reminded=len(pending))

    async def reply(self, invitation_id: uuid.UUID, data: InvitationReply) -> Invitation:
        invitation = await self.get_invitation(invitation_id)
        invitation.availability = data.availability
        invitation.comment = data.comment
        invitation.responded_at = utc_now()
        await self.repository.save(invitation)
        return await self.get_invitation(invitation_id)

    async def record_attendance(
        self, invitation_id: uuid.UUID, data: AttendanceUpdate
    ) -> Invitation:
        """Record (or clear) what actually happened on the day for this member."""
        invitation = await self.get_invitation(invitation_id)
        invitation.attendance = data.attendance
        await self.repository.save(invitation)
        return await self.get_invitation(invitation_id)

    async def delete_invitation(self, invitation_id: uuid.UUID) -> None:
        invitation = await self.get_invitation(invitation_id)
        await self.repository.delete(invitation)

    async def summarize(self, event_id: uuid.UUID) -> AvailabilitySummary:
        await self.event_service.get_event(event_id)
        counts = await self.repository.count_by_availability(event_id)
        return AvailabilitySummary(
            event_id=event_id,
            invited=sum(counts.values()),
            **{availability.value: counts.get(availability, 0) for availability in Availability},
        )
