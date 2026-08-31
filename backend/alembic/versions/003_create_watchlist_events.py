"""Create watchlists, events, and notifications tables."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003_create_watchlist_events"
down_revision: Union[str, None] = "002_create_analysis"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "watchlists",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("target_type", sa.String(20), nullable=False),
        sa.Column("target_code", sa.String(50), nullable=False),
        sa.Column("target_name", sa.String(200), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("target_type", "target_code", name="uq_watchlist_target"),
    )
    op.create_table(
        "events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("related_type", sa.String(20), nullable=True),
        sa.Column("related_code", sa.String(50), nullable=True),
        sa.Column("report_id", sa.Integer(), sa.ForeignKey("reports.id", ondelete="SET NULL"), nullable=True),
        sa.Column("severity", sa.String(20), server_default="info", nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_events_report_id", "events", ["report_id"])
    op.create_index("idx_notifications_is_read", "notifications", ["is_read"])


def downgrade() -> None:
    op.drop_index("idx_notifications_is_read", table_name="notifications")
    op.drop_index("idx_events_report_id", table_name="events")
    op.drop_table("notifications")
    op.drop_table("events")
    op.drop_table("watchlists")
