from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError


class TeamTaskNotFoundError(NotFoundError):
    def __init__(self, task_id: object):
        super().__init__("task", task_id)


class AssignmentNotFoundError(NotFoundError):
    def __init__(self, assignment_id: object):
        super().__init__("assignment", assignment_id)


class TeamTaskAlreadyExistsError(ConflictError):
    def __init__(self, name: str):
        super().__init__("task_already_exists", f"Task '{name}' already exists for this team")


class AlreadyAssignedError(ConflictError):
    def __init__(self):
        super().__init__("already_assigned", "This member already has this task for the event")


class OutsideTeamError(BusinessRuleError):
    def __init__(self, what: str):
        super().__init__("outside_team", f"The {what} does not belong to the event's team")
