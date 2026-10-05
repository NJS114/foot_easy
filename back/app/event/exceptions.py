from app.core.exceptions import BusinessRuleError, NotFoundError


class EventNotFoundError(NotFoundError):
    def __init__(self, event_id: object):
        super().__init__("event", event_id)


class InvalidEventScheduleError(BusinessRuleError):
    def __init__(self, message: str):
        super().__init__("invalid_event_schedule", message)


class MatchDetailsRequiredError(BusinessRuleError):
    def __init__(self):
        super().__init__(
            "match_details_required", "A match requires an opponent and a home/away venue"
        )


class ScoreNotAllowedError(BusinessRuleError):
    def __init__(self):
        super().__init__("score_not_allowed", "Only a match or a tournament can have a score")


class EventCancelledError(BusinessRuleError):
    def __init__(self, event_id: object):
        super().__init__("event_cancelled", f"Event {event_id} is cancelled")
