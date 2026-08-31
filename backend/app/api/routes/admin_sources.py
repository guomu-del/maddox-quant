from apscheduler.triggers.cron import CronTrigger
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.collect_source import CollectLog, CollectSource
from app.schemas.collect_source import (
    CollectLogResponse,
    CollectRunResponse,
    CollectSourceCreate,
    CollectSourceResponse,
    CollectSourceUpdate,
)
from app.services.collector_runner import run_collect_source
from app.tasks.collect_sources import run_collect_source_task
from app.tasks.scheduler import reload_collect_schedules

router = APIRouter(prefix="/api/admin/sources", tags=["admin-sources"])


@router.get("", response_model=list[CollectSourceResponse])
def list_sources(db: Session = Depends(get_db)):
    items = db.scalars(select(CollectSource).order_by(CollectSource.created_at.desc())).all()
    return items


@router.post("", response_model=CollectSourceResponse, status_code=201)
def create_source(payload: CollectSourceCreate, db: Session = Depends(get_db)):
    source = CollectSource(
        name=payload.name,
        source_type=payload.source_type,
        url=payload.url,
        cron_expr=payload.cron_expr,
        parser=payload.parser,
        is_enabled=payload.is_enabled,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    reload_collect_schedules()
    return source


@router.put("/{source_id}", response_model=CollectSourceResponse)
def update_source(
    source_id: int,
    payload: CollectSourceUpdate,
    db: Session = Depends(get_db),
):
    source = db.get(CollectSource, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Collect source not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(source, field, value)

    db.commit()
    db.refresh(source)
    reload_collect_schedules()
    return source


@router.delete("/{source_id}", status_code=204)
def delete_source(source_id: int, db: Session = Depends(get_db)):
    source = db.get(CollectSource, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Collect source not found")
    db.delete(source)
    db.commit()
    reload_collect_schedules()


@router.post("/{source_id}/run", response_model=CollectRunResponse)
def run_source(
    source_id: int,
    background_tasks: BackgroundTasks,
    sync: bool = False,
    db: Session = Depends(get_db),
):
    source = db.get(CollectSource, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Collect source not found")

    if sync:
        log = run_collect_source(db, source_id)
        return CollectRunResponse(
            log_id=log.id,
            status=log.status,
            items_found=log.items_found,
            items_new=log.items_new,
        )

    background_tasks.add_task(run_collect_source_task, source_id)
    return CollectRunResponse(log_id=0, status="queued", items_found=0, items_new=0)


@router.get("/{source_id}/logs", response_model=list[CollectLogResponse])
def list_source_logs(source_id: int, db: Session = Depends(get_db)):
    source = db.get(CollectSource, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Collect source not found")

    logs = db.scalars(
        select(CollectLog)
        .where(CollectLog.source_id == source_id)
        .order_by(CollectLog.started_at.desc())
        .limit(50)
    ).all()
    return logs
