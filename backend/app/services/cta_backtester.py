from dataclasses import dataclass
from datetime import date

from app.schemas.market import KlineBar
from app.services.cta_strategies import (
    breakout_signal,
    dual_ma_signal,
    mean_reversion_signal,
    multi_factor_signal,
    pairs_signal,
    trend_signal,
)
from app.services.trading_fees import (
    COMMISSION_MIN,
    COMMISSION_RATE,
    STAMP_TAX_RATE,
    commission,
    stamp_tax,
)


def _max_buy_quantity(
    cash: float,
    price: float,
    *,
    commission_rate: float,
    commission_min: float,
) -> int:
    if price <= 0 or cash <= 0:
        return 0
    quantity = int(cash // (price * 100)) * 100
    while quantity > 0:
        amount = quantity * price
        if amount + commission(amount, rate=commission_rate, minimum=commission_min) <= cash:
            return quantity
        quantity -= 100
    return 0


def _buy_and_hold_values(
    bars: list[KlineBar],
    cash: float,
    *,
    commission_rate: float,
    commission_min: float,
) -> list[float]:
    if not bars:
        return []
    quantity = _max_buy_quantity(
        cash,
        bars[0].open,
        commission_rate=commission_rate,
        commission_min=commission_min,
    )
    leftover = cash
    if quantity > 0:
        amount = quantity * bars[0].open
        leftover = cash - amount - commission(
            amount, rate=commission_rate, minimum=commission_min
        )
    return [leftover + quantity * bar.close for bar in bars]


@dataclass
class BacktestResult:
    trades: list[dict]
    equity: list[dict]
    metrics: dict


def _strategy_signal(
    *,
    strategy_id: str,
    params: dict,
    visible: list[KlineBar],
    pair_close_by_date: dict,
) -> str | None:
    closes = [item.close for item in visible]
    if strategy_id == "dual_ma":
        return dual_ma_signal(
            closes,
            fast=int(params.get("fast", 5)),
            slow=int(params.get("slow", 20)),
        )
    if strategy_id == "breakout":
        return breakout_signal(
            [item.high for item in visible],
            [item.low for item in visible],
            closes,
            n=int(params.get("n", 20)),
        )
    if strategy_id == "trend":
        return trend_signal(closes, n=int(params.get("n", 20)))
    if strategy_id == "mean_reversion":
        return mean_reversion_signal(
            closes,
            lookback=int(params.get("lookback", 20)),
            entry_z=float(params.get("entry_z", 1.5)),
        )
    if strategy_id == "multi_factor":
        return multi_factor_signal(closes, lookback=int(params.get("lookback", 20)))
    if strategy_id == "pairs":
        aligned_a: list[float] = []
        aligned_b: list[float] = []
        for item in visible:
            other = pair_close_by_date.get(item.date)
            if other is not None and other > 0:
                aligned_a.append(item.close)
                aligned_b.append(other)
        return pairs_signal(
            aligned_a,
            aligned_b,
            lookback=int(params.get("lookback", 20)),
            entry_z=float(params.get("entry_z", 2)),
        )
    raise ValueError(f"unknown strategy: {strategy_id}")


def run_backtest(
    *,
    code: str,
    strategy_id: str,
    params: dict,
    start: date,
    end: date,
    cash: float,
    bars: list[KlineBar],
    pair_bars: list[KlineBar] | None = None,
    commission_rate: float = COMMISSION_RATE,
    commission_min: float = COMMISSION_MIN,
    stamp_tax_rate: float = STAMP_TAX_RATE,
) -> BacktestResult:
    initial_cash = float(cash)
    available_cash = initial_cash
    position = 0
    entry_cost = 0.0
    pending_intent: str | None = None
    trades: list[dict] = []
    equity: list[dict] = []
    round_trip_profits: list[float] = []
    hold_values = _buy_and_hold_values(
        bars,
        initial_cash,
        commission_rate=commission_rate,
        commission_min=commission_min,
    )
    if strategy_id == "pairs" and not pair_bars:
        raise ValueError("pairs strategy requires pair bars")
    pair_close_by_date = {item.date: item.close for item in pair_bars or []}

    for index, bar in enumerate(bars):
        if pending_intent == "buy" and position == 0:
            quantity = _max_buy_quantity(
                available_cash,
                bar.open,
                commission_rate=commission_rate,
                commission_min=commission_min,
            )
            if quantity > 0:
                amount = quantity * bar.open
                buy_commission = commission(
                    amount, rate=commission_rate, minimum=commission_min
                )
                available_cash -= amount + buy_commission
                position = quantity
                entry_cost = amount + buy_commission
                trades.append(
                    {
                        "date": bar.date.isoformat(),
                        "code": code,
                        "side": "buy",
                        "price": bar.open,
                        "quantity": quantity,
                        "commission": buy_commission,
                        "stamp_tax": 0.0,
                        "market_value": position * bar.open,
                        "cash": available_cash,
                    }
                )
        elif pending_intent == "sell" and position > 0:
            quantity = position
            amount = quantity * bar.open
            sell_commission = commission(
                amount, rate=commission_rate, minimum=commission_min
            )
            sell_stamp_tax = stamp_tax("sell", amount, rate=stamp_tax_rate)
            proceeds = amount - sell_commission - sell_stamp_tax
            available_cash += proceeds
            round_trip_profits.append(proceeds - entry_cost)
            position = 0
            entry_cost = 0.0
            trades.append(
                {
                    "date": bar.date.isoformat(),
                    "code": code,
                    "side": "sell",
                    "price": bar.open,
                    "quantity": quantity,
                    "commission": sell_commission,
                    "stamp_tax": sell_stamp_tax,
                    "market_value": position * bar.open,
                    "cash": available_cash,
                }
            )
        pending_intent = None

        signal = _strategy_signal(
            strategy_id=strategy_id,
            params=params,
            visible=bars[: index + 1],
            pair_close_by_date=pair_close_by_date,
        )

        if index < len(bars) - 1:
            if signal == "buy" and position == 0:
                pending_intent = "buy"
            elif signal == "sell" and position > 0:
                pending_intent = "sell"

        equity.append(
            {
                "date": bar.date.isoformat(),
                "value": available_cash + position * bar.close,
                "hold": hold_values[index],
            }
        )

    metrics = _metrics(
        initial_cash=initial_cash,
        equity=equity,
        trades=trades,
        round_trip_profits=round_trip_profits,
    )
    return BacktestResult(trades=trades, equity=equity, metrics=metrics)


def _metrics(
    *,
    initial_cash: float,
    equity: list[dict],
    trades: list[dict],
    round_trip_profits: list[float],
) -> dict:
    if not equity or initial_cash <= 0:
        return {
            "total_return": 0.0,
            "annual_return": 0.0,
            "max_drawdown": 0.0,
            "win_rate": 0.0,
            "profit_factor": 0.0,
            "trade_count": len(trades),
        }

    total_return = equity[-1]["value"] / initial_cash - 1
    first_date = date.fromisoformat(equity[0]["date"])
    last_date = date.fromisoformat(equity[-1]["date"])
    days = max((last_date - first_date).days, 1)
    annual_return = (1 + total_return) ** (365 / days) - 1

    peak = 0.0
    max_drawdown = 0.0
    for point in equity:
        value = point["value"]
        peak = max(peak, value)
        if peak > 0:
            max_drawdown = max(max_drawdown, (peak - value) / peak)

    wins = [profit for profit in round_trip_profits if profit > 0]
    losses = [-profit for profit in round_trip_profits if profit < 0]
    win_rate = len(wins) / len(round_trip_profits) if round_trip_profits else 0.0
    profit_factor = sum(wins) / sum(losses) if losses else 0.0
    return {
        "total_return": total_return,
        "annual_return": annual_return,
        "max_drawdown": max_drawdown,
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "trade_count": len(trades),
    }
