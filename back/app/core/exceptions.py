class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        errors: list[tuple[str, str]] | None = None,
    ):
        super().__init__(message)
        self.code, self.message, self.status_code = code, message, status_code
        self.errors = errors or []


class NotFoundError(AppError):
    def __init__(self, entity: str, entity_id: object):
        super().__init__(
            f"{entity}_not_found", f"{entity.capitalize()} {entity_id} was not found", 404
        )


class ConflictError(AppError):
    def __init__(self, code: str, message: str):
        super().__init__(code, message, 409)


class BusinessRuleError(AppError):
    def __init__(self, code: str, message: str, errors: list[tuple[str, str]] | None = None):
        super().__init__(code, message, 422, errors)
