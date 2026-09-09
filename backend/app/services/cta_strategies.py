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
