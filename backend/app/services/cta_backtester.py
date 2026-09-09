from dataclasses import dataclass
from datetime import date

from app.schemas.market import KlineBar
from app.services.cta_strategies import breakout_signal, dual_ma_signal
from app.services.trading_fees import commission, stamp_tax


@dataclass
class BacktestResult:
    trades: list[dict]
    equity: list[dict]
    metrics: dict


def run_backtest(
    *,
    code: str,
    strategy_id: str,
    params: dict,
    start: date,
    end: date,
    cash: float,
    bars: list[KlineBar],
) -> BacktestResult:
    initial_cash = float(cash)
    available_cash = initial_cash
    position = 0
    entry_cost = 0.0
    pending_intent: str | None = None
    trades: list[dict] = []
    equity: list[dict] = []
    round_trip_profits: list[float] = []

    for index, bar in enumerate(bars):
        if pending_intent == "buy" and position == 0:
            quantity = int(available_cash // (bar.open * 100)) * 100
            while quantity > 0:
                amount = quantity * bar.open
                buy_commission = commission(amount)
                if amount + buy_commission <= available_cash:
                    break
                quantity -= 100
            if quantity > 0:
                amount = quantity * bar.open
                buy_commission = commission(amount)
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
                    }
                )
        elif pending_intent == "sell" and position > 0:
            quantity = position
            amount = quantity * bar.open
            sell_commission = commission(amount)
            sell_stamp_tax = stamp_tax("sell", amount)
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
                }
            )
        pending_intent = None

        closes = [item.close for item in bars[: index + 1]]
        if strategy_id == "dual_ma":
            signal = dual_ma_signal(
                closes,
                fast=int(params.get("fast", 5)),
                slow=int(params.get("slow", 20)),
            )
        elif strategy_id == "breakout":
            visible = bars[: index + 1]
            signal = breakout_signal(
                [item.high for item in visible],
                [item.low for item in visible],
                closes,
                n=int(params.get("n", 20)),
            )
        else:
            raise ValueError(f"unknown strategy: {strategy_id}")

        if index < len(bars) - 1:
            if signal == "buy" and position == 0:
                pending_intent = "buy"
            elif signal == "sell" and position > 0:
                pending_intent = "sell"

        equity.append(
            {
                "date": bar.date.isoformat(),
                "value": available_cash + position * bar.close,
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
