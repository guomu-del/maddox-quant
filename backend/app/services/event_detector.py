from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.report import Report
from app.models.watchlist import Event, Notification, Watchlist


def _match_watchlists(report: Report, watchlists: list[Watchlist]) -> list[Watchlist]:
    matched: list[Watchlist] = []
    for item in watchlists:
        if item.target_type == "industry" and report.industries and item.target_code in report.industries:
            matched.append(item)
        elif item.target_type == "sector" and report.sectors and item.target_code in report.sectors:
            matched.append(item)
        elif item.target_type == "stock" and report.stocks and item.target_code in report.stocks:
            matched.append(item)
    return matched


def _event_exists(db: Session, report_id: int, related_type: str, related_code: str) -> bool:
    existing = db.scalar(
        select(Event.id).where(
            Event.report_id == report_id,
            Event.event_type == "new_report",
            Event.related_type == related_type,
            Event.related_code == related_code,
        )
    )
    return existing is not None


def create_new_report_event(
    db: Session,
    report: Report,
    watch_item: Watchlist,
) -> Notification | None:
    if _event_exists(db, report.id, watch_item.target_type, watch_item.target_code):
        return None

    title = f"新发研报：{report.title}"
    content = f"关注项 [{watch_item.target_name or watch_item.target_code}] 有新研报入库"
    event = Event(
        event_type="new_report",
        title=title,
        content=content,
        related_type=watch_item.target_type,
        related_code=watch_item.target_code,
        report_id=report.id,
        severity="info",
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(event)
    db.flush()

    notification = Notification(event_id=event.id, is_read=False)
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def detect_events_for_report(db: Session, report_id: int) -> int:
    report = db.get(Report, report_id)
    if not report:
        return 0

    watchlists = db.scalars(select(Watchlist)).all()
    matched = _match_watchlists(report, watchlists)
    created = 0
    for item in matched:
        if create_new_report_event(db, report, item):
            created += 1
    return created


def detect_new_report_events(db: Session, minutes: int = 10) -> int:
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    reports = db.scalars(select(Report).where(Report.created_at >= since)).all()
    total = 0
    for report in reports:
        total += detect_events_for_report(db, report.id)
    return total
