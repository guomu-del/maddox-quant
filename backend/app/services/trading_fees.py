COMMISSION_RATE = 0.0003
COMMISSION_MIN = 5.0
STAMP_TAX_RATE = 0.0005


def commission(amount: float) -> float:
    return max(round(amount * COMMISSION_RATE, 10), COMMISSION_MIN)


def stamp_tax(side: str, amount: float) -> float:
    return amount * STAMP_TAX_RATE if side == "sell" else 0.0
