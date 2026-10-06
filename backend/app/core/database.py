from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


def _psycopg2_url(url: str) -> str:
    if "+psycopg://" in url and "+psycopg2://" not in url:
        url = url.replace("+psycopg://", "+psycopg2://", 1)
    if url.startswith("postgresql://"):
        return "postgresql+psycopg2://" + url[len("postgresql://") :]
    if url.startswith("postgres://"):
        return "postgresql+psycopg2://" + url[len("postgres://") :]
    return url


def resolve_database_url(*, for_migrations: bool = False) -> str:
    if for_migrations and settings.database_url_unpooled:
        return _psycopg2_url(settings.database_url_unpooled)
    url = settings.database_url
    if for_migrations and "-pooler." in url:
        url = url.replace("-pooler.", ".")
    return _psycopg2_url(url)


engine = create_engine(
    resolve_database_url(),
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
