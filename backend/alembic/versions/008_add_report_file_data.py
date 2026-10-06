"""Store PDF bytes when local disk is not writable."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "008_add_report_file_data"
down_revision: Union[str, None] = "007_create_paper_and_backtest"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("file_data", sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    op.drop_column("reports", "file_data")
