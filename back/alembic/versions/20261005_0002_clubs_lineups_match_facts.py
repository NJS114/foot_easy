"""clubs, lineups, match facts, scores and reminders

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-05 15:00:00

Existing teams are attached to a single "Mon club" club so club_id can be NOT NULL.
Downgrade drops clubs, lineups and match facts (data loss) and turns tournaments into
"other" events because the previous schema does not know that kind.
"""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_COLOR = "#16a34a"
NEW_EVENT_KINDS = "kind IN ('match', 'training', 'tournament', 'other')"
OLD_EVENT_KINDS = "kind IN ('match', 'training', 'other')"


def audit_columns(with_updated_at: bool = True) -> list[sa.Column]:
    columns = [sa.Column("id", sa.Uuid(), primary_key=True)]
    if with_updated_at:
        columns += [
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        ]
    return columns


def create_clubs_and_attach_teams() -> None:
    op.create_table(
        "clubs",
        *audit_columns(),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("city", sa.String(120), nullable=True),
        sa.Column("primary_color", sa.String(7), nullable=False),
    )
    with op.batch_alter_table("teams") as batch:
        batch.add_column(sa.Column("club_id", sa.Uuid(), nullable=True))
        batch.add_column(
            sa.Column("color", sa.String(7), nullable=False, server_default=DEFAULT_COLOR)
        )

    connection = op.get_bind()
    if connection.scalar(sa.text("SELECT COUNT(*) FROM teams")):
        club_id, now = uuid.uuid4(), datetime.now(UTC)
        clubs = sa.table(
            "clubs",
            sa.column("id", sa.Uuid()),
            sa.column("name", sa.String()),
            sa.column("primary_color", sa.String()),
            sa.column("created_at", sa.DateTime(timezone=True)),
            sa.column("updated_at", sa.DateTime(timezone=True)),
        )
        op.bulk_insert(
            clubs,
            [
                {
                    "id": club_id,
                    "name": "Mon club",
                    "primary_color": DEFAULT_COLOR,
                    "created_at": now,
                    "updated_at": now,
                }
            ],
        )
        teams = sa.table("teams", sa.column("club_id", sa.Uuid()))
        connection.execute(teams.update().values(club_id=club_id))

    with op.batch_alter_table("teams") as batch:
        batch.alter_column("club_id", existing_type=sa.Uuid(), nullable=False)
        batch.create_foreign_key(
            "fk_teams_club_id", "clubs", ["club_id"], ["id"], ondelete="CASCADE"
        )
        batch.create_index("ix_teams_club_id", ["club_id"])
        batch.drop_constraint("uq_teams_name_season", type_="unique")
        batch.create_unique_constraint("uq_teams_club_name_season", ["club_id", "name", "season"])


def add_scores_and_reminders() -> None:
    with op.batch_alter_table("events") as batch:
        batch.drop_constraint("ck_eventkind", type_="check")
        batch.create_check_constraint("ck_eventkind", NEW_EVENT_KINDS)
        batch.add_column(sa.Column("score_for", sa.SmallInteger(), nullable=True))
        batch.add_column(sa.Column("score_against", sa.SmallInteger(), nullable=True))
        batch.create_check_constraint(
            "ck_events_scores_positive", "score_for >= 0 AND score_against >= 0"
        )
    with op.batch_alter_table("invitations") as batch:
        batch.add_column(
            sa.Column("reminder_count", sa.SmallInteger(), nullable=False, server_default="0")
        )
        batch.add_column(sa.Column("last_reminded_at", sa.DateTime(timezone=True), nullable=True))


def create_lineups_and_facts() -> None:
    op.create_table(
        "lineups",
        *audit_columns(),
        sa.Column(
            "event_id",
            sa.Uuid(),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("formation", sa.String(10), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "lineup_slots",
        *audit_columns(with_updated_at=False),
        sa.Column(
            "lineup_id", sa.Uuid(), sa.ForeignKey("lineups.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "member_id", sa.Uuid(), sa.ForeignKey("members.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("position_index", sa.SmallInteger(), nullable=True),
        sa.CheckConstraint("role IN ('starter', 'substitute')", name="ck_slotrole"),
        sa.CheckConstraint("position_index >= 0", name="ck_lineup_slots_position_index"),
        sa.UniqueConstraint("lineup_id", "member_id", name="uq_lineup_slots_member"),
    )
    op.create_index("ix_lineup_slots_lineup_id", "lineup_slots", ["lineup_id"])
    op.create_table(
        "match_facts",
        *audit_columns(),
        sa.Column(
            "event_id", sa.Uuid(), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column(
            "member_id", sa.Uuid(), sa.ForeignKey("members.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "assist_member_id",
            sa.Uuid(),
            sa.ForeignKey("members.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("minute", sa.SmallInteger(), nullable=True),
        sa.CheckConstraint("kind IN ('goal', 'yellow_card', 'red_card')", name="ck_factkind"),
        sa.CheckConstraint("minute BETWEEN 0 AND 130", name="ck_match_facts_minute"),
    )
    for column in ("event_id", "member_id", "assist_member_id"):
        op.create_index(f"ix_match_facts_{column}", "match_facts", [column])


def upgrade() -> None:
    create_clubs_and_attach_teams()
    add_scores_and_reminders()
    create_lineups_and_facts()


def downgrade() -> None:
    op.drop_table("match_facts")
    op.drop_table("lineup_slots")
    op.drop_table("lineups")
    with op.batch_alter_table("invitations") as batch:
        batch.drop_column("last_reminded_at")
        batch.drop_column("reminder_count")
    op.execute("UPDATE events SET kind = 'other' WHERE kind = 'tournament'")
    with op.batch_alter_table("events") as batch:
        batch.drop_constraint("ck_events_scores_positive", type_="check")
        batch.drop_column("score_against")
        batch.drop_column("score_for")
        batch.drop_constraint("ck_eventkind", type_="check")
        batch.create_check_constraint("ck_eventkind", OLD_EVENT_KINDS)
    with op.batch_alter_table("teams") as batch:
        batch.drop_constraint("uq_teams_club_name_season", type_="unique")
        batch.create_unique_constraint("uq_teams_name_season", ["name", "season"])
        batch.drop_index("ix_teams_club_id")
        batch.drop_constraint("fk_teams_club_id", type_="foreignkey")
        batch.drop_column("color")
        batch.drop_column("club_id")
    op.drop_table("clubs")
