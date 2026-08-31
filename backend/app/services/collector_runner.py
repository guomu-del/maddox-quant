from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.models.collect_source import CollectLog, CollectSource
from app.services.collectors import get_collector
from app.services.collectors.base import CollectedItem
from app.services.report_importer import download_pdf, import_report_from_pdf
from app.tasks.parse_report import parse_report_task


def _download_item_pdf(item: CollectedItem) -> bytes:
    return download_pdf(item.pdf_url)


def run_collect_source(db: Session, source_id: int) -> CollectLog:
    source = db.get(CollectSource, source_id)
    if not source:
        raise ValueError(f"Collect source {source_id} not found")

    log = CollectLog(source_id=source.id, status="running")
    db.add(log)
    db.commit()
    db.refresh(log)

    items_found = 0
    items_new = 0
    new_report_ids: list[int] = []
    error_message: str | None = None

    try:
        collector = get_collector(source.parser, source.url, source.name)
        items = collector.fetch()
        items_found = len(items)

        for raw_item in items:
            item = collector.parse(raw_item)
            try:
                content = _download_item_pdf(item)
            except (httpx.HTTPError, ValueError):
                continue

            report, is_new = import_report_from_pdf(
                db,
                content,
                item.title,
                source=item.source or source.name,
                author=item.author,
                publish_date=item.publish_date,
                summary=item.summary,
                tags=["auto-collect"],
                trigger_parse=False,
            )
            if is_new and report:
                items_new += 1
                new_report_ids.append(report.id)

        log.status = "success"
        source.last_status = "success"
    except Exception as exc:
        error_message = str(exc)
        log.status = "failed"
        log.error = error_message
        source.last_status = "failed"

    log.items_found = items_found
    log.items_new = items_new
    log.error = error_message
    log.finished_at = datetime.now(timezone.utc)
    source.last_run_at = log.finished_at

    db.commit()
    log_id = log.id
    saved_log = db.get(CollectLog, log_id)

    for report_id in new_report_ids:
        parse_report_task(report_id)

    return saved_log or log
