from app.services.cta_strategies import (
    breakout_signal,
    dual_ma_signal,
    mean_reversion_signal,
    multi_factor_signal,
    pairs_signal,
    trend_signal,
)


def test_dual_ma_signal_rejects_invalid_windows():
    import pytest

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


def test_trend_signal_buys_on_close_crossing_above_sma():
    closes = [10.0] * 6 + [12.0]
    assert trend_signal(closes, n=5) == "buy"


def test_trend_signal_sells_on_close_crossing_below_sma():
    closes = [12.0] * 6 + [10.0]
    assert trend_signal(closes, n=5) == "sell"


def test_mean_reversion_buys_when_zscore_is_oversold():
    closes = [10.0] * 19 + [6.0]
    assert mean_reversion_signal(closes, lookback=20, entry_z=1.5) == "buy"


def test_mean_reversion_sells_when_price_reverts_to_mean():
    closes = [10.0] * 20
    assert mean_reversion_signal(closes, lookback=20, entry_z=1.5) == "sell"


def test_multi_factor_buys_when_composite_score_turns_positive():
    closes = [10.0] * 20 + [12.0]
    assert multi_factor_signal(closes, lookback=10) == "buy"


def test_pairs_buys_when_spread_is_cheap():
    closes_a = [10.0] * 19 + [8.0]
    closes_b = [10.0] * 20
    assert pairs_signal(closes_a, closes_b, lookback=20, entry_z=1.5) == "buy"


def test_pairs_sells_when_spread_reverts():
    closes_a = [10.0] * 20
    closes_b = [10.0] * 20
    assert pairs_signal(closes_a, closes_b, lookback=20, entry_z=1.5) == "sell"
