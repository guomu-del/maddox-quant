from app.core.database import SessionLocal
from app.services.collector_runner import run_collect_source


def run_collect_source_task(source_id: int) -> None:
    db = SessionLocal()
    try:
        run_collect_source(db, source_id)
    finally:
        db.close()
