"""Create reports table with full-text search vector."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001_create_reports"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("source", sa.String(200), nullable=True),
        sa.Column("author", sa.String(200), nullable=True),
        sa.Column("publish_date", sa.Date(), nullable=True),
        sa.Column("industries", sa.ARRAY(sa.String()), nullable=True),
        sa.Column("sectors", sa.ARRAY(sa.String()), nullable=True),
        sa.Column("stocks", sa.ARRAY(sa.String()), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("full_text", sa.Text(), nullable=True),
        sa.Column("file_path", sa.String(500), nullable=True),
        sa.Column("file_hash", sa.String(64), nullable=True, unique=True),
        sa.Column("tags", sa.ARRAY(sa.String()), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.execute(
        """
        ALTER TABLE reports ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
            to_tsvector('simple',
                coalesce(title, '') || ' ' ||
                coalesce(summary, '') || ' ' ||
                coalesce(full_text, '')
            )
        ) STORED
        """
    )
    op.create_index("idx_reports_search", "reports", ["search_vector"], postgresql_using="gin")
    op.create_index("idx_reports_publish_date", "reports", ["publish_date"])
    op.create_index("idx_reports_industries", "reports", ["industries"], postgresql_using="gin")


def downgrade() -> None:
    op.drop_index("idx_reports_industries", table_name="reports")
    op.drop_index("idx_reports_publish_date", table_name="reports")
    op.drop_index("idx_reports_search", table_name="reports")
    op.drop_table("reports")
