from app.core.exceptions import ConflictError, NotFoundError


class TeamNotFoundError(NotFoundError):
    def __init__(self, team_id: object):
        super().__init__("team", team_id)


class TeamAlreadyExistsError(ConflictError):
    def __init__(self, name: str, season: str):
        super().__init__("team_already_exists", f"Team '{name}' already exists for season {season}")
