from datetime import date, timedelta

import pytest
from sqlalchemy import func, select

from app.core.errors import AppError
from app.models.backtest import BacktestRun
from app.models.paper import PaperAccount, PaperPosition, PaperTrade
from app.schemas.market import KlineBar, KlineResponse
from app.services import market_service


def _bars() -> list[KlineBar]:
    start = date(2024, 1, 2)
    closes = [10.0] * 25 + [10.2, 10.4, 10.8, 11.5, 12.0, 12.2]
    return [
        KlineBar(
            date=start + timedelta(days=i),
            open=close - 0.05,
            high=close + 0.1,
            low=close - 0.1,
            close=close,
            volume=1,
            amount=close,
        )
        for i, close in enumerate(closes)
    ]


def test_strategies_returns_builtin_catalog(client):
    response = client.get("/api/quant/strategies")

    assert response.status_code == 200
    body = response.json()
    ids = [item["id"] for item in body]
    assert ids == [
        "dual_ma",
        "breakout",
        "trend",
        "mean_reversion",
        "multi_factor",
        "pairs",
        "macd",
        "turtle",
        "bollinger",
        "rsi",
        "bias",
        "kdj",
        "atr",
    ]
    by_id = {item["id"]: item for item in body}
    assert by_id["trend"]["params"] == {"n": 20}
    assert by_id["mean_reversion"]["params"] == {"lookback": 20, "entry_z": 1.5}
    assert by_id["multi_factor"]["params"] == {"lookback": 20}
    assert by_id["pairs"]["params"] == {"lookback": 20, "entry_z": 2}


def test_backtest_persists_run_without_writing_paper_trades(
    client, db_session, monkeypatch
):
    monkeypatch.setattr(
        market_service,
        "get_kline",
        lambda *args, **kwargs: KlineResponse(
            code="600519",
            items=_bars(),
            as_of="2024-03-01T00:00:00+08:00",
            stale=False,
        ),
    )

    response = client.post(
        "/api/quant/backtests",
        json={
            "code": "600519",
            "strategy_id": "dual_ma",
            "params": {"fast": 5, "slow": 20},
            "start": "2024-01-02",
            "end": "2024-03-01",
            "cash": 1_000_000,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["metrics"]["trade_count"] == 1
    trade = body["trades"][0]
    assert trade["market_value"] == trade["quantity"] * trade["price"]
    assert trade["cash"] == pytest.approx(
        body["cash"] - trade["market_value"] - trade["commission"]
    )
    assert body["params"]["commission_rate"] == 0.0003
    assert body["params"]["stamp_tax_rate"] == 0.0005
    assert db_session.scalar(select(func.count()).select_from(PaperTrade)) == 0
    account = db_session.get(PaperAccount, 1)
    assert account is None or account.cash == 1_000_000
    assert db_session.scalar(select(func.count()).select_from(PaperPosition)) == 0

    listed = client.get("/api/quant/backtests?limit=20")
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == body["id"]

    detail = client.get(f"/api/quant/backtests/{body['id']}")
    assert detail.status_code == 200
    assert detail.json() == body


def test_backtest_rejects_unknown_strategy(client):
    response = client.post(
        "/api/quant/backtests",
        json={"code": "600519", "strategy_id": "unknown"},
    )

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_strategy"


def test_backtest_missing_run_returns_404(client):
    response = client.get("/api/quant/backtests/999999")

    assert response.status_code == 404


def test_backtest_market_source_failure_does_not_persist_ok_run(
    client, db_session, monkeypatch
):
    def fail_kline(*args, **kwargs):
        raise AppError(
            "行情源暂时不可用",
            code="market_source_error",
            status_code=502,
        )

    monkeypatch.setattr(market_service, "get_kline", fail_kline)
    before = db_session.scalar(select(func.count()).select_from(BacktestRun))

    response = client.post(
        "/api/quant/backtests",
        json={"code": "600519", "strategy_id": "dual_ma"},
    )

    assert response.status_code == 502
    assert response.json()["code"] == "market_source_error"
    assert db_session.scalar(select(func.count()).select_from(BacktestRun)) == before
