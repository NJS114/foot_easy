from app.core.exceptions import BusinessRuleError, NotFoundError


class LineupNotFoundError(NotFoundError):
    def __init__(self, event_id: object):
        super().__init__("lineup", event_id)


class InvalidLineupError(BusinessRuleError):
    def __init__(self, code: str, message: str):
        super().__init__(code, message)
