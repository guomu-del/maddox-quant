import os

import pytest
from sqlalchemy import text

from app.core.database import engine


@pytest.mark.skipif(
    os.getenv("SKIP_DB_TESTS") == "1",
    reason="Database not available",
)
def test_database_connection():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        assert result.scalar() == 1
