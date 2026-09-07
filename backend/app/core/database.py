from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


def resolve_database_url(*, for_migrations: bool = False) -> str:
    if for_migrations and settings.database_url_unpooled:
        return settings.database_url_unpooled
    url = settings.database_url
    if for_migrations and "-pooler." in url:
        return url.replace("-pooler.", ".")
    return url


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
