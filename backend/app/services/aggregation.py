from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models.analysis import AnalysisResult
from app.models.report import Report
from app.schemas.aggregation import (
    CountItem,
    IndustryAnalysisResponse,
    OverviewResponse,
    StockAnalysisResponse,
    TrendItem,
)
from app.schemas.report import ReportResponse


def _sentiment_distribution(db: Session, report_ids: list[int] | None = None) -> dict[str, int]:
    query = select(AnalysisResult.sentiment, func.count()).group_by(AnalysisResult.sentiment)
    if report_ids is not None:
        if not report_ids:
            return {}
        query = query.where(AnalysisResult.report_id.in_(report_ids))
    rows = db.execute(query).all()
    return {row[0]: row[1] for row in rows if row[0]}


def _top_industries(db: Session, limit: int = 10) -> list[CountItem]:
    rows = db.execute(
        text(
            """
            SELECT industry, COUNT(*) AS cnt
            FROM reports, unnest(industries) AS industry
            WHERE industries IS NOT NULL
            GROUP BY industry
            ORDER BY cnt DESC
            LIMIT :limit
            """
        ),
        {"limit": limit},
    ).all()
    return [CountItem(name=row[0], count=row[1]) for row in rows]


def _top_factors(db: Session, report_ids: list[int] | None = None, limit: int = 10) -> list[CountItem]:
    if report_ids is not None and not report_ids:
        return []

    sql = """
        SELECT factor->>'name' AS name, COUNT(*) AS cnt
        FROM analysis_results ar,
             jsonb_array_elements(ar.factors) AS factor
        WHERE ar.factors IS NOT NULL
    """
    params: dict = {"limit": limit}
    if report_ids is not None:
        sql += " AND ar.report_id = ANY(:report_ids)"
        params["report_ids"] = report_ids
    sql += " GROUP BY factor->>'name' ORDER BY cnt DESC LIMIT :limit"

    rows = db.execute(text(sql), params).all()
    return [CountItem(name=row[0], count=row[1]) for row in rows if row[0]]


def _report_trend(db: Session, weeks: int = 12) -> list[TrendItem]:
    rows = db.execute(
        text(
            """
            SELECT to_char(date_trunc('week', publish_date), 'YYYY-MM-DD') AS week,
                   COUNT(*) AS cnt
            FROM reports
            WHERE publish_date IS NOT NULL
            GROUP BY date_trunc('week', publish_date)
            ORDER BY week DESC
            LIMIT :weeks
            """
        ),
        {"weeks": weeks},
    ).all()
    items = [TrendItem(week=row[0], count=row[1]) for row in rows]
    return list(reversed(items))


def get_overview(db: Session) -> OverviewResponse:
    total_reports = db.scalar(select(func.count()).select_from(Report)) or 0
    analyzed_count = db.scalar(select(func.count()).select_from(AnalysisResult)) or 0

    recent = db.scalars(
        select(Report).order_by(Report.created_at.desc()).limit(5)
    ).all()

    return OverviewResponse(
        total_reports=total_reports,
        analyzed_count=analyzed_count,
        sentiment_distribution=_sentiment_distribution(db),
        top_industries=_top_industries(db),
        top_factors=_top_factors(db),
        report_trend=_report_trend(db),
        recent_reports=[ReportResponse.model_validate(r) for r in recent],
    )


def _reports_for_industry(db: Session, industry: str) -> list[Report]:
    return db.scalars(
        select(Report)
        .where(Report.industries.contains([industry]))
        .order_by(Report.publish_date.desc().nullslast(), Report.created_at.desc())
    ).all()


def get_industry_analysis(db: Session, industry: str) -> IndustryAnalysisResponse:
    reports = _reports_for_industry(db, industry)
    report_ids = [r.id for r in reports]
    analyzed_count = (
        db.scalar(
            select(func.count())
            .select_from(AnalysisResult)
            .where(AnalysisResult.report_id.in_(report_ids))
        )
        if report_ids
        else 0
    ) or 0

    stock_rows = db.execute(
        text(
            """
            SELECT stock, COUNT(*) AS cnt
            FROM reports, unnest(stocks) AS stock
            WHERE industries @> ARRAY[:industry]::varchar[]
            GROUP BY stock
            ORDER BY cnt DESC
            LIMIT 10
            """
        ),
        {"industry": industry},
    ).all()

    return IndustryAnalysisResponse(
        industry=industry,
        total_reports=len(reports),
        analyzed_count=analyzed_count,
        sentiment_distribution=_sentiment_distribution(db, report_ids),
        top_factors=_top_factors(db, report_ids),
        related_stocks=[CountItem(name=row[0], count=row[1]) for row in stock_rows],
        reports=[ReportResponse.model_validate(r) for r in reports[:20]],
    )


def _reports_for_stock(db: Session, stock: str) -> list[Report]:
    return db.scalars(
        select(Report)
        .where(Report.stocks.contains([stock]))
        .order_by(Report.publish_date.desc().nullslast(), Report.created_at.desc())
    ).all()


def get_stock_analysis(db: Session, stock: str) -> StockAnalysisResponse:
    reports = _reports_for_stock(db, stock)
    report_ids = [r.id for r in reports]
    analyzed_count = (
        db.scalar(
            select(func.count())
            .select_from(AnalysisResult)
            .where(AnalysisResult.report_id.in_(report_ids))
        )
        if report_ids
        else 0
    ) or 0

    target_prices: list[str] = []
    if report_ids:
        rows = db.execute(
            text(
                """
                SELECT DISTINCT metric->>'value' AS value
                FROM analysis_results ar,
                     jsonb_array_elements(ar.metrics) AS metric
                WHERE ar.report_id = ANY(:report_ids)
                  AND metric->>'name' ILIKE '%目标价%'
                """
            ),
            {"report_ids": report_ids},
        ).all()
        target_prices = [row[0] for row in rows if row[0]]

    return StockAnalysisResponse(
        stock=stock,
        total_reports=len(reports),
        analyzed_count=analyzed_count,
        sentiment_distribution=_sentiment_distribution(db, report_ids),
        target_prices=target_prices,
        reports=[ReportResponse.model_validate(r) for r in reports[:20]],
    )
