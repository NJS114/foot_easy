import uuid

from pydantic import BaseModel

from app.invitation.schemas import InvitedMember


class PlayerStats(BaseModel):
    member: InvitedMember
    selections: int
    goals: int
    assists: int
    yellow_cards: int
    red_cards: int
    invited: int
    present: int
    attendance_rate: float | None


class TeamStats(BaseModel):
    team_id: uuid.UUID
    played: int
    wins: int
    draws: int
    losses: int
    goals_for: int
    goals_against: int
    players: list[PlayerStats]
