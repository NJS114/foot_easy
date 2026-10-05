from app.core.exceptions import ConflictError, NotFoundError


class ClubNotFoundError(NotFoundError):
    def __init__(self, club_id: object):
        super().__init__("club", club_id)


class ClubAlreadyExistsError(ConflictError):
    def __init__(self, name: str):
        super().__init__("club_already_exists", f"Club '{name}' already exists")
