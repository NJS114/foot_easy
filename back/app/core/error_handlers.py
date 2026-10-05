import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions import AppError
from app.core.schemas import ErrorResponse, FieldError

logger = logging.getLogger(__name__)


def _envelope(request: Request, status_code: int, body: ErrorResponse) -> JSONResponse:
    body.request_id = getattr(request.state, "request_id", None)
    return JSONResponse(status_code=status_code, content=body.model_dump())


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    errors = [FieldError(field=field, message=message) for field, message in exc.errors]
    body = ErrorResponse(code=exc.code, message=exc.message, errors=errors)
    return _envelope(request, exc.status_code, body)


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [
        FieldError(field=".".join(str(part) for part in err["loc"][1:]), message=err["msg"])
        for err in exc.errors()
    ]
    body = ErrorResponse(code="validation_error", message="Invalid request", errors=errors)
    return _envelope(request, 422, body)


async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    body = ErrorResponse(code=f"http_{exc.status_code}", message=str(exc.detail))
    return _envelope(request, exc.status_code, body)


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled error on %s: %s", request.url.path, exc, exc_info=True)
    body = ErrorResponse(code="internal_error", message="An unexpected error occurred")
    return _envelope(request, 500, body)


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
