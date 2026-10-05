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


class MissingScopeError(BusinessRuleError):
    def __init__(self):
        super().__init__("missing_scope", "Filter members by team_id or club_id")


class InvalidImportError(BusinessRuleError):
    def __init__(self, errors: list[tuple[str, str]]):
        super().__init__(
            "invalid_import", f"{len(errors)} error(s) in the file, nothing was imported", errors
        )
