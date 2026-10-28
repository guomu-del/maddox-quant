COMMISSION_RATE = 0.0003
COMMISSION_MIN = 5.0
STAMP_TAX_RATE = 0.0005


def commission(
    amount: float,
    *,
    rate: float = COMMISSION_RATE,
    minimum: float = COMMISSION_MIN,
) -> float:
    return max(round(amount * rate, 10), minimum)


def stamp_tax(side: str, amount: float, *, rate: float = STAMP_TAX_RATE) -> float:
    return amount * rate if side == "sell" else 0.0
