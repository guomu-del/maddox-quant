"""Create analysis_results and analysis_jobs tables."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "002_create_analysis"
down_revision: Union[str, None] = "001_create_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "analysis_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_id", sa.Integer(), sa.ForeignKey("reports.id", ondelete="CASCADE"), unique=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("metrics", JSONB(), nullable=True),
        sa.Column("factors", JSONB(), nullable=True),
        sa.Column("sentiment", sa.String(20), nullable=True),
        sa.Column("investment_thesis", sa.Text(), nullable=True),
        sa.Column("risks", JSONB(), nullable=True),
        sa.Column("raw_response", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "analysis_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_id", sa.Integer(), sa.ForeignKey("reports.id", ondelete="CASCADE")),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_analysis_jobs_report_id", "analysis_jobs", ["report_id"])


def downgrade() -> None:
    op.drop_index("idx_analysis_jobs_report_id", table_name="analysis_jobs")
    op.drop_table("analysis_jobs")
    op.drop_table("analysis_results")
