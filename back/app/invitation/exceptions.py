from app.core.exceptions import BusinessRuleError, NotFoundError


class InvitationNotFoundError(NotFoundError):
    def __init__(self, invitation_id: object):
        super().__init__("invitation", invitation_id)


class MemberNotInTeamError(BusinessRuleError):
    def __init__(self, member_ids: list):
        ids = ", ".join(str(member_id) for member_id in member_ids)
        super().__init__("member_not_in_team", f"Members not in the event's team: {ids}")
