import os

from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.collect_source import CollectSource
from app.tasks.collect_sources import run_collect_source_task

# Importing APScheduler (tzlocal/threads) crashes Vercel serverless isolates.
_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
scheduler = None
if not _serverless:
    from apscheduler.schedulers.background import BackgroundScheduler

    scheduler = BackgroundScheduler()


def reload_collect_schedules() -> None:
    if scheduler is None or not settings.collect_enabled:
        return

    from apscheduler.triggers.cron import CronTrigger

    for job in scheduler.get_jobs():
        if job.id.startswith("collect_source_"):
            scheduler.remove_job(job.id)

    db = SessionLocal()
    try:
        sources = db.scalars(
            select(CollectSource).where(CollectSource.is_enabled.is_(True))
        ).all()
        for source in sources:
            try:
                trigger = CronTrigger.from_crontab(source.cron_expr)
            except ValueError:
                continue
            scheduler.add_job(
                run_collect_source_task,
                trigger=trigger,
                args=[source.id],
                id=f"collect_source_{source.id}",
                replace_existing=True,
            )
    finally:
        db.close()
