from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.club.router import router as club_router
from app.core.config import get_settings
from app.core.error_handlers import register_error_handlers
from app.core.request_id import REQUEST_ID_HEADER, RequestIdMiddleware
from app.event.router import router as event_router
from app.invitation.router import router as invitation_router
from app.lineup.router import router as lineup_router
from app.match_fact.router import router as match_fact_router
from app.member.router import router as member_router
from app.stats.router import router as stats_router
from app.team.router import router as team_router

API_PREFIX = "/api/v1"
ROUTERS = (
    club_router,
    team_router,
    member_router,
    event_router,
    invitation_router,
    lineup_router,
    match_fact_router,
    stats_router,
)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version="0.2.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[REQUEST_ID_HEADER],
    )
    app.add_middleware(RequestIdMiddleware)
    register_error_handlers(app)

    api = APIRouter(prefix=API_PREFIX)
    for router in ROUTERS:
        api.include_router(router)
    app.include_router(api)

    @app.get("/health", tags=["Health"])
    async def health() -> dict[str, str]:
        """Liveness probe."""
        return {"status": "ok"}

    return app


app = create_app()
