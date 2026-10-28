def dual_ma_signal(
    closes: list[float], fast: int, slow: int
) -> str | None:
    if fast <= 0 or slow <= 0 or fast >= slow:
        raise ValueError("fast must be positive and less than slow")
    if len(closes) < slow + 1:
        return None

    def ma(size: int, series: list[float]) -> float:
        return sum(series[-size:]) / size

    previous = closes[:-1]
    prev_fast = ma(fast, previous)
    prev_slow = ma(slow, previous)
    cur_fast = ma(fast, closes)
    cur_slow = ma(slow, closes)
    if prev_fast <= prev_slow and cur_fast > cur_slow:
        return "buy"
    if prev_fast >= prev_slow and cur_fast < cur_slow:
        return "sell"
    return None


def breakout_signal(
    highs: list[float],
    lows: list[float],
    closes: list[float],
    n: int,
) -> str | None:
    if n <= 0:
        raise ValueError("n must be positive")
    if not (len(highs) == len(lows) == len(closes)):
        raise ValueError("highs, lows, and closes must have equal lengths")
    if len(closes) < n + 1:
        return None
    window_high = max(highs[-(n + 1) : -1])
    window_low = min(lows[-(n + 1) : -1])
    if closes[-1] > window_high:
        return "buy"
    if closes[-1] < window_low:
        return "sell"
    return None


def _sma(series: list[float], size: int) -> float:
    return sum(series[-size:]) / size


def _stdev(window: list[float]) -> float:
    n = len(window)
    mean = sum(window) / n
    return (sum((value - mean) ** 2 for value in window) / n) ** 0.5


def trend_signal(closes: list[float], n: int) -> str | None:
    if n <= 0:
        raise ValueError("n must be positive")
    if len(closes) < n + 1:
        return None
    previous = closes[:-1]
    prev_ma = _sma(previous, n)
    cur_ma = _sma(closes, n)
    if previous[-1] <= prev_ma and closes[-1] > cur_ma:
        return "buy"
    if previous[-1] >= prev_ma and closes[-1] < cur_ma:
        return "sell"
    return None


def mean_reversion_signal(
    closes: list[float], lookback: int, entry_z: float
) -> str | None:
    if lookback < 2:
        raise ValueError("lookback must be at least 2")
    if entry_z <= 0:
        raise ValueError("entry_z must be positive")
    if len(closes) < lookback:
        return None
    window = closes[-lookback:]
    deviation = _stdev(window)
    if deviation == 0:
        return "sell"
    z_score = (closes[-1] - _sma(closes, lookback)) / deviation
    if z_score <= -entry_z:
        return "buy"
    if z_score >= 0:
        return "sell"
    return None


def _factor_score(closes: list[float], lookback: int) -> int:
    sma = _sma(closes, lookback)
    momentum = closes[-1] / closes[-lookback] - 1
    reversal = closes[-1] / closes[-5] - 1
    score = 0
    if closes[-1] > sma:
        score += 1
    if momentum > 0:
        score += 1
    if reversal < 0:
        score += 1
    return score


def multi_factor_signal(closes: list[float], lookback: int) -> str | None:
    if lookback < 6:
        raise ValueError("lookback must be at least 6")
    if len(closes) < lookback + 1:
        return None
    score = _factor_score(closes, lookback)
    previous = _factor_score(closes[:-1], lookback)
    if previous < 2 and score >= 2:
        return "buy"
    if previous >= 2 and score < 2:
        return "sell"
    return None


def pairs_signal(
    closes_a: list[float],
    closes_b: list[float],
    lookback: int,
    entry_z: float,
) -> str | None:
    if lookback < 2:
        raise ValueError("lookback must be at least 2")
    if entry_z <= 0:
        raise ValueError("entry_z must be positive")
    if len(closes_a) != len(closes_b):
        raise ValueError("paired closes must have equal lengths")
    if len(closes_a) < lookback:
        return None
    ratios = []
    for price_a, price_b in zip(closes_a[-lookback:], closes_b[-lookback:]):
        if price_b <= 0:
            return None
        ratios.append(price_a / price_b)
    deviation = _stdev(ratios)
    if deviation == 0:
        return "sell"
    z_score = (ratios[-1] - sum(ratios) / lookback) / deviation
    if z_score <= -entry_z:
        return "buy"
    if z_score >= 0:
        return "sell"
    return None


def _ema_series(values: list[float], n: int) -> list[float | None]:
    result: list[float | None] = [None] * len(values)
    if len(values) < n:
        return result
    seed = sum(values[:n]) / n
    result[n - 1] = seed
    alpha = 2 / (n + 1)
    previous = seed
    for index in range(n, len(values)):
        previous = values[index] * alpha + previous * (1 - alpha)
        result[index] = previous
    return result


def macd_signal(closes: list[float], fast: int, slow: int, signal: int) -> str | None:
    if fast <= 0 or slow <= 0 or fast >= slow:
        raise ValueError("fast must be positive and less than slow")
    if signal <= 0:
        raise ValueError("signal must be positive")
    if len(closes) < slow + signal:
        return None
    fast_ema = _ema_series(closes, fast)
    slow_ema = _ema_series(closes, slow)
    dif_values = [
        a - b
        for a, b in zip(fast_ema, slow_ema)
        if a is not None and b is not None
    ]
    dea = _ema_series(dif_values, signal)
    if len(dea) < 2 or dea[-1] is None or dea[-2] is None:
        return None
    prev_dif, cur_dif = dif_values[-2], dif_values[-1]
    prev_dea, cur_dea = dea[-2], dea[-1]
    if prev_dif <= prev_dea and cur_dif > cur_dea:
        return "buy"
    if prev_dif >= prev_dea and cur_dif < cur_dea:
        return "sell"
    return None


def turtle_signal(
    highs: list[float],
    lows: list[float],
    closes: list[float],
    entry_n: int,
    exit_n: int,
) -> str | None:
    if entry_n <= 0 or exit_n <= 0:
        raise ValueError("entry_n and exit_n must be positive")
    if not (len(highs) == len(lows) == len(closes)):
        raise ValueError("highs, lows, and closes must have equal lengths")
    need = max(entry_n, exit_n) + 1
    if len(closes) < need:
        return None
    entry_high = max(highs[-(entry_n + 1) : -1])
    exit_low = min(lows[-(exit_n + 1) : -1])
    if closes[-1] > entry_high:
        return "buy"
    if closes[-1] < exit_low:
        return "sell"
    return None


def bollinger_signal(closes: list[float], n: int, k: float) -> str | None:
    if n < 2:
        raise ValueError("n must be at least 2")
    if k <= 0:
        raise ValueError("k must be positive")
    if len(closes) < n:
        return None
    mid = _sma(closes, n)
    deviation = _stdev(closes[-n:])
    if deviation == 0:
        return "sell"
    lower = mid - k * deviation
    if closes[-1] <= lower:
        return "buy"
    if closes[-1] >= mid:
        return "sell"
    return None


def _rsi(closes: list[float], n: int) -> float | None:
    if len(closes) < n + 1:
        return None
    gains: list[float] = []
    losses: list[float] = []
    for previous, current in zip(closes[:-1], closes[1:]):
        change = current - previous
        gains.append(max(change, 0.0))
        losses.append(max(-change, 0.0))
    avg_gain = sum(gains[:n]) / n
    avg_loss = sum(losses[:n]) / n
    for gain, loss in zip(gains[n:], losses[n:]):
        avg_gain = (avg_gain * (n - 1) + gain) / n
        avg_loss = (avg_loss * (n - 1) + loss) / n
    if avg_loss == 0:
        return 100.0
    return 100.0 - 100.0 / (1.0 + avg_gain / avg_loss)


def rsi_signal(
    closes: list[float], n: int, oversold: float, overbought: float
) -> str | None:
    if n <= 1:
        raise ValueError("n must be greater than 1")
    if not 0 < oversold < overbought < 100:
        raise ValueError("oversold must be below overbought, both in (0, 100)")
    value = _rsi(closes, n)
    if value is None:
        return None
    if value <= oversold:
        return "buy"
    if value >= overbought:
        return "sell"
    return None


def bias_signal(closes: list[float], n: int, entry: float) -> str | None:
    if n <= 0:
        raise ValueError("n must be positive")
    if entry <= 0:
        raise ValueError("entry must be positive")
    if len(closes) < n:
        return None
    mid = _sma(closes, n)
    if mid == 0:
        return None
    bias = (closes[-1] / mid - 1) * 100
    if bias <= -entry:
        return "buy"
    if bias >= 0:
        return "sell"
    return None


def _kdj_series(
    highs: list[float], lows: list[float], closes: list[float], n: int
) -> tuple[list[float | None], list[float | None]]:
    k_values: list[float | None] = []
    d_values: list[float | None] = []
    k = 50.0
    d = 50.0
    for index in range(len(closes)):
        if index + 1 < n:
            k_values.append(None)
            d_values.append(None)
            continue
        window_high = max(highs[index + 1 - n : index + 1])
        window_low = min(lows[index + 1 - n : index + 1])
        if window_high == window_low:
            rsv = 50.0
        else:
            rsv = (closes[index] - window_low) / (window_high - window_low) * 100
        k = (2 / 3) * k + (1 / 3) * rsv
        d = (2 / 3) * d + (1 / 3) * k
        k_values.append(k)
        d_values.append(d)
    return k_values, d_values


def kdj_signal(
    highs: list[float],
    lows: list[float],
    closes: list[float],
    n: int,
    low: float,
    high: float,
) -> str | None:
    if n < 2:
        raise ValueError("n must be at least 2")
    if not 0 < low < high < 100:
        raise ValueError("low must be below high, both in (0, 100)")
    if not (len(highs) == len(lows) == len(closes)):
        raise ValueError("highs, lows, and closes must have equal lengths")
    if len(closes) < n + 1:
        return None
    k_values, d_values = _kdj_series(highs, lows, closes, n)
    prev_k, cur_k = k_values[-2], k_values[-1]
    prev_d, cur_d = d_values[-2], d_values[-1]
    if None in (prev_k, cur_k, prev_d, cur_d):
        return None
    if prev_k <= prev_d and cur_k > cur_d and prev_k <= low and prev_d <= low:
        return "buy"
    if prev_k >= prev_d and cur_k < cur_d:
        return "sell"
    if cur_k >= high:
        return "sell"
    return None


def _true_ranges(highs: list[float], lows: list[float], closes: list[float]) -> list[float]:
    ranges = [highs[0] - lows[0]]
    for index in range(1, len(closes)):
        ranges.append(
            max(
                highs[index] - lows[index],
                abs(highs[index] - closes[index - 1]),
                abs(lows[index] - closes[index - 1]),
            )
        )
    return ranges


def atr_channel_signal(
    highs: list[float],
    lows: list[float],
    closes: list[float],
    n: int,
    m: float,
) -> str | None:
    if n < 2:
        raise ValueError("n must be at least 2")
    if m <= 0:
        raise ValueError("m must be positive")
    if not (len(highs) == len(lows) == len(closes)):
        raise ValueError("highs, lows, and closes must have equal lengths")
    if len(closes) < n + 1:
        return None
    atr = _sma(_true_ranges(highs, lows, closes), n)
    mid = _sma(closes, n)
    if closes[-1] > mid + m * atr:
        return "buy"
    if closes[-1] < mid - m * atr:
        return "sell"
    return None
