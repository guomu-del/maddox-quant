import asyncio
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.analysis import AnalysisJob, AnalysisResult
from app.models.report import Report
from app.services.analyzer import analyze_report


def create_analysis_job(db: Session, report_id: int) -> AnalysisJob:
    job = AnalysisJob(report_id=report_id, status="pending")
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def analyze_report_task(job_id: int) -> None:
    db: Session = SessionLocal()
    try:
        job = db.get(AnalysisJob, job_id)
        if not job:
            return

        job.status = "running"
        db.commit()

        report = db.get(Report, job.report_id)
        if not report:
            job.status = "failed"
            job.error = "Report not found"
            job.finished_at = datetime.now(timezone.utc)
            db.commit()
            return

        try:
            output, raw = asyncio.run(analyze_report(report))

            existing = db.scalar(
                select(AnalysisResult).where(AnalysisResult.report_id == report.id)
            )
            if existing:
                result = existing
            else:
                result = AnalysisResult(report_id=report.id)
                db.add(result)

            result.summary = output.summary
            result.sentiment = output.sentiment
            result.investment_thesis = output.investment_thesis
            result.metrics = [m.model_dump() for m in output.metrics]
            result.factors = [f.model_dump() for f in output.factors]
            result.risks = output.risks
            result.raw_response = raw

            if output.summary:
                report.summary = output.summary

            job.status = "done"
            job.error = None
            job.finished_at = datetime.now(timezone.utc)
            db.commit()
        except Exception as exc:
            job.status = "failed"
            job.error = str(exc)
            job.finished_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()


def trigger_auto_analyze(report_id: int) -> None:
    if not settings.llm_api_key or not settings.auto_analyze:
        return

    db: Session = SessionLocal()
    try:
        job = create_analysis_job(db, report_id)
        analyze_report_task(job.id)
    finally:
        db.close()
