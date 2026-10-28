from datetime import date, timedelta

import pytest

from app.schemas.market import KlineBar
from app.services.cta_backtester import run_backtest
from app.services.cta_strategies import breakout_signal, dual_ma_signal
from app.services.trading_fees import commission


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


def test_equity_includes_buy_and_hold_benchmark():
    bars = _bars()
    cash = 1_000_000.0
    result = run_backtest(
        code="600519",
        strategy_id="dual_ma",
        params={"fast": 5, "slow": 20},
        start=bars[0].date,
        end=bars[-1].date,
        cash=cash,
        bars=bars,
    )

    assert result.equity
    assert all("value" in point and "hold" in point for point in result.equity)

    first_open = bars[0].open
    quantity = int(cash // (first_open * 100)) * 100
    while quantity > 0:
        amount = quantity * first_open
        fee = commission(amount)
        if amount + fee <= cash:
            break
        quantity -= 100
    leftover = cash
    if quantity > 0:
        leftover = cash - quantity * first_open - commission(quantity * first_open)

    assert result.equity[0]["hold"] == leftover + quantity * bars[0].close
    assert result.equity[-1]["hold"] == leftover + quantity * bars[-1].close
    assert result.equity[0]["value"] == cash
    assert result.equity[-1]["hold"] != result.equity[0]["hold"]


def test_backtest_uses_submitted_cash_as_starting_equity():
    bars = _bars()
    cash = 12_345.67
    result = run_backtest(
        code="600519",
        strategy_id="trend",
        params={"n": 20},
        start=bars[0].date,
        end=bars[-1].date,
        cash=cash,
        bars=bars,
    )
    assert result.equity[0]["value"] == cash


def test_trend_backtest_is_a_known_strategy():
    bars = _bars()
    result = run_backtest(
        code="600519",
        strategy_id="trend",
        params={"n": 5},
        start=bars[0].date,
        end=bars[-1].date,
        cash=50_000,
        bars=bars,
    )
    assert result.equity
    assert result.equity[0]["value"] == 50_000


def test_buy_trade_records_market_value_and_remaining_cash():
    bars = _bars()
    cash = 1_000_000.0
    result = run_backtest(
        code="600519",
        strategy_id="dual_ma",
        params={"fast": 5, "slow": 20},
        start=bars[0].date,
        end=bars[-1].date,
        cash=cash,
        bars=bars,
    )
    buys = [trade for trade in result.trades if trade["side"] == "buy"]
    assert buys
    buy = buys[0]
    amount = buy["quantity"] * buy["price"]
    fee = commission(amount)
    assert buy["commission"] == fee
    assert buy["stamp_tax"] == 0.0
    assert buy["market_value"] == amount
    assert buy["cash"] == pytest.approx(cash - amount - fee)


def test_backtest_applies_custom_commission_and_stamp_tax():
    start = date(2024, 1, 2)
    closes = [10.0] * 8 + [12.0, 13.0, 14.0, 15.0] + [13.0, 11.0, 9.0, 8.0]
    bars = [
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
    cash = 50_000.0
    result = run_backtest(
        code="600519",
        strategy_id="dual_ma",
        params={"fast": 2, "slow": 5},
        start=bars[0].date,
        end=bars[-1].date,
        cash=cash,
        commission_rate=0.01,
        commission_min=0.0,
        stamp_tax_rate=0.02,
        bars=bars,
    )
    buys = [trade for trade in result.trades if trade["side"] == "buy"]
    sells = [trade for trade in result.trades if trade["side"] == "sell"]
    assert buys and sells
    buy = buys[0]
    buy_amount = buy["quantity"] * buy["price"]
    assert buy["commission"] == buy_amount * 0.01
    assert buy["stamp_tax"] == 0.0
    assert buy["market_value"] == buy_amount
    assert buy["cash"] == pytest.approx(cash - buy_amount - buy["commission"])

    sell = sells[0]
    sell_amount = sell["quantity"] * sell["price"]
    assert sell["commission"] == pytest.approx(sell_amount * 0.01)
    assert sell["stamp_tax"] == pytest.approx(sell_amount * 0.02)
    assert sell["market_value"] == 0.0
    assert sell["cash"] == pytest.approx(
        buy["cash"] + sell_amount - sell["commission"] - sell["stamp_tax"]
    )


@pytest.mark.parametrize(
    ("strategy_id", "params"),
    [
        ("macd", {"fast": 12, "slow": 26, "signal": 9}),
        ("turtle", {"entry_n": 20, "exit_n": 10}),
        ("bollinger", {"n": 20, "k": 2}),
        ("rsi", {"n": 14, "oversold": 30, "overbought": 70}),
        ("bias", {"n": 20, "entry": 5}),
        ("kdj", {"n": 9, "low": 20, "high": 80}),
        ("atr", {"n": 14, "m": 2}),
    ],
)
def test_new_indicator_strategies_run(strategy_id: str, params: dict):
    start = date(2024, 1, 2)
    closes = [10.0 + (index % 9) * 0.08 for index in range(80)]
    bars = [
        KlineBar(
            date=start + timedelta(days=index),
            open=close - 0.05,
            high=close + 0.1,
            low=close - 0.1,
            close=close,
            volume=1,
            amount=close,
        )
        for index, close in enumerate(closes)
    ]
    result = run_backtest(
        code="600519",
        strategy_id=strategy_id,
        params=params,
        start=bars[0].date,
        end=bars[-1].date,
        cash=50_000,
        bars=bars,
    )
    assert result.equity
    assert result.equity[0]["value"] == 50_000
