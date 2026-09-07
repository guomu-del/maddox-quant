"""Add extracted PDF tables column to reports."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "006_add_report_tables"
down_revision: Union[str, None] = "005_create_reference_items"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("tables", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("reports", "tables")
