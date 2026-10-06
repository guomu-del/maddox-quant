from datetime import date
from io import BytesIO
from pathlib import Path
import os

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.errors import AppError
from app.models.report import Report
from app.schemas.report import ReportListResponse, ReportResponse
from app.services.pdf_parser import compute_file_hash, extract_pdf_content, persist_pdf
from app.tasks.parse_report import parse_report_task

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _report_pdf_bytes(report: Report) -> bytes | None:
    if report.file_path:
        file_path = Path(settings.storage_path) / report.file_path
        if file_path.exists():
            return file_path.read_bytes()
    return report.file_data


def _parse_csv_field(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split(",") if part.strip()]


@router.post("/import", response_model=ReportResponse, status_code=201)
async def import_report(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    source: str | None = Form(None),
    author: str | None = Form(None),
    publish_date: date | None = Form(None),
    industries: str | None = Form(None),
    sectors: str | None = Form(None),
    stocks: str | None = Form(None),
    tags: str | None = Form(None),
    summary: str | None = Form(None),
    db: Session = Depends(get_db),
):
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise AppError("仅支持 PDF 文件", code="invalid_file_type", status_code=400)

    content = await file.read()
    if not content:
        raise AppError("文件为空", code="empty_file", status_code=400)

    max_mb = min(settings.max_upload_mb, 4) if os.getenv("VERCEL") else settings.max_upload_mb
    max_bytes = max_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise AppError(
            f"文件超过 {max_mb}MB 限制",
            code="file_too_large",
            status_code=413,
        )

    file_hash = compute_file_hash(content)
    existing = db.scalar(select(Report).where(Report.file_hash == file_hash))
    if existing:
        raise AppError(
            "该 PDF 已导入",
            code="duplicate_report",
            status_code=409,
            extra={"existing_report_id": existing.id},
        )

    filename, file_hash, stored_bytes = persist_pdf(content, settings.storage_path)
    report = Report(
        title=title,
        source=source,
        author=author,
        publish_date=publish_date,
        industries=_parse_csv_field(industries) or None,
        sectors=_parse_csv_field(sectors) or None,
        stocks=_parse_csv_field(stocks) or None,
        tags=_parse_csv_field(tags) or None,
        summary=summary,
        file_path=filename,
        file_data=stored_bytes,
        file_hash=file_hash,
        status="pending",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    if stored_bytes is not None or os.getenv("VERCEL"):
        parse_report_task(report.id)
    else:
        background_tasks.add_task(parse_report_task, report.id)
    return report


@router.get("", response_model=ReportListResponse)
def list_reports(
    q: str | None = None,
    industry: str | None = None,
    sector: str | None = None,
    stock: str | None = None,
    source: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort: str = Query("publish_date"),
    db: Session = Depends(get_db),
):
    filters = []

    if q:
        filters.append(text("search_vector @@ plainto_tsquery('simple', :q)").bindparams(q=q))
    if industry:
        filters.append(Report.industries.contains([industry]))
    if sector:
        filters.append(Report.sectors.contains([sector]))
    if stock:
        filters.append(Report.stocks.contains([stock]))
    if source:
        filters.append(Report.source == source)
    if date_from:
        filters.append(Report.publish_date >= date_from)
    if date_to:
        filters.append(Report.publish_date <= date_to)

    count_stmt = select(func.count()).select_from(Report)
    for clause in filters:
        count_stmt = count_stmt.where(clause)
    total = db.scalar(count_stmt) or 0

    query = select(Report)
    for clause in filters:
        query = query.where(clause)

    if sort == "created_at":
        query = query.order_by(Report.created_at.desc())
    else:
        query = query.order_by(Report.publish_date.desc().nullslast(), Report.created_at.desc())

    reports = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    return ReportListResponse(
        items=[ReportResponse.model_validate(r) for r in reports],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.tables is None:
        pdf_bytes = _report_pdf_bytes(report)
        if pdf_bytes:
            try:
                _, tables = extract_pdf_content(pdf_bytes)
                report.tables = tables or []
                db.commit()
                db.refresh(report)
            except Exception:
                pass
    return report


@router.get("/{report_id}/file")
def get_report_file(report_id: int, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report or not report.file_path:
        raise HTTPException(status_code=404, detail="Report file not found")

    file_path = Path(settings.storage_path) / report.file_path
    if file_path.exists():
        return FileResponse(
            path=file_path,
            media_type="application/pdf",
            filename=file_path.name,
            content_disposition_type="inline",
            headers={"X-Content-Type-Options": "nosniff"},
        )
    if report.file_data:
        return StreamingResponse(
            BytesIO(report.file_data),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{file_path.name}"',
                "X-Content-Type-Options": "nosniff",
            },
        )
    raise HTTPException(status_code=404, detail="Report file missing on disk")


@router.delete("/{report_id}", status_code=204)
def delete_report(report_id: int, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.file_path:
        file_path = Path(settings.storage_path) / report.file_path
        if file_path.exists():
            file_path.unlink()

    db.delete(report)
    db.commit()
