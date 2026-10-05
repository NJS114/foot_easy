"""create teams members events invitations

Revision ID: 0001
Revises:
Create Date: 2026-10-05 11:36:54.225166
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def enum_check(column: str, values: Sequence[str], name: str) -> sa.CheckConstraint:
    allowed = ", ".join(f"'{value}'" for value in values)
    return sa.CheckConstraint(f"{column} IN ({allowed})", name=name)


def audit_columns() -> list[sa.Column]:
    return [
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "teams",
        *audit_columns(),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("season", sa.String(9), nullable=False),
        enum_check(
            "category",
            ["u7", "u9", "u11", "u13", "u15", "u17", "u19", "senior", "veteran"],
            "ck_teamcategory",
        ),
        sa.UniqueConstraint("name", "season", name="uq_teams_name_season"),
    )
    op.create_index("ix_teams_season", "teams", ["season"])

    op.create_table(
        "members",
        *audit_columns(),
        sa.Column(
            "team_id", sa.Uuid(), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("first_name", sa.String(80), nullable=False),
        sa.Column("last_name", sa.String(80), nullable=False),
        sa.Column("email", sa.String(254), nullable=True),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("position", sa.String(20), nullable=True),
        sa.Column("shirt_number", sa.SmallInteger(), nullable=True),
        enum_check("role", ["player", "coach", "staff"], "ck_memberrole"),
        enum_check(
            "position", ["goalkeeper", "defender", "midfielder", "forward"], "ck_playerposition"
        ),
        sa.CheckConstraint("shirt_number BETWEEN 1 AND 99", name="ck_members_shirt_number_range"),
        sa.UniqueConstraint("team_id", "shirt_number", name="uq_members_team_shirt_number"),
    )
    op.create_index("ix_members_team_id", "members", ["team_id"])

    op.create_table(
        "events",
        *audit_columns(),
        sa.Column(
            "team_id", sa.Uuid(), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("meeting_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("location", sa.String(200), nullable=True),
        sa.Column("opponent", sa.String(100), nullable=True),
        sa.Column("venue", sa.String(20), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_cancelled", sa.Boolean(), nullable=False, server_default=sa.false()),
        enum_check("kind", ["match", "training", "other"], "ck_eventkind"),
        enum_check("venue", ["home", "away"], "ck_venue"),
    )
    op.create_index("ix_events_team_id_starts_at", "events", ["team_id", "starts_at"])

    op.create_table(
        "invitations",
        *audit_columns(),
        sa.Column(
            "event_id", sa.Uuid(), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "member_id",
            sa.Uuid(),
            sa.ForeignKey("members.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("availability", sa.String(20), nullable=False),
        sa.Column("comment", sa.String(200), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        enum_check(
            "availability", ["pending", "available", "uncertain", "unavailable"], "ck_availability"
        ),
        sa.UniqueConstraint("event_id", "member_id", name="uq_invitations_event_member"),
    )
    op.create_index("ix_invitations_event_id", "invitations", ["event_id"])
    op.create_index("ix_invitations_member_id", "invitations", ["member_id"])


def downgrade() -> None:
    op.drop_table("invitations")
    op.drop_table("events")
    op.drop_table("members")
    op.drop_table("teams")
