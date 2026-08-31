from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.services.event_detector import detect_new_report_events


def run_event_detection() -> int:
    db: Session = SessionLocal()
    try:
        return detect_new_report_events(db)
    finally:
        db.close()
