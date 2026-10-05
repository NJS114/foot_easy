from app.core.exceptions import BusinessRuleError, NotFoundError


class MatchFactNotFoundError(NotFoundError):
    def __init__(self, fact_id: object):
        super().__init__("match_fact", fact_id)


class InvalidMatchFactError(BusinessRuleError):
    def __init__(self, code: str, message: str):
        super().__init__(code, message)
