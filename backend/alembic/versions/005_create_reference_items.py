"""Create reference_items table for seed dictionaries."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005_create_reference_items"
down_revision: Union[str, None] = "004_create_collect_sources"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reference_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("item_type", sa.String(20), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.UniqueConstraint("item_type", "code", name="uq_reference_item"),
    )
    op.create_index("idx_reference_items_type", "reference_items", ["item_type"])


def downgrade() -> None:
    op.drop_index("idx_reference_items_type", table_name="reference_items")
    op.drop_table("reference_items")
