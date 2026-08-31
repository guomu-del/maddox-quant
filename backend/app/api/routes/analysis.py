from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.analysis import AnalysisJob, AnalysisResult
from app.models.report import Report
from app.schemas.analysis import (
    AnalysisJobResponse,
    AnalysisResultResponse,
    AnalyzeStartResponse,
)
from app.tasks.analyze_report import analyze_report_task, create_analysis_job

router = APIRouter(tags=["analysis"])


@router.post("/api/reports/{report_id}/analyze", response_model=AnalyzeStartResponse, status_code=202)
def start_analysis(
    report_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if not settings.llm_api_key:
        raise HTTPException(
            status_code=503,
            detail="LLM API key not configured. Set LLM_API_KEY in environment.",
        )

    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status != "parsed" or not (report.full_text or report.summary):
        raise HTTPException(
            status_code=400,
            detail="Report must be parsed before analysis",
        )

    job = create_analysis_job(db, report_id)
    background_tasks.add_task(analyze_report_task, job.id)
    return AnalyzeStartResponse(job_id=job.id)


@router.get("/api/reports/{report_id}/analysis", response_model=AnalysisResultResponse)
def get_report_analysis(report_id: int, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    result = db.scalar(select(AnalysisResult).where(AnalysisResult.report_id == report_id))
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return result


@router.get("/api/analysis/jobs/{job_id}", response_model=AnalysisJobResponse)
def get_analysis_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(AnalysisJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found")
    return job
