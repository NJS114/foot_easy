from pydantic import BaseModel, ConfigDict


class PaginatedResponse[T](BaseModel):
    items: list[T]
    total: int
    skip: int
    limit: int
    has_more: bool

    @classmethod
    def build(cls, items: list[T], total: int, skip: int, limit: int) -> "PaginatedResponse[T]":
        return cls(items=items, total=total, skip=skip, limit=limit, has_more=skip + limit < total)


class FieldError(BaseModel):
    field: str
    message: str


class ErrorResponse(BaseModel):
    code: str
    message: str
    errors: list[FieldError] = []
    request_id: str | None = None


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


ERROR_RESPONSES: dict[int | str, dict] = {
    404: {"model": ErrorResponse, "description": "Resource not found"},
    409: {"model": ErrorResponse, "description": "Conflict"},
    422: {"model": ErrorResponse, "description": "Validation or business rule error"},
}
