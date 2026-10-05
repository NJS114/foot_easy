from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError


class MemberNotFoundError(NotFoundError):
    def __init__(self, member_id: object):
        super().__init__("member", member_id)


class ShirtNumberTakenError(ConflictError):
    def __init__(self, shirt_number: int):
        super().__init__("shirt_number_taken", f"Shirt number {shirt_number} is already taken")


class PositionNotAllowedError(BusinessRuleError):
    def __init__(self):
        super().__init__("position_not_allowed", "Only players can have a position or shirt number")
