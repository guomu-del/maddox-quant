from datetime import date

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.report import Report
from app.services.pdf_parser import compute_file_hash, save_pdf
from app.tasks.parse_report import parse_report_task


def import_report_from_pdf(
    db: Session,
    content: bytes,
    title: str,
    *,
    source: str | None = None,
    author: str | None = None,
    publish_date: date | None = None,
    industries: list[str] | None = None,
    sectors: list[str] | None = None,
    stocks: list[str] | None = None,
    tags: list[str] | None = None,
    summary: str | None = None,
    trigger_parse: bool = True,
) -> tuple[Report | None, bool]:
    """Import a PDF report. Returns (report, is_new). is_new=False when duplicate."""
    if not content:
        return None, False

    file_hash = compute_file_hash(content)
    existing = db.scalar(select(Report).where(Report.file_hash == file_hash))
    if existing:
        return existing, False

    filename, _ = save_pdf(content, settings.storage_path)
    report = Report(
        title=title,
        source=source,
        author=author,
        publish_date=publish_date,
        industries=industries,
        sectors=sectors,
        stocks=stocks,
        tags=tags,
        summary=summary,
        file_path=filename,
        file_hash=file_hash,
        status="pending",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    if trigger_parse:
        parse_report_task(report.id)

    return report, True


def download_pdf(url: str) -> bytes:
    response = httpx.get(url, timeout=60, follow_redirects=True)
    response.raise_for_status()
    content_type = response.headers.get("content-type", "")
    if "pdf" not in content_type.lower() and not url.lower().endswith(".pdf"):
        raise ValueError(f"URL does not appear to be a PDF: {url}")
    return response.content
