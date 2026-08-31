"""Create collect_sources and collect_logs tables."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004_create_collect_sources"
down_revision: Union[str, None] = "003_create_watchlist_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "collect_sources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("source_type", sa.String(50), nullable=False, server_default="rss"),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("cron_expr", sa.String(50), server_default="0 8 * * *", nullable=False),
        sa.Column("parser", sa.String(50), server_default="rss", nullable=False),
        sa.Column("is_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_status", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "collect_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_id", sa.Integer(), sa.ForeignKey("collect_sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("items_found", sa.Integer(), server_default="0", nullable=False),
        sa.Column("items_new", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_collect_logs_source_id", "collect_logs", ["source_id"])


def downgrade() -> None:
    op.drop_index("idx_collect_logs_source_id", table_name="collect_logs")
    op.drop_table("collect_logs")
    op.drop_table("collect_sources")
