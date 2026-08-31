from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.report import Report
from app.services.pdf_parser import extract_text_from_pdf
from app.tasks.analyze_report import trigger_auto_analyze


def parse_report_task(report_id: int) -> None:
    db: Session = SessionLocal()
    try:
        report = db.get(Report, report_id)
        if not report or not report.file_path:
            return

        file_path = Path(settings.storage_path) / report.file_path
        try:
            content = file_path.read_bytes()
            full_text = extract_text_from_pdf(content)
            report.full_text = full_text
            report.status = "parsed" if full_text else "failed"
            if not report.summary and full_text:
                report.summary = full_text[:200]
        except Exception:
            report.status = "failed"
        db.commit()

        if report.status == "parsed":
            trigger_auto_analyze(report.id)
    finally:
        db.close()
