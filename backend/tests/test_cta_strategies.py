import pytest

from app.services.cta_strategies import (
    atr_channel_signal,
    bias_signal,
    bollinger_signal,
    breakout_signal,
    dual_ma_signal,
    kdj_signal,
    macd_signal,
    mean_reversion_signal,
    multi_factor_signal,
    pairs_signal,
    rsi_signal,
    trend_signal,
    turtle_signal,
)


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


def test_macd_returns_none_until_warmed_up():
    assert macd_signal([10.0] * 20, fast=12, slow=26, signal=9) is None


def test_macd_buys_after_a_sustained_upturn():
    closes = [30.0 - i * 0.3 for i in range(50)] + [15.0 + i * 0.5 for i in range(50)]
    signals = [macd_signal(closes[: index + 1], 12, 26, 9) for index in range(len(closes))]
    assert "buy" in signals


def test_turtle_buys_on_entry_breakout_and_sells_on_exit_low():
    highs = [10, 11, 12, 13]
    lows = [8, 8, 9, 7]
    closes = [9, 10, 11, 14]
    assert turtle_signal(highs, lows, closes, entry_n=3, exit_n=2) == "buy"
    assert (
        turtle_signal(
            [10, 11, 12, 11],
            [8, 8, 9, 7],
            [9, 10, 11, 7.5],
            entry_n=3,
            exit_n=2,
        )
        == "sell"
    )


def test_bollinger_buys_below_lower_band_and_sells_at_mid():
    assert bollinger_signal([10.0] * 19 + [6.0], n=20, k=2) == "buy"
    assert bollinger_signal([10.0] * 20, n=20, k=2) == "sell"


def test_rsi_buys_when_oversold_and_sells_when_overbought():
    falling = [100.0 - i for i in range(20)]
    rising = [50.0 + i for i in range(20)]
    assert rsi_signal(falling, n=14, oversold=30, overbought=70) == "buy"
    assert rsi_signal(rising, n=14, oversold=30, overbought=70) == "sell"


def test_bias_buys_when_stretched_below_ma():
    assert bias_signal([10.0] * 19 + [8.0], n=20, entry=5) == "buy"
    assert bias_signal([10.0] * 20, n=20, entry=5) == "sell"


def test_kdj_buys_on_low_golden_cross():
    highs = [10.0] * 18 + [10.0, 12.0]
    lows = [8.0] * 18 + [8.0, 8.0]
    closes = [8.05] * 18 + [8.05, 11.8]
    signals = [
        kdj_signal(
            highs[: index + 1],
            lows[: index + 1],
            closes[: index + 1],
            n=9,
            low=20,
            high=80,
        )
        for index in range(len(closes))
    ]
    assert "buy" in signals


def test_atr_channel_buys_above_upper_and_sells_below_lower():
    highs = [10.1] * 14 + [16.0]
    lows = [9.9] * 14 + [15.0]
    closes = [10.0] * 14 + [15.8]
    assert atr_channel_signal(highs, lows, closes, n=14, m=2) == "buy"
    highs_down = [10.1] * 14 + [4.0]
    lows_down = [9.9] * 14 + [3.0]
    closes_down = [10.0] * 14 + [3.2]
    assert atr_channel_signal(highs_down, lows_down, closes_down, n=14, m=2) == "sell"
