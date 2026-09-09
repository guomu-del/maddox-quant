from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import AppError
from app.models.backtest import BacktestRun
from app.schemas.backtest import BacktestCreate, BacktestResponse, StrategyInfo
from app.services import market_service
from app.services.cta_backtester import run_backtest

router = APIRouter(prefix="/api/quant", tags=["quant"])

STRATEGIES = [
    {
        "id": "dual_ma",
        "name": "双均线",
        "params": {"fast": 5, "slow": 20},
    },
    {
        "id": "breakout",
        "name": "唐奇安突破",
        "params": {"n": 20},
    },
]
STRATEGY_DEFAULTS = {item["id"]: item["params"] for item in STRATEGIES}


def _three_years_before(value: date) -> date:
    try:
        return value.replace(year=value.year - 3)
    except ValueError:
        return value.replace(year=value.year - 3, day=28)


@router.get("/strategies", response_model=list[StrategyInfo])
def list_strategies():
    return STRATEGIES


@router.post("/backtests", response_model=BacktestResponse)
def create_backtest(payload: BacktestCreate, db: Session = Depends(get_db)):
    defaults = STRATEGY_DEFAULTS.get(payload.strategy_id)
    if defaults is None:
        raise AppError(
            "未知回测策略",
            code="invalid_strategy",
            status_code=400,
        )

    end = payload.end or datetime.now(ZoneInfo("Asia/Shanghai")).date()
    start = payload.start or _three_years_before(end)
    if start > end:
        raise AppError(
            "开始日期不能晚于结束日期",
            code="invalid_date_range",
            status_code=400,
        )
    params = {**defaults, **payload.params}
    kline = market_service.get_kline(
        payload.code,
        start=start,
        end=end,
        limit=800,
    )
    try:
        result = run_backtest(
            code=payload.code,
            strategy_id=payload.strategy_id,
            params=params,
            start=start,
            end=end,
            cash=payload.cash,
            bars=kline.items,
        )
    except (TypeError, ValueError) as exc:
        raise AppError(
            str(exc),
            code="invalid_strategy_params",
            status_code=400,
        ) from exc

    run = BacktestRun(
        code=payload.code,
        strategy_id=payload.strategy_id,
        params=params,
        start=start,
        end=end,
        cash=payload.cash,
        status="ok",
        metrics=result.metrics,
        equity=result.equity,
        trades=result.trades,
        error=None,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


@router.get("/backtests", response_model=list[BacktestResponse])
def list_backtests(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    statement = (
        select(BacktestRun)
        .order_by(BacktestRun.created_at.desc(), BacktestRun.id.desc())
        .limit(limit)
    )
    return list(db.scalars(statement))


@router.get("/backtests/{run_id}", response_model=BacktestResponse)
def get_backtest(run_id: int, db: Session = Depends(get_db)):
    run = db.get(BacktestRun, run_id)
    if run is None:
        raise AppError(
            "未找到回测记录",
            code="backtest_not_found",
            status_code=404,
        )
    return run
