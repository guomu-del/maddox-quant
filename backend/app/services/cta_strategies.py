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
