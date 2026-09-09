from datetime import date, timedelta

import pytest

from app.schemas.market import KlineBar
from app.services.cta_backtester import run_backtest
from app.services.cta_strategies import breakout_signal, dual_ma_signal


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


def _first_dual_ma_crossover(
    bars: list[KlineBar], fast: int, slow: int
) -> date:
    for index in range(slow, len(bars)):
        closes = [bar.close for bar in bars[: index + 1]]
        previous = closes[:-1]
        prev_fast = sum(previous[-fast:]) / fast
        prev_slow = sum(previous[-slow:]) / slow
        cur_fast = sum(closes[-fast:]) / fast
        cur_slow = sum(closes[-slow:]) / slow
        if prev_fast <= prev_slow and cur_fast > cur_slow:
            return bars[index].date
    raise AssertionError("synthetic bars must contain a crossover")


def test_dual_ma_buys_at_open_after_crossover():
    bars = _bars()

    result = run_backtest(
        code="600519",
        strategy_id="dual_ma",
        params={"fast": 5, "slow": 20},
        start=date(2024, 1, 2),
        end=date(2024, 3, 1),
        cash=1_000_000,
        bars=bars,
    )

    buys = [trade for trade in result.trades if trade["side"] == "buy"]
    assert buys
    fill_date = date.fromisoformat(buys[0]["date"])
    assert fill_date > _first_dual_ma_crossover(bars, fast=5, slow=20)
    assert buys[0]["price"] == {bar.date: bar for bar in bars}[fill_date].open


def test_dual_ma_signal_rejects_invalid_windows():
    with pytest.raises(ValueError, match="fast"):
        dual_ma_signal([10.0] * 21, fast=20, slow=5)


def test_breakout_uses_prior_window_only():
    assert (
        breakout_signal(
            highs=[10, 11, 12, 13],
            lows=[8, 8, 9, 9],
            closes=[9, 10, 11, 14],
            n=3,
        )
        == "buy"
    )


def test_no_signal_on_last_bar_does_not_fill():
    bars = _bars()[:26]

    result = run_backtest(
        code="600519",
        strategy_id="dual_ma",
        params={"fast": 5, "slow": 20},
        start=bars[0].date,
        end=bars[-1].date,
        cash=1_000_000,
        bars=bars,
    )

    assert result.trades == []
    assert result.metrics["trade_count"] == 0
