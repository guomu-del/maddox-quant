import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker

from app.api.routes import reports as reports_routes
from app.core.database import get_db
from app.main import app
from app.tasks import parse_report as parse_report_module


def _postgres_url() -> str:
    return os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/maddox_quant",
    )


@pytest.fixture(scope="session")
def postgres_engine():
    engine = create_engine(_postgres_url())
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except OperationalError as exc:
        pytest.skip(f"PostgreSQL unavailable: {exc}")
    yield engine
    engine.dispose()


def _alembic_config() -> Config:
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", _postgres_url())
    return cfg


@pytest.fixture
def sample_pdf_bytes() -> bytes:
    return Path(__file__).parent.joinpath("fixtures", "sample.pdf").read_bytes()


@pytest.fixture
def db_session(postgres_engine):
    alembic_cfg = _alembic_config()
    command.upgrade(alembic_cfg, "head")

    connection = postgres_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()

    yield session

    session.close()
    transaction.rollback()
    connection.close()
    command.downgrade(alembic_cfg, "base")


@pytest.fixture
def client(db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(reports_routes.settings, "storage_path", str(tmp_path))
    monkeypatch.setattr(parse_report_module.settings, "storage_path", str(tmp_path))

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
